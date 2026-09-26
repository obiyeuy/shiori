import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {chromium,type BrowserContext,type Page} from '@playwright/test';
import type {Pool} from 'pg';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
let db:Pool,server:ChildProcess,browser:BrowserContext,page:Page,publish:PublicationService,id:string;
const base='http://127.0.0.1:5202',evidence='.superpowers/sdd/个人综合站-实施计划-P2-公开站与搜索';
const clientErrors:string[]=[];let log='';
beforeAll(async()=>{
 db=await testDatabase();const repo=new ContentRepository(db);publish=new PublicationService(db);
 id=await repo.createContent('article');await repo.saveDraft(id,{title:'公开浏览测试',slug:'browser-old',body:'# 公开正文\n\n关键词紫杉\n\n| 表格 | 内容 |\n| --- | --- |\n| 中文 | 正文 |',commentsEnabled:true},0);await publish.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 await repo.saveDraft(id,{slug:'browser-new'},1);await publish.publishNow(id,{key:randomUUID(),revision:2,expectedScheduleRevision:null});
 const root=process.env.SITE_VERIFY_ROOT?resolve(process.env.SITE_VERIFY_ROOT,'public-browser'):undefined;if(root)await mkdir(root,{recursive:true});
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5202','--strictPort'],{env:{...process.env,...(root?{SITE_VERIFY_ROOT:root}:{}),PGOPTIONS:db.options.options,NODE_ENV:'development',PUBLIC_SITE_URL:base},stdio:'pipe'});
 server.stdout?.on('data',x=>{log+=x;});server.stderr?.on('data',x=>{log+=x;});
 for(let i=0;i<200;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(base)).ok)break;}catch{/* startup */}await new Promise(r=>setTimeout(r,100));}
 await mkdir('.local/browser-profiles',{recursive:true});
 browser=await chromium.launchPersistentContext(`.local/browser-profiles/p2-${randomUUID()}`,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000}});
 page=await browser.newPage();page.on('pageerror',error=>clientErrors.push(error.message));
},60000);
afterAll(async()=>{await browser?.close();if(server?.exitCode===null){server.kill('SIGTERM');await new Promise<void>(r=>server.once('exit',()=>r()));}await db?.end();});
it('serves public pages, canonical pagination, aliases and private isolation',async()=>{
 await page.goto(base);expect(await page.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'工具',exact:true}).count()).toBe(0);
 for(const route of ['/articles','/notes','/moments','/projects','/tools','/resources','/about','/privacy','/tags','/series','/updates'])expect((await fetch(base+route)).status,route).toBe(200);
 const redirect=await fetch(base+'/articles/browser-old',{redirect:'manual'});expect(redirect.status).toBe(308);expect(redirect.headers.get('location')).toBe('/articles/browser-new');
 await page.goto(base+'/articles?page=2');expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe('/articles?page=2');
 expect((await fetch(base+'/articles?page=-1')).status).toBe(400);
 await page.goto(base+'/articles/browser-new');await page.getByText('评论尚未配置。',{exact:true}).waitFor();expect(await page.locator('script[src*="giscus"]').count()).toBe(0);
 expect(clientErrors).toEqual([]);
});
it('restores search filters on back and remains readable at 320px, dark theme and 200% text',async()=>{
 await page.goto(base+'/search?q=紫杉&type=article');await page.getByRole('link',{name:'公开浏览测试',exact:true}).click();await page.waitForURL('**/articles/browser-new');await page.goBack();
 expect(await page.getByLabel('关键词').inputValue()).toBe('紫杉');expect(await page.getByLabel('文章',{exact:true}).isChecked()).toBe(true);expect(await page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
 await page.setViewportSize({width:320,height:800});await page.emulateMedia({reducedMotion:'reduce'});await page.getByLabel('主题',{exact:true}).selectOption('dark');
 expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidence}/public-search-mobile.png`,fullPage:true});
 await page.goto(base);await page.keyboard.press('Tab');expect(await page.getByRole('link',{name:'跳到主要内容'}).evaluate(e=>e===document.activeElement)).toBe(true);
 await page.setViewportSize({width:1440,height:1000});await page.getByLabel('主题',{exact:true}).selectOption('light');await page.screenshot({path:`${evidence}/public-home-desktop.png`,fullPage:true});
});
it('resets the loaded discussion when navigating between two public articles',async()=>{
 const repo=new ContentRepository(db);const next=await repo.createContent('article');await repo.saveDraft(next,{title:'第二篇讨论',slug:'second-discussion',body:'正文',commentsEnabled:true},0);await publish.publishNow(next,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 await db.query("INSERT INTO site_settings(key,value) VALUES('giscus',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[{enabled:true,repo:'test-owner/test-repo',repoId:'R_test',categoryId:'DIC_test'}]);
 await page.route('https://giscus.app/client.js',route=>route.fulfill({contentType:'text/javascript',body:`(()=>{const script=document.currentScript;const frame=document.createElement('iframe');frame.setAttribute('data-discussion',script.dataset.term);script.parentNode.append(frame);})();`}));
 await page.goto(base+'/articles/browser-new');await page.getByRole('button',{name:'加载评论',exact:true}).click();await page.locator('iframe[data-discussion]').waitFor();
 expect(await page.locator('iframe[data-discussion]').getAttribute('data-discussion')).toBe(id);
 await page.getByRole('link',{name:'上一篇：第二篇讨论',exact:true}).click();await page.waitForURL('**/second-discussion');
 expect(await page.locator('iframe[data-discussion]').count()).toBe(0);await page.getByRole('button',{name:'加载评论',exact:true}).click();await page.locator('iframe[data-discussion]').waitFor();expect(await page.locator('iframe[data-discussion]').getAttribute('data-discussion')).toBe(next);
 await page.unroute('https://giscus.app/client.js');
});
it('loads Giscus only after an explicit click and distinguishes a third-party error',async()=>{
 await db.query("INSERT INTO site_settings(key,value) VALUES('giscus',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[{enabled:true,repo:'test-owner/test-repo',repoId:'R_test',categoryId:'DIC_test'}]);
 let requests=0;await page.route('https://giscus.app/**',async route=>{requests++;await route.abort();});
 await page.goto(base+'/articles/browser-new');await page.getByRole('button',{name:'加载评论',exact:true}).waitFor({timeout:5000}).catch(async()=>{throw new Error('Giscus button: '+await page.locator('body').innerText()+' '+log);});expect(requests).toBe(0);await page.getByRole('button',{name:'加载评论',exact:true}).click();await page.getByText('评论暂时无法加载。',{exact:true}).waitFor({timeout:5000}).catch(async()=>{throw new Error('Giscus requests '+requests+' '+await page.locator('body').innerText());});expect(requests).toBe(1);
 await publish.withdrawPublication(id);expect((await fetch(base+'/articles/browser-new')).status).toBe(404);expect((await fetch(base+'/articles/browser-old')).status).toBe(404);
 expect(await (await fetch(base+'/rss.xml')).text()).not.toContain('公开浏览测试');expect(await (await fetch(base+'/sitemap.xml')).text()).not.toContain('browser-new');
 expect(clientErrors).toEqual([]);
});
