import {fail,redirect} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {EditorService} from '$lib/server/content/editor';
import {ContentRepository} from '$lib/server/content/repository';
import {contentTypes,type ContentType} from '$lib/server/content/types';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {Actions} from './$types';
export const actions:Actions={default:async event=>{
 requireOwner(event);const form=await event.request.formData();const type=String(form.get('type')) as ContentType;
 if(!contentTypes.includes(type))return fail(400,{error:'无效内容类型'});
 let id:string;
 try{
  if(form.get('action')==='create'){const repo=new ContentRepository(getDb());id=await repo.createContent(type);await repo.saveDraft(id,{slug:`draft-${id.slice(0,8)}`,commentsEnabled:['article','note','project'].includes(type)},0);}
  else{const file=form.get('file');if(!(file instanceof File))return fail(400,{error:'请选择 Markdown 文件'});id=(await new EditorService(getDb()).importMarkdown(Buffer.from(await file.arrayBuffer()),file.name,type)).id;}
 }catch(e){return fail(400,{error:e instanceof Error?e.message:'导入失败'});}
 throw redirect(303,`/workspace/content/${id}/edit`);
}};
