import {createDbPool} from '../src/lib/server/db/client.js';
import {PublicationService} from '../src/lib/server/publish/service.js';
import {runtimeConfigFromEnv} from '../src/lib/server/config.js';
const pool=createDbPool();const service=new PublicationService(pool,runtimeConfigFromEnv().mediaRoot);
let stop=false;let timer:ReturnType<typeof setTimeout>|undefined;let wake:(()=>void)|undefined;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop=true;clearTimeout(timer);wake?.();});
try{do{
 try{const report=await service.scanDueSchedules();console.log(JSON.stringify({at:new Date().toISOString(),...report}));}
 catch{console.error('排期扫描失败，下一轮重试');await pool.query("INSERT INTO operation_status(key,event_at,collected_at,last_failure_at,state) VALUES('schedule-scan',now(),now(),now(),'failure') ON CONFLICT(key) DO UPDATE SET event_at=now(),collected_at=now(),last_failure_at=now(),state='failure'").catch(()=>undefined);}
 if(process.argv.includes('--once'))break;
 if(!stop)await new Promise<void>(r=>{wake=r;timer=setTimeout(r,30_000);});
}while(!stop);}finally{await pool.end();}
