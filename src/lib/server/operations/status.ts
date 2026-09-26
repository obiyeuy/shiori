import type { OperationalStatus, OperationalState } from '../content/types.js';
const states:OperationalState[]=['unconfigured','no-record','running','success','failure','stale','read-failure','unknown'];
export function summarizeOperation(record:unknown,now=new Date(),freshForMs=26*3600000):OperationalStatus{
 const empty={state:'no-record' as OperationalState,eventAt:null,collectedAt:null,lastSuccessAt:null,lastFailureAt:null,detail:null};
 if(record===null)return empty;
 if(typeof record!=='object'||!record)return {...empty,state:'read-failure'};
 const value=record as Record<string,unknown>;
 if(!states.includes(value.state as OperationalState))return {...empty,state:'read-failure'};
 const result:OperationalStatus={...empty,state:value.state as OperationalState};
 for(const key of ['eventAt','collectedAt','lastSuccessAt','lastFailureAt'] as const){
  if(value[key]!=null){const date=new Date(String(value[key]));if(!Number.isFinite(+date)||+date>+now)return {...empty,state:'read-failure'};result[key]=date;}
 }
 if(result.state==='success' && (!result.eventAt||!result.collectedAt))return {...result,state:'unknown'};
 if(result.state==='success' && ((result.eventAt && +now-+result.eventAt>freshForMs)||(result.collectedAt && +now-+result.collectedAt>freshForMs)))result.state='stale';
 if(result.state==='running' && result.eventAt && +now-+result.eventAt>2*3600000)result.state='unknown';
 return result;
}
/** P0 default provider; P4 registers record readers. Absence is never success. */
export async function getOperationalStatus(_now=new Date()):Promise<OperationalStatus>{
 return {state:'unconfigured',eventAt:null,collectedAt:null,lastSuccessAt:null,lastFailureAt:null,detail:null};
}
