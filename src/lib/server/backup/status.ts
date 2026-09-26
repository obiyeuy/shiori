import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {summarizeOperation} from '../operations/status.js';import type {OperationalStatus} from '../content/types.js';
export const streams=['server-backup','mac-receipt','giscus-export','storage'] as const;export type StatusStream=typeof streams[number];
export type StatusRecord={state:'running'|'success'|'failure';eventAt:string;collectedAt:string;detail?:string;backupSetId?:string};
export async function writeStatus(root:string,stream:StatusStream,record:StatusRecord){if(!streams.includes(stream))throw new Error('invalid status stream');await mkdir(resolve(root,stream),{recursive:true,mode:0o750});await writeFile(resolve(root,stream,`${Date.now()}-${randomUUID()}.json`),JSON.stringify(record),{flag:'wx',mode:0o640});}
export async function readStatus(root:string|undefined,stream:StatusStream,now=new Date()):Promise<OperationalStatus>{
 const empty:OperationalStatus={state:'unconfigured',eventAt:null,collectedAt:null,lastSuccessAt:null,lastFailureAt:null,detail:null};if(!root)return empty;
 try{const files=(await readdir(resolve(root,stream))).filter(name=>/^[0-9]+-[a-f0-9-]+\.json$/.test(name));if(!files.length)return {...empty,state:'no-record'};
  const records:StatusRecord[]=[];for(const name of files){const raw=JSON.parse(await readFile(resolve(root,stream,name),'utf8')) as StatusRecord;if(!['running','success','failure'].includes(raw.state)||!Number.isFinite(Date.parse(raw.eventAt))||!Number.isFinite(Date.parse(raw.collectedAt))||Date.parse(raw.eventAt)>+now||Date.parse(raw.collectedAt)>+now)throw new Error('invalid status record');records.push(raw);}
  records.sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt));const newest=records[0];const success=records.filter(r=>r.state==='success').sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt))[0];const failure=records.find(r=>r.state==='failure');
  const selected=stream==='mac-receipt'&&newest.state==='success'&&success?{...success,collectedAt:newest.collectedAt}:newest;
  const status=summarizeOperation({...selected,lastSuccessAt:success?.eventAt,lastFailureAt:failure?.eventAt},now,stream==='storage'?300000:26*3600000);status.detail=typeof selected.detail==='string'?selected.detail.slice(0,500):null;return status;
 }catch(e){return {...empty,state:(e as NodeJS.ErrnoException).code==='ENOENT'?'no-record':'read-failure'};}
}
