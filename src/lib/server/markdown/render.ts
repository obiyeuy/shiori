import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize,{defaultSchema} from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import {visit} from 'unist-util-visit';
import {toString} from 'mdast-util-to-string';
import {codeToHtml,bundledLanguages} from 'shiki';
import {safePublicUrl} from '../content/validation.js';
import type {Root,RootContent} from 'mdast';
import type {Root as HtmlRoot} from 'hast';
export type MediaReference={key:string;variant:'display'|'original';description:string};
export type RenderedDocument={html:string;text:string;toc:{id:string;text:string;depth:number}[];media:MediaReference[];diagrams:string[];hasContent:boolean;unresolved:string[]};
const mediaPattern=/^media:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(original))?$/;
export async function renderMarkdown(source:string,mode:'public'|'preview'):Promise<RenderedDocument>{
 if(Buffer.byteLength(source)>1024*1024)throw new Error('正文超过 1 MiB');
 const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath);
 const tree=parser.parse(source) as Root;
 const result:RenderedDocument={html:'',text:'',toc:[],media:[],diagrams:[],hasContent:false,unresolved:[]};
 const definitions=new Map<string,{url:string;title?:string|null}>();
 visit(tree,'definition',node=>{definitions.set(node.identifier.toLowerCase(),node);});
 visit(tree,(node,index,parent)=>{
  if((node.type==='linkReference'||node.type==='imageReference')&&parent&&index!==undefined){const ref=definitions.get(node.identifier.toLowerCase());if(ref)parent.children[index]=node.type==='imageReference'?{type:'image',url:ref.url,title:ref.title,alt:node.alt}:{type:'link',url:ref.url,title:ref.title,children:node.children};}
 });
 const readable:string[]=[];
 visit(tree,(node,index,parent)=>{
  if(node.type==='html' && parent && index!==undefined){parent.children[index]={type:'text',value:node.value} as RootContent;return;}
  if(node.type==='heading'){const id=`heading-${result.toc.length+1}`;node.data={hProperties:{id}};result.toc.push({id,text:toString(node),depth:node.depth});}
  if(node.type==='code'||node.type==='math'||node.type==='inlineMath')result.hasContent=true;
  if(node.type==='code'&&node.lang==='mermaid')result.diagrams.push(node.value);
  if(node.type==='text')readable.push(node.value);
  if(node.type==='image'||node.type==='link'){
   const match=mediaPattern.exec(node.url);
   if(match){
    const decorative=node.type==='image'&&node.title==='decorative';
    const description=decorative?'装饰图':node.type==='image'?node.alt??'':toString(node);
    if(decorative&&node.type==='image')node.alt='';
    result.media.push({key:match[1],variant:match[2]?'original':'display',description});
    node.url=`/media/${mode==='preview'?'private':'public'}/${match[1]}${match[2]?'?variant=original':''}`;
    if(node.type==='image'&&!decorative)readable.push(description);
    result.hasContent=true;
   }else if(node.type==='image'&&parent&&index!==undefined){
    const label=node.alt||'外部图片来源';if(!safePublicUrl(node.url))result.unresolved.push(node.url);
    parent.children[index]=safePublicUrl(node.url)?{type:'link',url:node.url,children:[{type:'text',value:label}]}:{type:'text',value:label};
   }else if(node.type==='link'&&!safePublicUrl(node.url,true)&&!safePublicUrl(node.url)&&!/^#[-\w]+$/.test(node.url))node.url='';
  }
 });
 result.text=readable.join(' ').replace(/\s+/g,' ').trim();
 result.hasContent ||= !!result.text;
 const html=await unified().use(remarkRehype).run(tree) as HtmlRoot;
 const sanitized=await unified().use(rehypeSanitize,{...defaultSchema,clobberPrefix:'',attributes:{...defaultSchema.attributes,code:[...(defaultSchema.attributes?.code??[]),['className',/^language-./,'math-inline','math-display']],h1:['id'],h2:['id'],h3:['id'],h4:['id'],h5:['id'],h6:['id']}}).run(html) as HtmlRoot;
 const math=await unified().use(rehypeKatex,{trust:false,strict:'error',maxExpand:1000}).run(sanitized) as HtmlRoot;
 const jobs:Promise<void>[]=[];
 visit(math,'element',(node,index,parent)=>{
  if(node.tagName==='table'&&parent&&index!==undefined){parent.children[index]={type:'element',tagName:'div',properties:{className:['table-scroll'],tabIndex:0,role:'region',ariaLabel:'表格，可横向滚动'},children:[node]};return 'skip';}
  if(node.tagName!=='pre'||!parent||index===undefined)return;
  const code=node.children[0];if(code?.type!=='element'||code.tagName!=='code')return;
  const source=code.children.map(c=>c.type==='text'?c.value:'').join('').replace(/\n$/,'');
  const classes=String(code.properties.className??'');const lang=/language-([\w+-]+)/.exec(classes)?.[1]??'text';
  if(lang==='mermaid'){
   parent.children[index]={type:'element',tagName:'figure',properties:{className:['mermaid-block']},children:[{type:'element',tagName:'figcaption',properties:{},children:[{type:'text',value:'图表：加载后显示；失败时可查看源码'}]},{type:'element',tagName:'details',properties:{},children:[{type:'element',tagName:'summary',properties:{},children:[{type:'text',value:'查看图表源码'}]},node]}]};
  }else jobs.push(codeToHtml(source,{lang:lang in bundledLanguages?lang:'text',theme:'github-light',transformers:[]}).then(value=>{parent.children[index]={type:'raw',value} as unknown as typeof node;}));
 });
 await Promise.all(jobs);
 result.html=unified().use(rehypeStringify,{allowDangerousHtml:true}).stringify(math);
 return result;
}
