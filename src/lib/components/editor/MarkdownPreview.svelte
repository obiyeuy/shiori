<script lang="ts">
 import DOMPurify from 'dompurify';
 import 'katex/dist/katex.min.css';
 let {html}:{html:string}=$props();let host:HTMLDivElement;let sequence=0;
 $effect(()=>{html;const current=++sequence;queueMicrotask(()=>void enhance(current));});
 async function enhance(current:number){
  if(!host)return;
  for(const pre of host.querySelectorAll<HTMLPreElement>('pre')){
   if(pre.closest('.mermaid-block'))continue;
   const copy=document.createElement('button');copy.textContent='复制代码';copy.onclick=async()=>{try{await navigator.clipboard.writeText(pre.textContent??'');copy.textContent='已复制';}catch{copy.textContent='复制失败，请选择代码复制';}};pre.before(copy);
  }
  const blocks=host.querySelectorAll<HTMLElement>('.mermaid-block');if(!blocks.length)return;
  const {default:mermaid}=await import('mermaid');
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,maxTextSize:50_000,suppressErrorRendering:true,flowchart:{htmlLabels:false}});
  for(const block of blocks){
   if(current!==sequence||!block.isConnected)return;const source=block.querySelector('code')?.textContent??'';
   try{
    if(/%%\{|^---/m.test(source))throw new Error('不接受图表配置覆盖');
    const result=await mermaid.render(`diagram-${crypto.randomUUID()}`,source);
    if(current!==sequence||!block.isConnected)return;
    const wrapper=document.createElement('div');wrapper.innerHTML=DOMPurify.sanitize(result.svg,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','script','a']});block.prepend(wrapper);
    block.querySelector('figcaption')!.textContent='图表（下方可查看源码）';
   }catch{if(block.isConnected)block.querySelector('figcaption')!.textContent='图表无法渲染，源码已保留';}
  }
 }
</script>
<div class="markdown" bind:this={host}>{@html html}</div>
