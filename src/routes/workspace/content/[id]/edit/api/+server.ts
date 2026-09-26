import {json} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {ContentRepository} from '$lib/server/content/repository';
import {EditorService} from '$lib/server/content/editor';
import {renderMarkdown} from '$lib/server/markdown/render';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {RequestHandler} from './$types';
export const POST:RequestHandler=async event=>{
 requireOwner(event);const id=event.params.id;const editor=new EditorService(getDb());
 try{
  if(Number(event.request.headers.get('content-length'))>2*1024*1024)return json({error:'请求过大'},{status:413});
  const input=await event.request.json();
  if(input.action==='preview')return json(await renderMarkdown(String(input.body??''),'preview'));
  if(input.action==='snapshot')return json({versionId:await editor.snapshot(id,input.revision,'manual')});
  if(input.action==='restore'){const result=await editor.restoreVersion(id,input.versionId,input.revision);return json(result,{status:'kind'in result?409:200});}
  if(input.action==='save'){
   const result=await new ContentRepository(getDb()).saveDraft(id,input.patch,input.revision);
   return json({...result,savedAt:new Date().toISOString()},{status:'kind'in result?409:200});
  }
  return json({error:'未知操作'},{status:400});
 }catch(e){return json({error:e instanceof Error?e.message:'保存失败'},{status:400});}
};
