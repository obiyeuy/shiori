import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import type {RequestEvent} from '@sveltejs/kit';
import {getDb} from '../db/client.js';
import {runtimeConfigFromEnv} from '../config.js';
import {MediaService} from './service.js';
export async function serveMedia(event:RequestEvent,privateRoute:boolean){
 if(privateRoute&&!event.locals.owner)return new Response('请先登录',{status:401});
 try{
  const file=await new MediaService(getDb(),runtimeConfigFromEnv().mediaRoot).authorizeMedia(privateRoute,event.params.key!,event.url.searchParams.get('variant')??'display');
  const headers:Record<string,string>={'content-type':file.mime,'x-content-type-options':'nosniff','cache-control':privateRoute?'private, no-store':'public, max-age=31536000, immutable','content-security-policy':"default-src 'none'; sandbox",'accept-ranges':'bytes','content-disposition':event.url.searchParams.get('variant')==='original'?`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name)}`:'inline'};
  let start=0;let end=file.bytes-1;let status=200;const range=event.request.headers.get('range');
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416,headers:{'content-range':`bytes */${file.bytes}`}});start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(start>end||start>=file.bytes)return new Response(null,{status:416,headers:{'content-range':`bytes */${file.bytes}`}});status=206;headers['content-range']=`bytes ${start}-${end}/${file.bytes}`;}
  headers['content-length']=String(end-start+1);
  return new Response(event.request.method==='HEAD'?null:Readable.toWeb(createReadStream(file.path,{start,end})) as ReadableStream,{status,headers});
 }catch{return new Response('媒体不存在或无法读取',{status:404,headers:{'cache-control':'no-store'}});}
}
