<script lang="ts">
 let {oninsert}:{oninsert:(text:string)=>void}=$props();
 let uploadStatus=$state('待上传');let progress=$state(0);let description=$state('');let original=$state(false);let item=$state<{key:string;mime:string;animated:boolean;state:string;error:string|null}|null>(null);let xhr:XMLHttpRequest|undefined;
 function upload(file:File){
  item=null;uploadStatus='上传中';progress=0;xhr=new XMLHttpRequest();xhr.open('POST','/workspace/uploads');xhr.setRequestHeader('x-file-name',encodeURIComponent(file.name));
  xhr.upload.onprogress=e=>{if(e.lengthComputable)progress=Math.round(e.loaded/e.total*100);};xhr.upload.onload=()=>{uploadStatus='处理中';};
  xhr.onload=()=>{try{const data=JSON.parse(xhr!.responseText);if(xhr!.status>=400){uploadStatus=data.error??'上传失败';return;}item=data;uploadStatus=data.state==='ready'?'就绪':'失败';}catch{uploadStatus='响应无法确认，请核对媒体记录，文件未自动删除';}};
  xhr.onerror=()=>{uploadStatus='上传结果待确认，文件可能已接收；请核对媒体记录';};xhr.onabort=()=>{uploadStatus='传输已取消，已接收文件不会删除';};xhr.send(file);
 }
 async function retry(){if(!item)return;uploadStatus='处理中';try{const r=await fetch(`/workspace/uploads?retry=${item.key}`,{method:'POST'});const data=await r.json();if(!r.ok)throw new Error(data.error);item=data;uploadStatus=data.state==='ready'?'就绪':'失败';}catch(e){uploadStatus=e instanceof Error?e.message:'重试失败';}}
 function insert(){if(!item)return;const download=!item.mime.startsWith('image/')||item.animated||original;oninsert(`${download?'':'!'}[${description.replace(/[\[\]\\]/g,'')||'附件'}](media:${item.key}${download?'/original':''})`);}
</script>
<section aria-label="插入媒体">
 <h3>媒体</h3><p class="muted">原图受保护。展示图在发布成功后公开；动画、PDF、视频需明确公开原文件。</p>
 <label>选择文件<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf,video/mp4,video/webm" onchange={e=>{const f=e.currentTarget.files?.[0];if(f)upload(f);}} /></label>
 <p role="status">{uploadStatus}{uploadStatus==='上传中'?` ${progress}%`:''}</p>
 {#if uploadStatus==='上传中'}<button onclick={()=>xhr?.abort()}>取消传输</button>{/if}
 {#if item}<p>{item.error??''}</p>{#if item.state==='failed'}<button onclick={retry}>重试处理已接收文件</button>{/if}
 <label>图片描述 / 附件说明<input bind:value={description} /></label>
 <label class="check"><input type="checkbox" bind:checked={original} />确认发布时公开原文件（附件或动画必选）</label>
 <button disabled={item.state!=='ready'||!description.trim()||((!item.mime.startsWith('image/')||item.animated)&&!original)} onclick={insert}>插入引用</button>{/if}
</section>
