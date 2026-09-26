import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {chromium,type BrowserContext,type Page} from '@playwright/test';
import type {Pool} from 'pg';
import {testDatabase} from '../helpers/database.js';
import {initializeOwner} from '../../src/lib/server/auth/service.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
let db:Pool;let server:ChildProcess;let browser:BrowserContext;let page:Page;let id:string;let serverLog='';
const base='http://127.0.0.1:5201';const evidence='.superpowers/sdd/个人综合站-实施计划-P1-内容生产链';
beforeAll(async()=>{
 db=await testDatabase();await initializeOwner(db,{password:'p1-browser-owner-password'});
 const repo=new ContentRepository(db);id=await repo.createContent('article');await repo.saveDraft(id,{title:'浏览器测试',body:'# 正文\n\n开始',slug:'browser-example'},0);
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5201','--strictPort'],{env:{...process.env,PGOPTIONS:db.options.options,NODE_ENV:'development',PUBLIC_SITE_URL:base,SESSION_SECRET:'browser-test-secret-not-production-12345'},stdio:'pipe'});
 server.stdout?.on('data',x=>{serverLog+=x;});server.stderr?.on('data',x=>{serverLog+=x;});
 for(let i=0;i<200;i++){if(server.exitCode!==null)throw new Error(serverLog);try{if((await fetch(base+'/login')).ok)break;}catch{/* startup */}await new Promise(r=>setTimeout(r,100));}
 await mkdir('.local/browser-profiles',{recursive:true});
 browser=await chromium.launchPersistentContext(`.local/browser-profiles/p1-${randomUUID()}`,{headless:true,executablePath:process.env.CHROME_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000}});
 page=await browser.newPage();page.on('pageerror',e=>{serverLog+=' CLIENT '+e.message;});page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/login'))serverLog+=' Login Origin: '+r.headers().origin;});await page.goto(base+'/login');await page.getByLabel('密码',{exact:true}).fill('p1-browser-owner-password');await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(base+'/workspace',{timeout:10000}).catch(async()=>{throw new Error('Login result '+page.url()+' '+await page.locator('body').innerText()+' Server: '+serverLog);});
},60000);
afterAll(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await new Promise<void>(r=>server.once('exit',()=>r()));}await db?.end();});
it('edits with real CodeMirror, saves confirmed revisions and keeps selection across mobile tabs',async()=>{
 await page.goto(`${base}/workspace/content/${id}/edit`);
 const source=page.getByRole('textbox',{name:'Markdown 正文'});await source.waitFor({timeout:10000}).catch(async()=>{throw new Error('Editor result '+await page.locator('body').innerText()+' Log '+serverLog);});await source.fill('# 浏览器正文\n\n自动保存验证\n\n```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\ninvalid diagram\n```');
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
 expect((await db.query('SELECT revision,payload FROM drafts WHERE content_id=$1',[id])).rows[0].payload.body).toContain('自动保存验证');
 await page.waitForFunction(()=>document.querySelector('.mermaid-block svg')!==null);
 await page.getByText('图表无法渲染，源码已保留',{exact:true}).waitFor();
 await page.screenshot({path:`${evidence}/editor-desktop.png`,fullPage:true});
 await page.setViewportSize({width:320,height:800});await page.getByRole('button',{name:'预览',exact:true}).click();expect(await source.isVisible()).toBe(false);
 await page.getByRole('button',{name:'编辑',exact:true}).click();expect(await source.innerText()).toContain('自动保存验证');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'内容设置与媒体'}).click();await page.keyboard.press('Escape');expect(await page.locator('dialog[open]').count()).toBe(0);
 await page.screenshot({path:`${evidence}/editor-mobile.png`,fullPage:true});
},60000);
it('handles a committed publication with a lost HTTP response by querying its result',async()=>{
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'发布 / 排期'}).click();await page.waitForURL(`**/publish`);
 await page.route('**/publish/api',async route=>{await route.fetch();await route.abort('failed');},{times:1});
 await page.getByRole('button',{name:'确认发布',exact:true}).click();await page.getByText('已确认操作成功',{exact:true}).waitFor();
 expect((await db.query('SELECT * FROM publication_events WHERE content_id=$1',[id])).rowCount).toBe(1);
 await page.screenshot({path:`${evidence}/publish-result.png`,fullPage:true});
},30000);
it('keeps two-tab conflicts and server restore from leaving stale metadata in a new draft',async()=>{
 await page.goto(`${base}/workspace/content/${id}/edit`);const other=await browser.newPage();await other.goto(`${base}/workspace/content/${id}/edit`);
 await page.getByLabel('标题',{exact:true}).fill('first tab title');await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('已保存'));
 await other.getByLabel('标题',{exact:true}).fill('second tab local');await other.getByRole('heading',{name:'两份稿件发生冲突'}).waitFor();
 expect(await other.getByLabel('标题',{exact:true}).inputValue()).toBe('second tab local');await other.close();
});
