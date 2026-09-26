import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { beginOAuth, githubAuthorization } from '$lib/server/auth/oauth.js';
import { runtimeConfigFromEnv } from '$lib/server/config.js';
import { getDb } from '$lib/server/db/client.js';
import { allowLogin } from '$lib/server/auth/rate-limit.js';
import { safeReturnPath } from '$lib/server/auth/csrf.js';
export const GET:RequestHandler=async({cookies,url,getClientAddress})=>{
 const config=runtimeConfigFromEnv();if(!config.github)throw error(503,'GitHub 登录尚未配置');
 if(!await allowLogin(getDb(),getClientAddress(),'github',10,config.sessionSecret))throw error(429,'请稍后重试');
 const attempt=await beginOAuth(getDb());
 const options={path:'/auth/github',httpOnly:true,secure:config.publicSiteUrl.startsWith('https:'),sameSite:'lax' as const,maxAge:600};
 cookies.set('oauth_state',attempt.state,options);cookies.set('oauth_next',safeReturnPath(url.searchParams.get('next')),options);
 throw redirect(303,githubAuthorization(config,attempt.state,attempt.challenge));
};
