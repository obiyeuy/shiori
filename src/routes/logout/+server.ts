import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db/client.js';
import { runtimeConfigFromEnv } from '$lib/server/config.js';
import { revokeSession } from '$lib/server/auth/service.js';
export const POST:RequestHandler=async({cookies,locals})=>{
 if(locals.owner)await revokeSession(getDb(),locals.owner.sessionId,locals.owner.userId);
 cookies.delete(runtimeConfigFromEnv().sessionCookieName,{path:'/'});throw redirect(303,'/login');
};
