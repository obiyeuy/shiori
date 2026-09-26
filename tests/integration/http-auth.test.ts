import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, afterAll, it, expect } from 'vitest';
import type { Pool } from 'pg';
import { testDatabase } from '../helpers/database.js';
import { initializeOwner } from '../../src/lib/server/auth/service.js';
let db:Pool;let server:ChildProcess;const base='http://127.0.0.1:5199';
beforeAll(async()=>{
 db=await testDatabase();await initializeOwner(db,{password:'http-test-owner-password'});
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{env:{...process.env,PGOPTIONS:db.options.options,NODE_ENV:'development',PUBLIC_SITE_URL:base,SESSION_SECRET:'http-test-secret-not-for-production-12345'},stdio:'pipe'});
 let log='';server.stdout?.on('data',x=>{log+=x;});server.stderr?.on('data',x=>{log+=x;});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('HTTP server exited: '+log);try{if((await fetch(base+'/login')).ok)return;}catch{/* wait for startup */}await new Promise(r=>setTimeout(r,100));}
 throw new Error('HTTP server startup timed out: '+log);
},20000);
afterAll(async()=>{if(server?.exitCode===null){server.kill('SIGTERM');await new Promise<void>(r=>server.once('exit',()=>r()));}await db?.end();});
it('protects HTML and private routes, enforces trusted Origin and supports revocable cookie login',async()=>{
 const denied=await fetch(base+'/workspace',{redirect:'manual'});expect(denied.status).toBe(303);expect(denied.headers.get('location')).toContain('/login');expect(denied.headers.get('cache-control')).toContain('no-store');
 expect((await fetch(base+'/media/private/secret')).status).toBe(401);
 expect((await fetch(base+'/%77orkspace',{redirect:'manual'})).status).toBe(303);
 expect((await fetch(base+'/%6dedia/private/secret',{redirect:'manual'})).status).toBe(401);
 const post=(path:string,origin:string,body:URLSearchParams,cookie?:string)=>fetch(base+path,{method:'POST',redirect:'manual',headers:{accept:'text/html',origin,referer:origin+'/form',...(cookie?{cookie}:{})},body});
 const evil=await post('/login','https://evil.test',new URLSearchParams({password:'http-test-owner-password'}));expect(evil.status).toBe(403);
 expect((await post('/%6cogin','https://evil.test',new URLSearchParams({password:'http-test-owner-password'}))).status).toBe(403);
 expect((await post('/login',base,new URLSearchParams({password:'wrong-password'}))).status).toBe(401);
 const ok=await post('/login?next=//evil.test',base,new URLSearchParams({password:'http-test-owner-password'}));
 expect(ok.status).toBe(303);expect(ok.headers.get('location')).toBe('/workspace');
 const cookie=ok.headers.get('set-cookie')!;expect(cookie).toMatch(/HttpOnly/i);expect(cookie).toMatch(/SameSite=Lax/i);
 const header=cookie.split(';')[0];
 const workspace=await fetch(base+'/workspace',{headers:{cookie:header}});expect(workspace.status).toBe(200);expect(workspace.headers.get('cache-control')).toContain('no-store');
 expect((await post('/logout','https://evil.test',new URLSearchParams(),header)).status).toBe(403);
 expect((await post('/logout',base,new URLSearchParams(),header)).status).toBe(303);
 expect((await fetch(base+'/workspace',{headers:{cookie:header},redirect:'manual'})).status).toBe(303);
 expect((await fetch(base+'/auth/github')).status).toBe(503);
 expect((await db.query("SELECT to_regclass('schema_migrations') AS name")).rows[0].name).toBeNull();
});
