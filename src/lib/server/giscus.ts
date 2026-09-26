import type {Pool} from 'pg';
export type GiscusConfig={repo:string;repoId:string;categoryId:string};
export async function publicGiscusConfig(pool:Pool):Promise<GiscusConfig|null>{
 const raw=(await pool.query("SELECT value FROM site_settings WHERE key='giscus'")).rows[0]?.value;
 if(!raw||raw.enabled!==true||typeof raw.repo!=='string'||! /^[\w.-]+\/[\w.-]+$/.test(raw.repo)||typeof raw.repoId!=='string'||typeof raw.categoryId!=='string')return null;
 if(!/^[\w=-]{1,200}$/.test(raw.repoId)||! /^[\w=-]{1,200}$/.test(raw.categoryId))return null;
 return {repo:raw.repo,repoId:raw.repoId,categoryId:raw.categoryId};
}
