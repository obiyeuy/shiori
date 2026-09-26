import type {Pool} from 'pg';
export async function workspaceList(pool:Pool,kind:'media'|'schedules',page=1){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('无效页码');
 const table=kind==='media'?'media':'schedules',order=kind==='media'?'created_at DESC,key':"CASE status WHEN 'failed' THEN 0 WHEN 'retrying' THEN 1 ELSE 2 END,run_at,id";
 const {rows}=await pool.query(`SELECT (SELECT count(*) FROM ${table}) total,COALESCE((SELECT json_agg(items) FROM (SELECT * FROM ${table} ORDER BY ${order} LIMIT 20 OFFSET $1) items),'[]') items`,[(page-1)*20]);
 return {page,total:Number(rows[0].total),items:rows[0].items as Record<string,string|number|null>[]};
}
