import {it,expect} from 'vitest';import {randomUUID,generateKeyPairSync,randomBytes} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {testDatabase} from '../helpers/database.js';import {createBackupSet,verifyBackupSet,recordMacReceipt,latestReceipt} from '../../src/lib/server/backup/sets.js';
const keys=generateKeyPairSync('ed25519'),encryptionKey=randomBytes(32);const root=resolve('.local/backup-tests',randomUUID());await mkdir(root,{recursive:true,mode:0o700});
it('binds encrypted database and all media to one snapshot and rejects corruption',async()=>{
 const db=await testDatabase();const media=resolve(root,'media');await mkdir(media,{mode:0o700});const key=randomUUID();await writeFile(resolve(media,'original.bin'),'private original',{mode:0o600});
 await db.query("INSERT INTO media(key,name,mime,bytes,state) VALUES($1,'orphan','application/octet-stream',16,'pending')",[key]);await db.query("INSERT INTO media_variants(media_key,variant,file_key,mime,bytes) VALUES($1,'original','original.bin','application/octet-stream',16)",[key]);
 try{const set=await createBackupSet({pool:db,mediaRoot:media,backupRoot:root,encryptionKey,signingKey:keys.privateKey,keyId:'test-key'});const verified=await verifyBackupSet(set.directory,encryptionKey,keys.publicKey);expect(verified.manifest.snapshotId).toBeTruthy();expect(verified.manifest.files.some(f=>f.logicalName==='media/original.bin')).toBe(true);expect(JSON.stringify(verified.database)).toContain('orphan');
 const ciphertext=await readFile(resolve(set.directory,'database.enc'));expect(ciphertext.includes(Buffer.from('orphan'))).toBe(false);const broken=Buffer.from(ciphertext);broken[20]^=1;await writeFile(resolve(set.directory,'database.enc'),broken);await expect(verifyBackupSet(set.directory,encryptionKey,keys.publicKey)).rejects.toThrow();
 }finally{await db.end();}
});
it('validates receipts, deduplicates and keeps the newer snapshot as recovery point',async()=>{
 const db=await testDatabase();const media=resolve(root,'empty-media');await mkdir(media,{mode:0o700});try{
 const a=await createBackupSet({pool:db,mediaRoot:media,backupRoot:root,encryptionKey,signingKey:keys.privateKey,keyId:'test-key'}),b=await createBackupSet({pool:db,mediaRoot:media,backupRoot:root,encryptionKey,signingKey:keys.privateKey,keyId:'test-key'});
 const receipt=(set:typeof a)=>({backupSetId:set.manifest.id,manifestDigest:set.digest,verifiedAt:new Date().toISOString(),fileCount:set.manifest.files.length,bytes:set.manifest.files.reduce((n,f)=>n+f.bytes,0),device:'test-mac',result:'success' as const});
 await recordMacReceipt(root,receipt(b),keys.publicKey);await recordMacReceipt(root,receipt(b),keys.publicKey);await recordMacReceipt(root,receipt(a),keys.publicKey);expect((await latestReceipt(root,keys.publicKey))?.backupSetId).toBe(b.manifest.id);
 await expect(recordMacReceipt(root,{...receipt(b),manifestDigest:'0'.repeat(64)},keys.publicKey)).rejects.toThrow();
 }finally{await db.end();}
});
it('rejects incomplete completion markers and unapplied schema changes',async()=>{
 const db=await testDatabase();const media=resolve(root,'completion-media');await mkdir(media,{mode:0o700});try{
 const set=await createBackupSet({pool:db,mediaRoot:media,backupRoot:root,encryptionKey,signingKey:keys.privateKey,keyId:'test-key'});await writeFile(resolve(set.directory,'complete.json'),JSON.stringify({digest:'invalid'}));await expect(verifyBackupSet(set.directory,encryptionKey,keys.publicKey)).rejects.toThrow('incomplete');
 await db.query("UPDATE schema_migrations SET checksum='invalid' WHERE name='0003_workspace'");await expect(createBackupSet({pool:db,mediaRoot:media,backupRoot:root,encryptionKey,signingKey:keys.privateKey,keyId:'test-key'})).rejects.toThrow('checksum');
 }finally{await db.end();}
});
