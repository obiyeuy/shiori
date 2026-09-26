import urllib.request,concurrent.futures,re
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self): super().__init__(); self.skip=0; self.parts=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'): self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style'): self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip(): self.parts.append(d.strip())
urls={
'svelte-node':'https://svelte.dev/docs/kit/adapter-node',
'svelte-pages':'https://svelte.dev/docs/kit/page-options',
'astro-render':'https://docs.astro.build/en/guides/on-demand-rendering/',
'astro-content':'https://docs.astro.build/en/guides/content-collections/',
'next-selfhost':'https://nextjs.org/docs/app/guides/self-hosting',
'nuxt-render':'https://nuxt.com/docs/4.x/guide/concepts/rendering',
'payload':'https://payloadcms.com/docs/getting-started/what-is-payload',
'payload-db':'https://payloadcms.com/docs/database/overview',
'pocketbase':'https://pocketbase.io/docs/',
'wordpress':'https://wordpress.org/about/requirements/',
'sqlite':'https://sqlite.org/whentouse.html',
'pagescms':'https://pagescms.org/docs/',
}
pat=re.compile(r'prerender|sqlite|postgres|mysql|production|reverse proxy|server:defer|island|hybrid|memory|cache|standalone|markdown|GitHub|concurrent|Next.js|Node.js|adapter',re.I)
def get(k,u):
 try:
  html=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode()
  p=Text(); p.feed(html); txt='\n'.join(p.parts); open('work/'+k+'.txt','w').write(txt)
  lines=txt.splitlines(); chosen=[]
  for i,l in enumerate(lines):
   if pat.search(l):
    s=' '.join(lines[max(0,i-1):i+3]);
    if s not in chosen: chosen.append(s)
  return k,u,'\n'.join(chosen)[:10500]
 except Exception as e: return k,u,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for k,u,t in pool.map(lambda a:get(*a),urls.items()): print('\nSOURCE',k,u,'\n',t)
