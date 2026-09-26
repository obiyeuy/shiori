import type {Pool} from 'pg';
export async function siteIdentity(pool:Pool){
 const banner=(await pool.query("SELECT value FROM site_settings WHERE key='banner'")).rows[0]?.value as {desktop:string|null;mobile:string|null;x:number;y:number;credit:string;source:string}|undefined;
 const raw=(await pool.query("SELECT value FROM site_settings WHERE key='identity'")).rows[0]?.value;
 return {banner:banner??null,siteName:typeof raw?.siteName==='string'?raw.siteName:'个人综合站',intro:typeof raw?.intro==='string'?raw.intro:'这里整理文章与笔记，记录近况，分享作品、工具和有用的资源。'};
}
