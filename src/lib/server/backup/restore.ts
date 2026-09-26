import {randomUUID} from 'node:crypto';import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {Pool} from 'pg';import type {KeyObject} from 'node:crypto';import {verifyBackupSet} from './sets.js';import {applyMigration} from '../db/migrate.js';
const order=['content_items','users','versions','drafts','url_aliases','tags','media','media_variants','series','series_members','version_tags','schedules','oauth_accounts','sessions','oauth_attempts','rate_limits','audit_events','site_settings','service_links','media_references','publication_operations','publication_events','public_content','operation_status'];
export async function runIsolatedRestore(input:{directory:string;encryptionKey:Buffer;publicKey:KeyObject;adminUrl:string;outputRoot:string}){
 const started=Date.now(),verified=await verifyBackupSet(input.directory,input.encryptionKey,input.publicKey);const url=new URL(input.adminUrl);if(url.search)throw new Error('恢复连接不允许查询参数覆盖');if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('演练仅允许本机独立数据库');
 const name='restore_'+randomUUID().replaceAll('-',''),output=resolve(input.outputRoot,name);await mkdir(output,{recursive:true,mode:0o700});
 if(verified.database.tables.some(t=>!order.includes(t.name)))throw new Error('备份含未知表，必须先升级恢复工具');
 const admin=new Pool({connectionString:input.adminUrl});try{await admin.query(`CREATE DATABASE ${name}`);}finally{await admin.end();}
 url.pathname='/'+name;const pool=new Pool({connectionString:url.href});
 try{
  for(const migration of verified.database.migrations)await applyMigration(pool,migration.name,migration.sql);
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SET CONSTRAINTS ALL DEFERRED');
   for(const table of order){const data=verified.database.tables.find(t=>t.name===table);if(!data?.rows.length)continue;const columns=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position",[table])).rows.map(r=>'"'+r.column_name+'"').join(',');await client.query(`INSERT INTO "${table}" (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::"${table}",$1::jsonb)`,[JSON.stringify(data.rows)]);}
   await client.query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,now())');await client.query('UPDATE oauth_attempts SET consumed_at=COALESCE(consumed_at,now())');await client.query("UPDATE schedules SET status='cancelled' WHERE status IN ('pending','running','retrying','failed')");await client.query("INSERT INTO site_settings(key,value) VALUES('giscus','{\"enabled\":false}') ON CONFLICT(key) DO UPDATE SET value=excluded.value");await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  const media=resolve(output,'media');await mkdir(media,{mode:0o700});
  for(const [logical,data] of verified.contents){if(!logical.startsWith('media/'))continue;const name=logical.slice(6);if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/.test(name))throw new Error('invalid restore path');await writeFile(resolve(media,name),data,{flag:'wx',mode:0o600});}
  const report={state:'success',backupSetId:verified.manifest.id,snapshotAt:verified.manifest.snapshotAt,database:name,mediaRoot:media,durationMs:Date.now()-started,missing:[],jobsEnabled:false,sessionsRevoked:true};await writeFile(resolve(output,'restore-report.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});return report;
 }catch(error){await writeFile(resolve(output,'restore-failure.json'),JSON.stringify({state:'failure',database:name,durationMs:Date.now()-started,reason:'恢复失败，隔离库与文件保留待检查'}),{flag:'wx',mode:0o600});throw error;}finally{await pool.end();}
}
