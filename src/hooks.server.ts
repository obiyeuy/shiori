import { error, type Handle } from '@sveltejs/kit';
import { runtimeConfigFromEnv } from './lib/server/config.js';
import { getDb } from './lib/server/db/client.js';
import { resolveSession } from './lib/server/auth/service.js';
import { verifyCsrf } from './lib/server/auth/session.js';
const privateHeaders={
 'cache-control':'private, no-store',
 'referrer-policy':'no-referrer',
 'x-content-type-options':'nosniff'
};
export const handle:Handle=async({event,resolve})=>{
 let path:string;
 try{path=event.route.id ?? decodeURI(event.url.pathname);}catch{throw error(400,'无效路径');}
 const privatePath=/^\/(workspace|preview|media\/private)(\/|$)/.test(path);
 const authPath=/^\/(login|logout|auth)(\/|$)/.test(path);
 event.locals.owner=null;
 if(!privatePath&&!authPath)return resolve(event);
 const config=runtimeConfigFromEnv();
 if(!['GET','HEAD','OPTIONS'].includes(event.request.method) && !verifyCsrf(event.request.headers.get('origin'),config.publicSiteUrl)){
  return new Response('请求来源无效',{status:403,headers:privateHeaders});
 }
 const token=event.cookies.get(config.sessionCookieName);
 if(token){
  try{event.locals.owner=await resolveSession(getDb(),token);}
  catch{return new Response('认证服务暂不可用',{status:503,headers:privateHeaders});}
 }
 if(privatePath&&!event.locals.owner){
  if(event.request.method==='GET' && path.startsWith('/workspace')){
   return new Response(null,{status:303,headers:{...privateHeaders,location:`/login?next=${encodeURIComponent(path+event.url.search)}`}});
  }
  return new Response('请先登录',{status:401,headers:privateHeaders});
 }
 const response=await resolve(event);
 // Includes route-level redirects/errors; setHeaders alone does not cover early failures.
 const secured=new Response(response.body,response);
 for(const [name,value] of Object.entries(privateHeaders))secured.headers.set(name,value);
 return secured;
};
