import type {Pool} from 'pg';
import {normalizeSearch,searchTerms,buildSnippet,escapeHtml} from './normalize.js';
import {publicPaths,type PublicRow} from '../../content/public.js';
export type SearchInput={q:string;type?:string[];tag?:string[];page?:number};
export type SearchPage={terms:string[];total:number|null;page:number;items:(PublicRow&{snippet:string})[];error:string|null};
export async function searchPublic(pool:Pool,input:SearchInput):Promise<SearchPage>{
 const query=normalizeSearch(input.q),terms=searchTerms(query),page=input.page??1;
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('无效页码');
 const types=[...new Set(input.type??[])],tags=[...new Set(input.tag??[])];
 if(types.some(t=>!Object.hasOwn(publicPaths,t)))throw new Error('无效内容类型');
 if(tags.length>100||tags.some(t=>! /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(t)))throw new Error('无效标签');
 if(!terms.length)return {terms,total:0,page,items:[],error:null};
 let client;
 try{client=await pool.connect();}catch{return {terms,total:null,page,items:[],error:'搜索服务暂不可用，请保留条件后重试。'};}
 try{
  await client.query('BEGIN');await client.query("SET LOCAL statement_timeout = '2s'");
  if(tags.length&&(await client.query('SELECT id FROM tags WHERE id=ANY($1::uuid[])',[tags])).rowCount!==tags.length)throw new Error('无效标签');
  // Each branch can use its optional trigram index. Escaping keeps LIKE literal.
  const patterns=terms.map(term=>'%'+term.replace(/[\\%_]/g,'\\$&')+'%');
  const candidates=terms.map((_,i)=>`p.content_id IN (
   SELECT content_id FROM public_content WHERE search_title LIKE $${i+6}
   UNION SELECT content_id FROM public_content WHERE search_summary LIKE $${i+6}
   UNION SELECT content_id FROM public_content WHERE search_body LIKE $${i+6}
   UNION SELECT p2.content_id FROM public_content p2 JOIN version_tags vt ON vt.version_id=p2.version_id JOIN tags t ON t.id=vt.tag_id WHERE lower(normalize(t.name,NFKC)) LIKE $${i+6}
  )`).join(' AND ');
  const {rows}=await client.query(`WITH documents AS MATERIALIZED (
   SELECT p.content_id,p.version_id,c.first_published_at,
    p.search_title nt,
    lower(normalize(COALESCE((SELECT string_agg(t.name,' ') FROM version_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.version_id=p.version_id),''),NFKC)) ng,
    p.search_summary ns,
    p.search_body nb
   FROM public_content p JOIN content_items c ON c.id=p.content_id AND c.public_version_id=p.version_id
   WHERE ${candidates} AND (cardinality($2::text[])=0 OR p.type=ANY($2)) AND
    (cardinality($3::uuid[])=0 OR EXISTS(SELECT 1 FROM version_tags vt WHERE vt.version_id=p.version_id AND vt.tag_id=ANY($3)))
  ), ranked AS (
   SELECT *, (SELECT count(*) FROM unnest($1::text[]) t WHERE strpos(nt,t)>0) title_score,
    (SELECT count(*) FROM unnest($1::text[]) t WHERE strpos(ng,t)>0) tag_score,
    (SELECT count(*) FROM unnest($1::text[]) t WHERE strpos(ns,t)>0) summary_score,
    (SELECT count(*) FROM unnest($1::text[]) t WHERE strpos(nb,t)>0) body_score
   FROM documents WHERE NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t WHERE strpos(nt,t)=0 AND strpos(ng,t)=0 AND strpos(ns,t)=0 AND strpos(nb,t)=0)
  ), page_rows AS (
   SELECT * FROM ranked ORDER BY title_score DESC,tag_score DESC,summary_score DESC,body_score DESC,(strpos(nt,$4)>0) DESC,first_published_at DESC,content_id LIMIT 20 OFFSET $5
  ) SELECT (SELECT count(*) FROM ranked) AS total,COALESCE((SELECT json_agg(result) FROM (SELECT p.*,r.first_published_at FROM page_rows r JOIN public_content p ON p.content_id=r.content_id ORDER BY r.title_score DESC,r.tag_score DESC,r.summary_score DESC,r.body_score DESC,(strpos(r.nt,$4)>0) DESC,r.first_published_at DESC,r.content_id) result),'[]'::json) AS items`,[terms,types,tags,query,(page-1)*20,...patterns]);
  await client.query('COMMIT');
  return {terms,total:Number(rows[0].total),page,error:null,items:rows[0].items.map((r:PublicRow)=>({...r,snippet:buildSnippet(String(r.payload.body??r.body_text),terms)||escapeHtml(r.summary)}))};
 }catch(e){await client.query('ROLLBACK').catch(()=>undefined);if(e instanceof Error&&e.message==='无效标签')throw e;return {terms,total:null,page,items:[],error:'搜索未完成，请重试或缩小查询范围。'};}
 finally{client.release();}
}
