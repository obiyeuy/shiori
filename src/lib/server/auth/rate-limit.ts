import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import { transaction } from '../db/transaction.js';
export async function allowLogin(pool:Pool,source:string,account='owner',limit=10,secret='test-only'):Promise<boolean>{
 // Store bounded fixed-window records, never raw client addresses or account inputs.
 const digest=(s:string)=>createHmac('sha256',secret).update(s).digest('hex');
 const keys=[`account:${digest(account)}`,`source:${digest(source)}`].sort();
 return transaction(pool,async client=>{
  let allowed=true;
  for(const key of keys){
   const {rows}=await client.query(`INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=now() THEN 1 ELSE LEAST(rate_limits.count+1,1000000) END,
    reset_at=CASE WHEN rate_limits.reset_at<=now() THEN now()+interval '15 minutes' ELSE rate_limits.reset_at END RETURNING count`,[key]);
   if(rows[0].count>limit)allowed=false;
  }
  return allowed;
 });
}
