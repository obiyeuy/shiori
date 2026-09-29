import {it,expect} from 'vitest';
import {newDb} from 'pg-mem';
import {siteIdentity} from '../../../src/lib/server/workspace/identity';
async function identity(raw:unknown){const db=newDb();db.public.none('create table site_settings(key text,value jsonb)');const {Pool}=db.adapters.createPg();const pool=new Pool();await pool.query('insert into site_settings values ($1,$2)',['identity',raw]);try{return await siteIdentity(pool);}finally{await pool.end();}}
it('omits unset personal status and social links',async()=>{const result=await identity({siteName:'Y',intro:'hello'});expect(result).toMatchObject({siteName:'Y',status:null,socialLinks:[]});});
it('only exposes named safe web links and a dated configured status',async()=>{const result=await identity({status:{text:'整理笔记',updatedAt:'2026-09-29'},socialLinks:[{label:'GitHub',url:'https://github.com/example'},{label:'bad',url:'javascript:alert(1)'},{label:'',url:'https://example.com'}]});expect(result).toMatchObject({status:{text:'整理笔记',updatedAt:'2026-09-29'},socialLinks:[{label:'GitHub',url:'https://github.com/example'}]});});
