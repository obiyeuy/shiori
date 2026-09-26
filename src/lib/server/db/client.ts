import { Pool, type PoolConfig } from 'pg';
import { runtimeConfigFromEnv } from '../config.js';
export function createDbPool(config:PoolConfig={}):Pool{
 const runtime=runtimeConfigFromEnv();
 return new Pool({connectionString:runtime.databaseUrl,ssl:runtime.databaseSsl?{rejectUnauthorized:true}:undefined,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,...config});
}
let shared:Pool|undefined;
export function getDb():Pool{return shared ??= createDbPool();}
