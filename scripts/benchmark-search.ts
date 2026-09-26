import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {cpus,platform,release} from 'node:os';
import {testDatabase} from '../tests/helpers/database.js';
import {searchPublic} from '../src/lib/server/search/query.js';
const measurements=[];
for(const count of [1000,10000]){
 const db=await testDatabase();
 try{
  const client=await db.connect();
  try{await client.query('BEGIN');
   for(let i=0;i<count;i++){
    const id=randomUUID(),version=randomUUID(),title=`混合文档 PostgreSQL ${i}`,body=('中文内容 English text database 代码片段 '.repeat(110))+` unique${i}`;
    const payload={title,body,slug:`bench-${i}`};
    await client.query("INSERT INTO content_items(id,type,first_published_at) VALUES($1,'article',now())",[id]);
    await client.query('INSERT INTO versions(id,content_id,revision,payload,published_at) VALUES($1,$2,1,$3,now())',[version,id,payload]);
    await client.query('UPDATE content_items SET public_version_id=$2 WHERE id=$1',[id,version]);
    await client.query("INSERT INTO public_content(content_id,version_id,type,slug,title,summary,body_text,rendered_html,payload,published_at,rss_id) VALUES($1,$2,'article',$3,$4,'混合摘要',$5,'',$6,now(),$7)",[id,version,payload.slug,title,body,payload,`urn:uuid:${id}`]);
   }
   await client.query('COMMIT');
  }finally{client.release();}
  for(const indexed of [false,true]){
   if(indexed){await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public');for(const field of ['search_title','search_summary','search_body'])await db.query(`CREATE INDEX bench_${field}_trgm ON public_content USING gin (${field} public.gin_trgm_ops)`);}
   await db.query('ANALYZE');
   for(const query of ['PostgreSQL','中文内容','unique997','不存在的词','%','PostgreSQL database']){
    const timings=[];let errors=0;
    for(let run=0;run<12;run++){const start=performance.now();const result=await searchPublic(db,{q:query});const duration=performance.now()-start;if(result.error)errors++;if(run>1)timings.push(duration);}
    timings.sort((a,b)=>a-b);const row={count,indexed,query,p95ms:Math.round(timings[Math.ceil(timings.length*.95)-1]),errors};measurements.push(row);console.log(row);
   }
  }
 }finally{await db.end();}
}
await writeFile('.local/search-benchmark.json',JSON.stringify({hardware:cpus()[0].model,platform:platform(),release:release(),network:'127.0.0.1:55432',repetitions:10,warmup:2,measurements},null,2));
