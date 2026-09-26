import urllib.request, concurrent.futures,re,json
from html.parser import HTMLParser
from pathlib import Path
class P(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.p=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip():self.p.append(d.strip())
sources={
'halo-compose':'https://docs.halo.run/getting-started/install/docker-compose',
'halo-readme':'https://raw.githubusercontent.com/halo-dev/halo/main/README_zh-CN.md',
'halo-backup':'https://docs.halo.run/user-guide/backup',
'halo-plugin':'https://www.halo.run/store/apps',
'wordpress-features':'https://wordpress.org/about/features/',
'wordpress-export':'https://wordpress.org/documentation/article/tools-export-screen/',
'wordpress-docker':'https://raw.githubusercontent.com/docker-library/docs/master/wordpress/README.md',
'ghost-install':'https://docs.ghost.org/install/docker',
'ghost-db':'https://docs.ghost.org/faq/supported-databases',
'ghost-export':'https://docs.ghost.org/migration',
'typecho':'https://raw.githubusercontent.com/typecho/typecho/master/README.md',
'directus-license':'https://directus.io/bsl',
'directus-docker':'https://directus.io/docs/self-hosting/deploying',
'strapi-db':'https://docs.strapi.io/cms/configurations/database',
'payload-db-current':'https://payloadcms.com/docs/database/overview',
'halo-moments':'https://raw.githubusercontent.com/halo-sigs/plugin-moments/main/README.md',
'halo-markdown':'https://raw.githubusercontent.com/halo-sigs/plugin-bytemd/main/README.md',
}
pat=re.compile(r'MySQL|MariaDB|Markdown|markdown|memory|RAM|内存|附件|备份|恢复|license|License|million|免费|Docker|mysql|uploads|数据库|SQLite|Lexical',re.I)
def get(a):
 k,u=a
 try:
  r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=25); h=r.read().decode(); final=r.url
  if '<html' in h[:1000].lower() or '<!doctype' in h[:1000].lower():p=P();p.feed(h);t=' '.join(p.p)
  else:t=h
  Path('work/'+k+'.txt').write_text(t)
  snippets=[];end=-1
  for m in pat.finditer(t):
   if m.start()<end:continue
   snippets.append(t[max(0,m.start()-90):m.start()+450]);end=m.start()+450
   if len(snippets)>=9:break
  return {'name':k,'url':final,'length':len(t),'extracts':snippets or [t[:1600]]}
 except Exception as e:return {'name':k,'url':u,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for r in pool.map(get,sources.items()):print(json.dumps(r,ensure_ascii=False),flush=True)
