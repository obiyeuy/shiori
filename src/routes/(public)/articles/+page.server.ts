import {getPublicListing,publicTags} from '$lib/server/public-queries';
import {getDb} from '$lib/server/db/client';
import {error} from '@sveltejs/kit';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async({url})=>{
 const tags=await publicTags(getDb()),selected=[...new Set(url.searchParams.getAll('tag'))];
 const page=Number(url.searchParams.get('page')??1);
 if(!Number.isSafeInteger(page)||page<1||page>10000||selected.some(id=>!tags.some(t=>t.id===id)))error(400,'筛选条件或页码无效');
 return {type:'article',tags,selected,...await getPublicListing(getDb(),'article',page,selected)};
};
