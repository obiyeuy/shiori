import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireOwner } from '$lib/server/auth/require-owner.js';
import { reauthenticate } from '$lib/server/auth/service.js';
import { getDb } from '$lib/server/db/client.js';
import { allowLogin } from '$lib/server/auth/rate-limit.js';
import { runtimeConfigFromEnv } from '$lib/server/config.js';
export const POST:RequestHandler=async(event)=>{
 const owner=requireOwner(event);
 if(!await allowLogin(getDb(),event.getClientAddress(),'reauthenticate',10,runtimeConfigFromEnv().sessionSecret))throw error(429,'请稍后重试');
 const form=await event.request.formData();
 try{await reauthenticate(getDb(),owner,String(form.get('password') ?? ''));}catch{throw error(401,'重新认证失败');}
 return json({ok:true});
};
