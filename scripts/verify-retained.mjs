import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=resolve('.local/verification',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8));
await mkdir(root,{recursive:true,mode:0o700});
await mkdir(resolve(root,'tmp'),{mode:0o700});
const env={...process.env,TMPDIR:resolve(root,'tmp'),SITE_VERIFY_ROOT:root,NODE_OPTIONS:[process.env.NODE_OPTIONS,`--require=${resolve('scripts/retain-generated.cjs')}`].filter(Boolean).join(' ')};
async function run(args){return new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolveRun():reject(new Error(`Verification exited ${code}`)));});}
console.log('Retained verification output:',root);
try{
 await run(['node_modules/@sveltejs/kit/svelte-kit.js','sync']);
 const config=JSON.parse(await readFile('tsconfig.json','utf8'));config.extends=resolve(root,'kit/tsconfig.json');
 config.include=[resolve('src/**/*.ts'),resolve('src/**/*.svelte'),resolve('tests/**/*.ts'),resolve('scripts/**/*.ts'),resolve(root,'kit/types/**/*.d.ts')];
 const configPath=resolve(root,'check.tsconfig.json');await writeFile(configPath,JSON.stringify(config,null,2));
 await run(['node_modules/svelte-check/bin/svelte-check','--tsconfig',configPath]);
 if(process.argv.includes('--tests'))await run(['node_modules/vitest/vitest.mjs','run',...process.argv.filter(arg=>arg.endsWith('.test.ts'))]);
 if(process.argv.includes('--build')||process.argv.includes('--acceptance'))await run(['node_modules/vite/bin/vite.js','build']);
 if(process.argv.includes('--acceptance'))await run(['--import','tsx','scripts/acceptance.ts']);
}catch(error){console.error(error.message);process.exitCode=1;}
