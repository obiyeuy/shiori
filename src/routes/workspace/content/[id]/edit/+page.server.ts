import {getDb} from '$lib/server/db/client';
import {EditorService} from '$lib/server/content/editor';
import {requireOwner} from '$lib/server/auth/require-owner';
import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async event=>{
 requireOwner(event);const db=getDb();const editor=new EditorService(db);
 try{return {id:event.params.id,...await editor.read(event.params.id),history:await editor.history(event.params.id),tags:(await db.query('SELECT id,name FROM tags ORDER BY name')).rows as {id:string;name:string}[],series:(await db.query('SELECT s.name FROM series s JOIN series_members m ON m.series_id=s.id WHERE m.content_id=$1',[event.params.id])).rows[0]?.name??null};}catch{throw error(404,'内容不存在');}
};
