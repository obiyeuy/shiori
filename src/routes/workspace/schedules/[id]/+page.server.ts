import {error,fail} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {PublicationService} from '$lib/server/publish/service';
import {runtimeConfigFromEnv} from '$lib/server/config';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {PageServerLoad,Actions} from './$types';
export const load:PageServerLoad=async event=>{requireOwner(event);const s=(await getDb().query('SELECT s.*,v.payload,v.revision AS content_revision FROM schedules s JOIN versions v ON v.id=s.version_id WHERE s.id=$1',[event.params.id])).rows[0];if(!s)throw error(404);return {schedule:s};};
export const actions:Actions={default:async event=>{
 requireOwner(event);const f=await event.request.formData();const action=String(f.get('action'));
 if(!['cancel','retry','time','version'].includes(action))return fail(400,{error:'未知操作'});
 try{return await new PublicationService(getDb(),runtimeConfigFromEnv().mediaRoot).updateSchedule(event.params.id,Number(f.get('revision')),action as 'cancel'|'retry'|'time'|'version',action==='time'?new Date(String(f.get('time'))+'+08:00'):Number(f.get('contentRevision')));}catch(e){return fail(409,{error:e instanceof Error?e.message:'操作失败'});}
}};
