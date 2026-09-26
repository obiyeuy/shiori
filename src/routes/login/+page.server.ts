import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { authenticatePassword, AuthenticationError } from '$lib/server/auth/service.js';
import { getDb } from '$lib/server/db/client.js';
import { runtimeConfigFromEnv } from '$lib/server/config.js';
import { safeReturnPath } from '$lib/server/auth/csrf.js';
import { allowLogin } from '$lib/server/auth/rate-limit.js';
export const actions:Actions={default:async({request,cookies,url,getClientAddress})=>{
 const config=runtimeConfigFromEnv();const db=getDb();
 if(!await allowLogin(db,getClientAddress(),'owner',10,config.sessionSecret))return fail(429,{message:'尝试过于频繁，请稍后重试。'});
 const form=await request.formData();const password=String(form.get('password') ?? '');
 try{
  const session=await authenticatePassword(db,password);
  cookies.set(config.sessionCookieName,session.token,{path:'/',httpOnly:true,secure:config.publicSiteUrl.startsWith('https:'),sameSite:'lax',maxAge:604800});
 }catch(e){if(e instanceof AuthenticationError)return fail(401,{message:'账号或密码错误。'});return fail(503,{message:'登录服务暂不可用，请稍后重试。'});}
 throw redirect(303,safeReturnPath(url.searchParams.get('next')));
}};
