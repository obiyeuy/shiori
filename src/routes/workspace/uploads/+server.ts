import {json} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {runtimeConfigFromEnv} from '$lib/server/config';
import {MediaService} from '$lib/server/media/service';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {RequestHandler} from './$types';
export const POST:RequestHandler=async event=>{
 requireOwner(event);const media=new MediaService(getDb(),runtimeConfigFromEnv().mediaRoot);
 try{
  if(event.url.searchParams.has('retry')){const key=event.url.searchParams.get('retry')!;await media.process(key);return json(await media.get(key));}
  if((await media.capacity()).decision==='stop')return json({error:'存储容量不足或未知，已暂停新增媒体'},{status:507});
  const max=100*1024*1024;const length=Number(event.request.headers.get('content-length'));
  if(length>max)return json({error:'最大 100 MiB'},{status:413});
  const reader=event.request.body?.getReader();if(!reader)return json({error:'文件为空'},{status:400});
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();return json({error:'最大 100 MiB'},{status:413});}chunks.push(value);}
  const item=await media.stageUpload({name:decodeURIComponent(event.request.headers.get('x-file-name')??'upload'),bytes:Buffer.concat(chunks)});
  try{await media.process(item.key);}catch{/* Keep failed metadata and original; return key for explicit retry. */}
  return json(await media.get(item.key),{status:201});
 }catch(e){return json({error:e instanceof Error?e.message:'上传失败'},{status:400});}
};
