import {it,expect} from 'vitest';import {exportDiscussions} from '../../src/lib/server/backup/giscus.js';
it('paginates discussions, comments and replies and refuses incomplete exports',async()=>{
 const requests:unknown[]=[];const transport=async(_url:unknown,options:any)=>{const body=JSON.parse(options.body);requests.push(body);let data;if(body.query.includes('repository('))data={repository:{discussions:{nodes:body.variables.cursor?[{id:'d2'}]:[{id:'d1'}],pageInfo:{hasNextPage:!body.variables.cursor,endCursor:'next'}}}};else if(body.query.includes('comments('))data={node:{comments:{nodes:[{id:'c'+body.variables.id}],pageInfo:{hasNextPage:false}}}};else data={node:{replies:{nodes:[],pageInfo:{hasNextPage:false}}}};return Response.json({data});};
 const result=await exportDiscussions({owner:'owner',repo:'repo',token:'test',transport:transport as typeof fetch});expect(result.discussions).toHaveLength(2);expect(result.pages).toBe(6);expect(requests).toHaveLength(6);
 await expect(exportDiscussions({owner:'owner',repo:'repo',token:'test',transport:async()=>new Response('',{status:429})})).rejects.toThrow('rate limited');
});
