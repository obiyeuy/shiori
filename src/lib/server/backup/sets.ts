import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID,sign,verify,type KeyObject} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,realpath,stat} from 'node:fs/promises';import {resolve,sep} from 'node:path';import type {Pool} from 'pg';import {z} from 'zod';
const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const filename=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/).refine(s=>s!=='.'&&s!=='..');
const fileSchema=z.object({name:filename,logicalName:z.string().max(220),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().nonnegative(),encryptedBytes:z.number().int().nonnegative()}).strict();
export const manifestSchema=z.object({format:z.literal(1),id:z.string().uuid(),snapshotId:z.string().min(1),snapshotAt:z.string().datetime(),completedAt:z.string().datetime(),keyId:filename,cipher:z.literal('aes-256-gcm'),signature:z.literal('ed25519'),files:z.array(fileSchema).min(1),migrations:z.array(z.object({name:filename,sha256:z.string()}))}).strict();
export type BackupManifest=z.infer<typeof manifestSchema>;
export type DatabaseDump={tables:{name:string;rows:Record<string,unknown>[]}[];migrations:{name:string;sql:string}[]};
export function encrypt(data:Buffer,key:Buffer){if(key.length!==32)throw new Error('backup key must be 32 bytes');const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);return Buffer.concat([nonce,cipher.update(data),cipher.final(),cipher.getAuthTag()]);}
function decrypt(data:Buffer,key:Buffer){if(data.length<28)throw new Error('truncated backup');const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(-16));return Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]);}
export async function createBackupSet(input:{pool:Pool;mediaRoot:string;backupRoot:string;encryptionKey:Buffer;signingKey:KeyObject;keyId:string;afterSnapshot?:()=>Promise<void>}){
 filename.parse(input.keyId);const id=randomUUID(),directory=resolve(input.backupRoot,id);await mkdir(directory,{recursive:true,mode:0o700});const client=await input.pool.connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const snapshot=(await client.query('SELECT pg_export_snapshot() id,transaction_timestamp() at')).rows[0];
  const tableNames=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename<>'schema_migrations' ORDER BY tablename")).rows.map(r=>String(r.tablename));
  const tables=[];for(const name of tableNames){if(!/^[a-z_][a-z0-9_]*$/.test(name))throw new Error('unsupported table name');tables.push({name,rows:(await client.query(`SELECT * FROM "${name}"`)).rows});}
  const media=(await client.query('SELECT DISTINCT file_key FROM media_variants ORDER BY file_key')).rows;await input.afterSnapshot?.();
  const migrations=[];const applied=(await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;for(const row of applied){const name=filename.parse(row.name);if(name.startsWith('optional_'))continue;const sql=await readFile(resolve('drizzle',name+'.sql'),'utf8');if(hash(sql)!==row.checksum)throw new Error('source migration checksum mismatch');migrations.push({name,sql});}if(!migrations.length)throw new Error('missing applied migrations');
  const files:BackupManifest['files']=[];
  async function save(name:string,logicalName:string,bytes:Buffer){const encrypted=encrypt(bytes,input.encryptionKey);await writeFile(resolve(directory,name),encrypted,{flag:'wx',mode:0o600});files.push({name,logicalName,bytes:bytes.length,encryptedBytes:encrypted.length,sha256:hash(encrypted)});}
  await save('database.enc','database.json',Buffer.from(JSON.stringify({tables,migrations} satisfies DatabaseDump)));
  const mediaRoot=await realpath(input.mediaRoot);let index=0;
  for(const row of media){const name=filename.parse(row.file_key),source=await realpath(resolve(mediaRoot,name));if(!source.startsWith(mediaRoot+sep)||!(await stat(source)).isFile())throw new Error('invalid media path');await save(`media-${index++}.enc`,'media/'+name,await readFile(source));}
  await client.query('COMMIT');
  const manifest:BackupManifest={format:1,id,snapshotId:snapshot.id,snapshotAt:new Date(snapshot.at).toISOString(),completedAt:new Date().toISOString(),keyId:input.keyId,cipher:'aes-256-gcm',signature:'ed25519',files,migrations:migrations.map(m=>({name:m.name,sha256:hash(m.sql)}))};
  const bytes=Buffer.from(JSON.stringify(manifest));await writeFile(resolve(directory,'manifest.json'),bytes,{flag:'wx',mode:0o600});await writeFile(resolve(directory,'manifest.sig'),sign(null,bytes,input.signingKey),{flag:'wx',mode:0o600});
  await verifyBackupSet(directory,input.encryptionKey,input.signingKey,true);await writeFile(resolve(directory,'complete.json'),JSON.stringify({digest:hash(bytes),completedAt:manifest.completedAt}),{flag:'wx',mode:0o600});
  return {directory,manifest,digest:hash(bytes)};
 }catch(error){await client.query('ROLLBACK').catch(()=>undefined);await writeFile(resolve(directory,'failure.json'),JSON.stringify({state:'failure',at:new Date().toISOString(),reason:'备份集未完成，检查受保护运行日志'}),{flag:'wx',mode:0o600});throw error;}finally{client.release();}
}
export async function readManifest(directory:string,publicKey:KeyObject){const bytes=await readFile(resolve(directory,'manifest.json'));if(!verify(null,bytes,publicKey,await readFile(resolve(directory,'manifest.sig'))))throw new Error('invalid manifest signature');return {manifest:manifestSchema.parse(JSON.parse(bytes.toString())),digest:hash(bytes)};}
export async function verifyBackupSet(directory:string,key:Buffer,publicKey:KeyObject,allowIncomplete=false){
 const {manifest,digest}=await readManifest(directory,publicKey);if(!allowIncomplete){const complete=JSON.parse(await readFile(resolve(directory,'complete.json'),'utf8'));if(complete.digest!==digest)throw new Error('incomplete backup set');}const contents=new Map<string,Buffer>();
 for(const file of manifest.files){const data=await readFile(resolve(directory,file.name));if(data.length!==file.encryptedBytes||hash(data)!==file.sha256)throw new Error('backup checksum mismatch');const plain=decrypt(data,key);if(plain.length!==file.bytes)throw new Error('backup size mismatch');if(contents.has(file.logicalName))throw new Error('duplicate logical file');contents.set(file.logicalName,plain);}
 const raw=contents.get('database.json');if(!raw)throw new Error('missing database');const database=JSON.parse(raw.toString()) as DatabaseDump;
 if(database.migrations.some(m=>manifest.migrations.find(entry=>entry.name===m.name)?.sha256!==hash(m.sql)))throw new Error('migration checksum mismatch');
 return {manifest,digest,database,contents};
}
const receiptSchema=z.object({backupSetId:z.string().uuid(),manifestDigest:z.string().regex(/^[a-f0-9]{64}$/),verifiedAt:z.string().datetime(),fileCount:z.number().int().positive(),bytes:z.number().int().nonnegative(),device:filename,result:z.literal('success')}).strict();
export async function recordMacReceipt(root:string,raw:unknown,publicKey:KeyObject){
 const receipt=receiptSchema.parse(raw);if(new Date(receipt.verifiedAt).getTime()>Date.now()+300000)throw new Error('receipt clock invalid');
 const directory=resolve(root,receipt.backupSetId),{manifest,digest}=await readManifest(directory,publicKey);const complete=JSON.parse(await readFile(resolve(directory,'complete.json'),'utf8'));
 if(complete.digest!==digest||receipt.manifestDigest!==digest||receipt.fileCount!==manifest.files.length||receipt.bytes!==manifest.files.reduce((n,f)=>n+f.bytes,0))throw new Error('receipt does not match completed backup');
 const receiptRoot=resolve(root,'receipts');await mkdir(receiptRoot,{recursive:true,mode:0o700});const path=resolve(receiptRoot,`${receipt.backupSetId}-${receipt.device}.json`);
 const record={...receipt,snapshotAt:manifest.snapshotAt,receivedAt:new Date().toISOString()};
 try{await writeFile(path,JSON.stringify(record),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;const old=JSON.parse(await readFile(path,'utf8'));if(old.manifestDigest!==digest)throw new Error('conflicting receipt',{cause:e});}
 return record;
}
export async function latestReceipt(root:string,publicKey:KeyObject){
 let files:string[];try{files=await readdir(resolve(root,'receipts'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 const valid=[];for(const name of files){if(!name.endsWith('.json'))continue;const raw=JSON.parse(await readFile(resolve(root,'receipts',name),'utf8'));const receipt=receiptSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key])=>!['receivedAt','snapshotAt'].includes(key))));const {manifest,digest}=await readManifest(resolve(root,receipt.backupSetId),publicKey);if(digest!==receipt.manifestDigest)throw new Error('invalid stored receipt');valid.push({...receipt,snapshotAt:manifest.snapshotAt,receivedAt:String(raw.receivedAt)});}
 return valid.sort((a,b)=>b.snapshotAt.localeCompare(a.snapshotAt))[0]??null;
}
