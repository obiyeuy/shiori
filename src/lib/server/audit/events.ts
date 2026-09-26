import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
export async function audit(client:PoolClient,action:string,payload:Record<string,unknown>,userId:string|null=null){
 await client.query('INSERT INTO audit_events(id,user_id,action,payload) VALUES($1,$2,$3,$4)',[randomUUID(),userId,action,payload]);
}
