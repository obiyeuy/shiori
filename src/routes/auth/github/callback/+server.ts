import {hashToken} from '$lib/server/auth/session';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateGithub,bindGithubOwner } from '$lib/server/auth/service.js';
import { getDb } from '$lib/server/db/client.js';
import { runtimeConfigFromEnv } from '$lib/server/config.js';
import { consumeOAuth, githubIdentity } from '$lib/server/auth/oauth.js';
import { safeReturnPath } from '$lib/server/auth/csrf.js';
export const GET:RequestHandler=async({url,cookies,locals})=>{
 const config=runtimeConfigFromEnv();if(!config.github)throw error(503,'GitHub 登录尚未配置');
 const state=url.searchParams.get('state') ?? '';const saved=cookies.get('oauth_state') ?? '';const next=safeReturnPath(cookies.get('oauth_next') ?? null);
 cookies.delete('oauth_state',{path:'/auth/github'});cookies.delete('oauth_next',{path:'/auth/github'});
 try{
  const binding=(await getDb().query('SELECT binding_session_id FROM oauth_attempts WHERE state_digest=$1',[await hashToken(state)])).rows[0]?.binding_session_id;
  const verifier=await consumeOAuth(getDb(),state,saved);
  const id=await githubIdentity(config,url,state,verifier);
  if(binding){if(!locals.owner||locals.owner.sessionId!==binding)throw new Error('binding session mismatch');await bindGithubOwner(getDb(),id,config.github.ownerId,locals.owner);}
  else {const session=await authenticateGithub(getDb(),id,config.github.ownerId);
  cookies.set(config.sessionCookieName,session.token,{path:'/',httpOnly:true,secure:config.publicSiteUrl.startsWith('https:'),sameSite:'lax',maxAge:604800});}
 }catch{throw error(401,'GitHub 登录失败，请从登录页重新尝试');}
 throw redirect(303,next);
};
