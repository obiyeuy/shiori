import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';import {chromium,type BrowserContext,type Page} from '@playwright/test';import type {Pool} from 'pg';
import {testDatabase} from '../helpers/database.js';import {initializeOwner} from '../../src/lib/server/auth/service.js';import {ContentRepository} from '../../src/lib/server/content/repository.js';
let db:Pool,server:ChildProcess,browser:BrowserContext,page:Page;let log='';const base='http://127.0.0.1:5203';const errors:string[]=[];
beforeAll(async()=>{
 db=await testDatabase();await initializeOwner(db,{password:'workspace-browser-password'});const repo=new ContentRepository(db);for(const title of ['第一篇','第二篇']){const id=await repo.createContent('note');await repo.saveDraft(id,{title},0);}
 const root=process.env.SITE_VERIFY_ROOT?resolve(process.env.SITE_VERIFY_ROOT,'workspace-browser'):undefined;if(root)await mkdir(root,{recursive:true});
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5203','--strictPort'],{env:{...process.env,...(root?{SITE_VERIFY_ROOT:root}:{}),PGOPTIONS:db.options.options,NODE_ENV:'development',PUBLIC_SITE_URL:base,SESSION_SECRET:'browser-test-only-session-secret-1234567890'},stdio:'pipe'});server.stdout?.on('data',x=>{log+=x;});server.stderr?.on('data',x=>{log+=x;});
 for(let i=0;i<200;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(base+'/login')).ok)break;}catch{/* startup */}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launchPersistentContext(`.local/browser-profiles/p3-${randomUUID()}`,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000}});page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/login');await page.getByLabel('站长密码',{exact:true}).fill('workspace-browser-password');await page.getByRole('button',{name:/登录工作台/}).click();await page.waitForURL('**/workspace');
},60000);
afterAll(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await new Promise<void>(r=>server.once('exit',()=>r()));}await db?.end();});
it('protects every workspace page and renders meaningful empty operational states',async()=>{
 for(const route of ['content','media','schedules','tags','series','comments','services','settings','security']){expect((await fetch(base+'/workspace/'+route,{redirect:'manual'})).status).toBe(303);await page.goto(base+'/workspace/'+route);expect(await page.locator('h1').count()).toBe(1);}
 await page.goto(base+'/workspace');await page.getByText('未配置',{exact:true}).first().waitFor();await page.getByText('尚无记录',{exact:true}).waitFor();
 const response=await page.request.post(base+'/workspace/tags',{headers:{origin:'https://evil.example'},form:{name:'不应写入'}});expect(response.status()).toBe(403);
 expect((await db.query("SELECT count(*) FROM tags WHERE name='不应写入'")).rows[0].count).toBe('0');expect(errors).toEqual([]);
});
it('saves forms, retains invalid inputs and reorders series using accessible buttons',async()=>{
 await page.goto(base+'/workspace/tags');await page.getByLabel('新标签',{exact:true}).fill('浏览器标签');await page.getByRole('button',{name:'添加标签',exact:true}).click();await page.getByText('标签已保存；公开页面使用当前名称').waitFor();
 // Exercise server-side rejection and input retention independently of native URL validation.
 await page.goto(base+'/workspace/services');await page.getByLabel('服务名称',{exact:true}).fill('私人服务');await page.getByLabel('地址',{exact:true}).fill('ftp://example.com');await page.locator('form').first().evaluate(form=>{(form as HTMLFormElement).noValidate=true});await page.getByRole('button',{name:'保存服务入口',exact:true}).click();await page.getByRole('alert').waitFor();expect(await page.getByLabel('服务名称',{exact:true}).inputValue()).toBe('私人服务');
 await page.goto(base+'/workspace/series');await page.getByLabel('系列名称',{exact:true}).fill('键盘系列');await page.getByLabel('添加文章或笔记',{exact:true}).selectOption({label:'第一篇'});await page.getByRole('button',{name:'添加成员',exact:true}).click();await page.getByLabel('添加文章或笔记',{exact:true}).selectOption({label:'第二篇'});await page.getByRole('button',{name:'添加成员',exact:true}).click();
 expect(await page.getByRole('button',{name:'上移 第一篇',exact:true}).isDisabled()).toBe(true);expect(await page.getByRole('button',{name:'下移 第二篇',exact:true}).isDisabled()).toBe(true);await page.getByRole('button',{name:'上移 第二篇',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'保存系列',exact:true}).click();await page.getByText('系列及成员顺序已保存；公开系列立即生效').waitFor().catch(async()=>{throw new Error(await page.locator('body').innerText()+' INPUTS '+JSON.stringify(await page.locator('input').evaluateAll(nodes=>nodes.map(element=>{const n=element as HTMLInputElement;return {name:n.name,value:n.value,valid:n.validity.valid,message:n.validationMessage};})))+' '+log);});
 expect((await db.query("SELECT d.payload->>'title' title FROM series_members m JOIN series s ON s.id=m.series_id JOIN drafts d ON d.content_id=m.content_id WHERE s.name='键盘系列' ORDER BY position")).rows.map(r=>r.title)).toEqual(['第二篇','第一篇']);
});
it('uses a separate mobile drawer with focus return and tolerates enlarged text',async()=>{
 await page.goto(base+'/workspace');await page.setViewportSize({width:320,height:800});await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'打开工作台导航'}).click();expect(await page.locator('dialog[open]').count()).toBe(1);await page.keyboard.press('Escape');expect(await page.getByRole('button',{name:'打开工作台导航'}).evaluate(e=>e===document.activeElement)).toBe(true);
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.superpowers/sdd/个人综合站-实施计划-P3-工作台与运行状态/workspace-mobile.png',fullPage:true});
 expect(errors).toEqual([]);
});
it('saves site identity and preserves settings when reauthentication is required',async()=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/workspace/settings');await page.getByLabel('站点名称',{exact:true}).fill('浏览器站点');await page.getByRole('button',{name:'保存站点设置',exact:true}).click();await page.getByText('站点设置已保存',{exact:true}).waitFor().catch(async()=>{throw new Error(await page.locator('body').innerText()+' SERVER '+log);});
 await page.goto(base);expect(await page.getByRole('link',{name:'浏览器站点首页',exact:true}).count()).toBe(1);
 await db.query("UPDATE sessions SET reauthenticated_at=now()-interval '11 minutes'");await page.goto(base+'/workspace/settings');await page.getByLabel('站点名称',{exact:true}).fill('保留输入');await page.getByRole('button',{name:'保存站点设置',exact:true}).click();await page.getByRole('alert').waitFor();expect(await page.getByLabel('站点名称',{exact:true}).inputValue()).toBe('保留输入');
});
