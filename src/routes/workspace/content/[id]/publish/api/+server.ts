import {json} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {PublicationService,PreflightError} from '$lib/server/publish/service';
import {runtimeConfigFromEnv} from '$lib/server/config';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {RequestHandler} from './$types';
function service(){return new PublicationService(getDb(),runtimeConfigFromEnv().mediaRoot);}
export const GET:RequestHandler=async event=>{requireOwner(event);return json({result:await service().operationResult(event.params.id,event.url.searchParams.get('key')??'')});};
export const POST:RequestHandler=async event=>{
 requireOwner(event);
 try{
  const input=await event.request.json();
  if(input.action==='withdraw'){await service().withdrawPublication(event.params.id);return json({withdrawn:true});}
  const options={key:input.key,revision:input.revision,expectedScheduleRevision:input.expectedScheduleRevision,important:input.important===true,keepSchedule:input.keepSchedule===true};
  if(input.action==='publish')return json(await service().publishNow(event.params.id,options));
  if(input.action==='schedule')return json(await service().createSchedule(event.params.id,{...options,runAt:new Date(input.runAt)}));
  return json({error:'未知操作'},{status:400});
 }catch(e){return json({error:e instanceof Error?e.message:'发布未完成，请查询结果'},{status:e instanceof PreflightError?422:503});}
};
