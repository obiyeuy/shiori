import { verifyCsrf } from './session.js';
export function requireSameOrigin(origin:string|null,trustedOrigin:string):void{
 if(!verifyCsrf(origin,trustedOrigin))throw new Error('csrf validation failed');
}
export function safeReturnPath(value:string|null):string{
 if(!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value))return '/workspace';
 try{
  const decoded=decodeURIComponent(value);
  if(decoded.startsWith('//')||/[\\\u0000-\u0020%]/.test(decoded))return '/workspace';
  const url=new URL(value,'https://local.invalid');
  return url.origin==='https://local.invalid' && /^\/workspace(?:\/|$)/.test(url.pathname)?url.pathname+url.search+url.hash:'/workspace';
 }catch{return '/workspace';}
}
