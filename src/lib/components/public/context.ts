import type {PublicRow} from '$lib/content/public';

export type ContextKind='home'|'listing'|'detail'|'collection'|'search'|'static';
export type NavigationItem=Pick<PublicRow,'content_id'|'type'|'slug'|'title'|'summary'>;
export type DetailSeries={id:string;name:string;total:number;previous:NavigationItem|null;next:NavigationItem|null};
export type ContextInput={series?:DetailSeries|null;related?:NavigationItem[];summary?:string;updates?:NavigationItem[]};
export type ContextModel={schedule:boolean;groups:('series'|'related'|'summary'|'updates')[];series:DetailSeries|null;related:NavigationItem[];summary:string|null;updates:NavigationItem[]};

export function buildContext(kind:ContextKind,input:ContextInput={}):ContextModel{
 const related=(input.related??[]).filter(item=>item.content_id).filter((item,index,all)=>all.findIndex(other=>other.content_id===item.content_id)===index);
 const series=input.series??null;
 const excluded=new Set([series?.previous?.content_id,series?.next?.content_id].filter(Boolean));
 const cleanRelated=related.filter(item=>!excluded.has(item.content_id));
 const updates=(input.updates??[]).filter((item,index,all)=>all.findIndex(other=>other.content_id===item.content_id)===index);
 const groups:ContextModel['groups']=[];
 if(series)groups.push('series');if(cleanRelated.length)groups.push('related');if(input.summary?.trim())groups.push('summary');if(updates.length)groups.push('updates');
 return {schedule:kind==='home',groups,series,related:cleanRelated,summary:input.summary?.trim()||null,updates};
}
