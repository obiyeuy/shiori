import {it,expect} from 'vitest';
import {githubIdentity} from '../../src/lib/server/auth/oauth.js';
import {parseRuntimeConfig} from '../../src/lib/server/config.js';
const config=parseRuntimeConfig({DATABASE_URL:'postgres://test',SESSION_SECRET:'test-secret-longer-than-thirty-two-chars',PUBLIC_SITE_URL:'https://site.test',GITHUB_CLIENT_ID:'client',GITHUB_CLIENT_SECRET:'secret',GITHUB_OWNER_ID:'123'});
it('validates state before network and exchanges code without leaking client credentials to userinfo',async()=>{
 const calls:{url:string;headers:Headers}[]=[];
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input);calls.push({url,headers:new Headers(init?.headers)});
  if(url.endsWith('/access_token')){
   const body=new URLSearchParams(String(init?.body));expect(body.get('code')).toBe('code');expect(body.get('code_verifier')).toBe('verifier');
   return Response.json({access_token:'temporary-token',token_type:'bearer',scope:'read:user'});
  }
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer temporary-token');return Response.json({id:123,login:'mutable-name'});
 };
 await expect(githubIdentity(config,new URL('https://site.test/auth/github/callback?code=code&state=wrong'),'state','verifier',transport)).rejects.toThrow();expect(calls).toHaveLength(0);
 expect(await githubIdentity(config,new URL('https://site.test/auth/github/callback?code=code&state=state'),'state','verifier',transport)).toBe('123');
 expect(calls.map(c=>c.url)).toEqual(['https://github.com/login/oauth/access_token','https://api.github.com/user']);
});
