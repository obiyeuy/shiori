import type {Pool} from 'pg';
export async function siteIdentity(pool:Pool){
 const banner=(await pool.query("SELECT value FROM site_settings WHERE key='banner'")).rows[0]?.value as {desktop:string|null;mobile:string|null;x:number;y:number;credit:string;source:string}|undefined;
 const raw=(await pool.query("SELECT value FROM site_settings WHERE key='identity'")).rows[0]?.value;
 const status=typeof raw?.status?.text==='string'&&raw.status.text.trim()?{text:raw.status.text.trim().slice(0,120),updatedAt:typeof raw.status.updatedAt==='string'&&Number.isFinite(Date.parse(raw.status.updatedAt))?raw.status.updatedAt:null}:null;
 const socialLinks: {label:string;url:string}[]=Array.isArray(raw?.socialLinks)?raw.socialLinks.filter((link:unknown):link is {label:string;url:string}=>{if(!link||typeof link!=='object')return false;const l=link as Record<string,unknown>;if(typeof l.label!=='string'||!l.label.trim()||typeof l.url!=='string')return false;try{return ['https:','http:'].includes(new URL(l.url).protocol);}catch{return false;}}).slice(0,5).map((l:{label:string;url:string})=>({label:l.label.trim(),url:l.url})):[];
 return {status,socialLinks,banner:banner??null,siteName:typeof raw?.siteName==='string'?raw.siteName:'个人综合站',intro:typeof raw?.intro==='string'?raw.intro:'这里整理文章与笔记，记录近况，分享作品、工具和有用的资源。'};
}
