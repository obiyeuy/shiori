import type {Pool} from 'pg';
import {getOperationalStatus,summarizeOperation} from '../operations/status.js';
import type {OperationalStatus} from '../content/types.js';
async function readRecordedStatus(pool:Pool,key:string,now:Date,freshForMs:number,unconfigured=false):Promise<OperationalStatus>{
 try{
  const row=(await pool.query('SELECT * FROM operation_status WHERE key=$1',[key])).rows[0];
  if(!row&&unconfigured)return {state:'unconfigured',eventAt:null,collectedAt:null,lastSuccessAt:null,lastFailureAt:null,detail:null};
  const status=summarizeOperation(row?{state:row.state,eventAt:row.event_at,collectedAt:row.collected_at,lastSuccessAt:row.last_success_at,lastFailureAt:row.last_failure_at}:null,now,freshForMs);
  if(key==='storage'&&row?.detail){const detail=row.detail;if(Number.isSafeInteger(detail.freeBytes)&&Number.isSafeInteger(detail.totalBytes)&&detail.freeBytes>=0&&detail.totalBytes>0&&detail.freeBytes<=detail.totalBytes)status.detail=`剩余 ${detail.freeBytes} / ${detail.totalBytes} 字节（${(detail.freeBytes/detail.totalBytes*100).toFixed(1)}%）`;else status.state='read-failure';}
  return status;
 }catch{return summarizeOperation(undefined,now);}
}
export async function getWorkspaceOverview(pool:Pool,now=new Date()){
 const counts=(await pool.query(`SELECT count(*) FILTER(WHERE NOT archived) total,count(*) FILTER(WHERE public_version_id IS NULL AND NOT archived) drafts,count(*) FILTER(WHERE public_version_id IS NOT NULL) published FROM content_items`)).rows[0];
 const overdue=(await pool.query("SELECT count(*) FROM schedules WHERE status IN ('pending','retrying','failed','running') AND run_at<$1",[now])).rows[0].count;
 const [scanner,backups,remote,comments,storage]=await Promise.all([readRecordedStatus(pool,'schedule-scan',now,120000),getOperationalStatus(now),readRecordedStatus(pool,'mac-receipt',now,26*3600000,true),readRecordedStatus(pool,'giscus-export',now,26*3600000,true),readRecordedStatus(pool,'storage',now,300000,true)]);
 const drafts=(await pool.query<{id:string;title:string;updated_at:Date}>("SELECT c.id,COALESCE(d.payload->>'title','未命名内容') title,d.updated_at FROM drafts d JOIN content_items c ON c.id=d.content_id WHERE NOT c.archived ORDER BY d.updated_at DESC LIMIT 5")).rows;
 const upcoming=(await pool.query<{id:string;content_id:string;status:string;run_at:Date}>("SELECT id,content_id,status,run_at FROM schedules WHERE status IN ('pending','retrying','failed','running') AND (status='failed' OR run_at<$1::timestamptz+interval '24 hours') ORDER BY (status='failed') DESC,run_at LIMIT 10",[now])).rows;
 const services=(await pool.query<{id:string;name:string;url:string;status:string;status_updated_at:Date}>('SELECT * FROM service_links ORDER BY name LIMIT 5')).rows;
 return {drafts,upcoming,services,counts:{total:Number(counts.total),drafts:Number(counts.drafts),published:Number(counts.published),overdue:Number(overdue)},scanner,backups,remote,comments,storage};
}
