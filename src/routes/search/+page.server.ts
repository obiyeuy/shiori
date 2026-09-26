import {siteIdentity} from '$lib/server/workspace/identity';
import {searchPublic,type SearchPage} from '$lib/server/search/query';import {getDb} from '$lib/server/db/client';import {publicTags,currentPublic} from '$lib/server/public-queries';import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async({url,setHeaders})=>{
 setHeaders({'cache-control':'no-store'});const input={q:url.searchParams.get('q')??'',type:url.searchParams.getAll('type'),tag:url.searchParams.getAll('tag'),page:Number(url.searchParams.get('page')??1)};
 let result:SearchPage;try{result=await searchPublic(getDb(),input);}catch(e){result={terms:[],total:null,page:1,items:[],error:e instanceof Error?e.message:'搜索条件无效'};}
 let tags:{id:string;name:string;count:string}[]=[];let hasTools=false;
 try{tags=await publicTags(getDb());hasTools=!!(await getDb().query(`SELECT 1 FROM ${currentPublic} WHERE p.type='tool' LIMIT 1`)).rowCount;}catch{/* query error is already rendered; no invented counts */}
 return {input,result,tags,hasTools,identity:await siteIdentity(getDb()).catch(()=>({siteName:'个人综合站'}))};
};
