import {error} from '@sveltejs/kit';
import {getDb} from '$lib/server/db/client';
import {EditorService} from '$lib/server/content/editor';
import {requireOwner} from '$lib/server/auth/require-owner';
import type {RequestHandler} from './$types';
export const GET:RequestHandler=async event=>{requireOwner(event);try{return new Response(await new EditorService(getDb()).exportMarkdown(event.url.searchParams.get('id')!,event.url.searchParams.get('version')??'draft'),{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="content.md"'}});}catch{throw error(404,'版本不存在');}};
