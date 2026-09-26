import {getDb} from '$lib/server/db/client';
import {EditorService} from '$lib/server/content/editor';
import {PublicationService} from '$lib/server/publish/service';
import {runtimeConfigFromEnv} from '$lib/server/config';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async event=>{
 requireOwner(event);const db=getDb();const draft=await new EditorService(db).read(event.params.id);
 return {id:event.params.id,...draft,preflight:await new PublicationService(db,runtimeConfigFromEnv().mediaRoot).runPreflight(event.params.id,draft.revision),schedule:(await db.query("SELECT id,revision,run_at,status FROM schedules WHERE content_id=$1 AND status IN ('pending','running','retrying','failed')",[event.params.id])).rows[0]??null};
};
