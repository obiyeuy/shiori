import { timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import * as oauth from 'oauth4webapi';
import { createSessionToken, hashToken } from './session.js';
import type { RuntimeConfig } from '../config.js';
const server={issuer:'https://github.com',authorization_endpoint:'https://github.com/login/oauth/authorize',token_endpoint:'https://github.com/login/oauth/access_token'};
export async function beginOAuth(pool:Pool,bindingSessionId:string|null=null):Promise<{state:string;challenge:string}>{
 const state=createSessionToken();const verifier=oauth.generateRandomCodeVerifier();
 await pool.query("INSERT INTO oauth_attempts(state_digest,verifier,binding_session_id,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[await hashToken(state),verifier,bindingSessionId]);
 return {state,challenge:await oauth.calculatePKCECodeChallenge(verifier)};
}
export async function consumeOAuth(pool:Pool,state:string,cookie:string):Promise<string>{
 if(!/^[a-f0-9]{64}$/.test(state)||state.length!==cookie.length||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))throw new Error('invalid OAuth state');
 const {rows}=await pool.query("UPDATE oauth_attempts SET consumed_at=now() WHERE state_digest=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING verifier",[await hashToken(state)]);
 if(!rows[0])throw new Error('invalid or expired OAuth state');return rows[0].verifier;
}
export function githubAuthorization(config:RuntimeConfig,state:string,challenge:string):string{
 if(!config.github)throw new Error('OAuth not configured');
 const url=new URL(server.authorization_endpoint);
 url.search=new URLSearchParams({client_id:config.github.clientId,redirect_uri:config.publicSiteUrl+'/auth/github/callback',scope:'read:user',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();return url.href;
}
export async function githubIdentity(config:RuntimeConfig,callback:URL,state:string,verifier:string,transport:typeof fetch=fetch):Promise<string>{
 if(!config.github)throw new Error('OAuth not configured');
 const client={client_id:config.github.clientId};
 const params=oauth.validateAuthResponse(server,client,callback,state);
 const response=await oauth.authorizationCodeGrantRequest(server,client,oauth.ClientSecretPost(config.github.clientSecret),params,config.publicSiteUrl+'/auth/github/callback',verifier,{
  [oauth.customFetch]:(url,options)=>transport(url,{...options,signal:AbortSignal.timeout(10000),headers:{...Object.fromEntries(new Headers(options?.headers)),accept:'application/json'}})
 });
 const token=await oauth.processAuthorizationCodeResponse(server,client,response);
 const identity=await transport('https://api.github.com/user',{headers:{authorization:`Bearer ${token.access_token}`,accept:'application/vnd.github+json','user-agent':'personal-site'},signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!identity.ok)throw new Error('GitHub identity lookup failed');
 const body=await identity.json() as {id?:unknown};
 if(typeof body.id!=='number'||!Number.isSafeInteger(body.id)||body.id<=0)throw new Error('invalid GitHub numeric identity');return String(body.id);
}
