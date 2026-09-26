<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import {beforeNavigate,goto,invalidateAll} from '$app/navigation';
 import CodeEditor from '$lib/components/editor/CodeEditor.svelte';
 import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';
 import Upload from '$lib/components/media/Upload.svelte';
 import {Autosave,type SaveState} from '$lib/editor/autosave';
 import type {DraftInput} from '$lib/server/content/types';
 import '$lib/components/ui/tokens.css';
 let {data}=$props();
 let draft=$state<DraftInput>(untrack(()=>({...data.payload})));let status=$state<SaveState>('saved');let savedAt=$state<string|null>(untrack(()=>data.updatedAt));let revision=$state(untrack(()=>data.revision));let dirty=$state(false);let notice=$state('');
 let html=$state('');let previewError=$state('');let tab=$state('edit');let focusMode=$state(false);let conflict=$state<{serverRevision:number;serverDraft:unknown}|null>(null);
 let auto:Autosave;let editor:CodeEditor;let settings:HTMLDialogElement;let conflictDialog:HTMLDialogElement;let previewSequence=0;
 const labels:Record<SaveState,string>={saved:'已保存',unsaved:'未保存',saving:'保存中',offline:'离线',failed:'保存失败',expired:'会话过期',conflict:'冲突'};
 onMount(()=>{
  auto=new Autosave(data.revision,async(text,rev)=>{
   const response=await fetch(`./edit/api`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'save',patch:JSON.parse(text),revision:rev})});
   if(response.status===401)throw new Error('401');const result=await response.json();if(!response.ok&&response.status!==409)throw new Error(result.error);return result;
  },()=>{status=auto.state;savedAt=auto.savedAt??savedAt;revision=auto.revision;dirty=auto.dirty;if(auto.conflict){conflict=auto.conflict;if(!conflictDialog.open)conflictDialog.showModal();}});
  const unload=(event:BeforeUnloadEvent)=>{if(auto.dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',unload);
  return ()=>{auto.dispose();window.removeEventListener('beforeunload',unload);};
 });
 beforeNavigate(({cancel})=>{if(dirty&&!confirm('当前稿尚未保存。离开前可导出本地稿，仍要离开吗？'))cancel();});
 function changed(){auto?.change(JSON.stringify(draft));}
 $effect(()=>{const body=draft.body??'';const request=++previewSequence;const timer=setTimeout(async()=>{
  try{const r=await fetch('./edit/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'preview',body})});if(!r.ok)throw new Error('预览暂不可用，正文仍保留');const result=await r.json();if(request===previewSequence){html=result.html;previewError='';}}catch(e){if(request===previewSequence)previewError=e instanceof Error?e.message:'预览失败';}
 },350);return ()=>clearTimeout(timer);});
 function exportLocal(){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([draft.body??''],{type:'text/markdown;charset=utf-8'}));a.href=url;a.download='local-draft.md';a.click();URL.revokeObjectURL(url);}
 async function snapshot(){notice='';await auto.flush();if(auto.state!=='saved'){notice='请先处理保存状态';return;}const r=await fetch('./edit/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'snapshot',revision:auto.revision})});const result=await r.json();notice=r.ok?'已保存不可变版本':result.error;await invalidateAll();}
 async function restore(id:string){if(!confirm('恢复将替换当前编辑稿，公开版和排期保持不变。请先导出需要保留的本地稿。继续？'))return;const r=await fetch('./edit/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'restore',revision,versionId:id})});if(!r.ok){notice='修订已变化，请重新核对；本地稿仍保留';return;}await invalidateAll();draft={...data.payload};auto.rebase(data.revision);auto.change(JSON.stringify(draft));await auto.flush();}
</script>
<svelte:head><title>编辑内容 · 工作台</title><meta name="robots" content="noindex" /></svelte:head>
<main class="page">
 <header><a href="/workspace">工作台</a><span class="muted"> / 内容编辑</span><h1>编辑{({article:'文章',note:'笔记',moment:'动态',project:'作品',tool:'工具',resource:'资源'})[draft.type]}</h1>
 <div class="actions"><span role="status" class:error={['failed','expired','conflict'].includes(status)}>{labels[status]}{status==='saved'&&savedAt?` · ${new Date(savedAt).toLocaleTimeString('zh-CN')}`:''} · 修订 {revision}</span>
 <button onclick={()=>auto.retry()} disabled={status==='saving'||status==='saved'||status==='conflict'}>重试保存</button><button onclick={snapshot} disabled={status==='saving'}>保存版本</button><button onclick={exportLocal}>导出本地稿</button><button class="primary" disabled={status!=='saved'} onclick={()=>goto(`/workspace/content/${data.id}/publish`)}>发布 / 排期</button></div>
 {#if status==='expired'}<p class="error">请在新标签页<a href="/login" target="_blank" rel="noreferrer">重新登录</a>后重试；当前稿仍在内存中。</p>{/if}
 {#if notice}<p role="status" class="notice">{notice}</p>{/if}
 </header>
 <label>标题<input value={draft.title??''} oninput={e=>{draft.title=e.currentTarget.value;changed();}} maxlength="240" /></label>
 <div class="actions toolbar"><button onclick={()=>editor.insert('**粗体**')}>粗体</button><button onclick={()=>editor.insert('\n## 标题\n')}>标题</button><button onclick={()=>editor.insert('\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n')}>表格模板</button><button onclick={()=>editor.insert('\n```\n代码\n```\n')}>代码</button><button onclick={()=>focusMode=!focusMode}>{focusMode?'退出专注':'专注编辑'}</button><button class="settings-trigger" onclick={()=>settings.showModal()}>内容设置与媒体</button></div>
 <nav class="tabs mobile-tabs" aria-label="编辑或预览"><button aria-pressed={tab==='edit'} onclick={()=>tab='edit'}>编辑</button><button aria-pressed={tab==='preview'} onclick={()=>tab='preview'}>预览</button></nav>
 <div class="layout" class:focus-mode={focusMode}><div class="editor-grid">
 <section class="source" class:inactive={tab!=='edit'} aria-label="Markdown 编辑"><CodeEditor bind:this={editor} value={draft.body??''} onchange={text=>{draft.body=text;changed();}} /><p class="muted">{new TextEncoder().encode(draft.body??'').length} / 1048576 字节 · 自动保存只更新编辑稿</p></section>
 <section class="preview panel" class:inactive={tab!=='preview'} aria-label="正文预览"><h2>预览</h2>{#if previewError}<p class="error">{previewError}</p>{/if}<MarkdownPreview {html} /></section>
 </div><aside class="settings panel">{@render fields()}</aside></div>
 <section class="panel history"><h2>历史版本</h2><p class="muted">恢复只生成新稿。比较包含正文及发布字段；系列归属独立保存。</p>
 {#each data.history as version}<details><summary>{version.source} · 修订 {version.revision} · {new Date(version.created_at).toLocaleString('zh-CN')}</summary><div class="compare"><div><h3>当前稿</h3><pre>{JSON.stringify(draft,null,2)}</pre></div><div><h3>历史快照</h3><pre>{JSON.stringify(version.payload,null,2)}</pre></div></div><div class="actions"><button onclick={()=>restore(version.id)}>恢复为新稿</button><a href={`/workspace/import-export/download?id=${data.id}&version=${version.id}`}>导出此版本</a></div></details>{/each}
 </section>
</main>
{#snippet fields()}
 <h2>内容设置</h2><label>公开地址 slug<input value={draft.slug??''} oninput={e=>{draft.slug=e.currentTarget.value;changed();}} /></label>
 <label>摘要<textarea rows="3" value={draft.summary??''} oninput={e=>{draft.summary=e.currentTarget.value;changed();}}></textarea></label>
 <label>封面媒体键（可留空）<input value={draft.cover??''} oninput={e=>{draft.cover=e.currentTarget.value;changed();}} /></label>
 <fieldset><legend>标签（可不选）</legend>{#each data.tags as tag}<label class="check"><input type="checkbox" checked={draft.tags?.includes(tag.id)} onchange={e=>{draft.tags=e.currentTarget.checked?[...draft.tags??[],tag.id]:(draft.tags??[]).filter(t=>t!==tag.id);changed();}} />{tag.name}</label>{/each}{#if !data.tags.length}<p class="muted">尚无标签</p>{/if}</fieldset>
 <label class="check"><input type="checkbox" checked={draft.commentsEnabled??['article','note','project'].includes(draft.type)} onchange={e=>{draft.commentsEnabled=e.currentTarget.checked;changed();}} />开放评论</label>
 {#if ['project','tool','resource'].includes(draft.type)}<label>一句话说明 / 用途<input value={draft.description??''} oninput={e=>{draft.description=e.currentTarget.value;changed();}} /></label>{/if}
 {#if draft.type==='project'}<label>作品状态<select value={draft.projectStatus??''} onchange={e=>{draft.projectStatus=e.currentTarget.value as DraftInput['projectStatus'];changed();}}><option value="">请选择</option><option value="in-progress">进行中</option><option value="completed">已完成</option><option value="paused">暂停</option><option value="stopped">已停止</option></select></label><label>演示 URL<input value={draft.demoUrl??''} oninput={e=>{draft.demoUrl=e.currentTarget.value;changed();}} /></label><label>源码 URL<input value={draft.codeUrl??''} oninput={e=>{draft.codeUrl=e.currentTarget.value;changed();}} /></label>{/if}
 {#if draft.type==='tool'}<label>工具状态<select value={draft.toolStatus??'unavailable'} onchange={e=>{draft.toolStatus=e.currentTarget.value as DraftInput['toolStatus'];changed();}}><option value="available">可用</option><option value="maintenance">维护中</option><option value="unavailable">暂不可用</option><option value="retired">已停用</option></select></label><label>工具入口<input value={draft.toolUrl??''} oninput={e=>{draft.toolUrl=e.currentTarget.value;changed();}} /></label><label>不可用原因<input value={draft.unavailableReason??''} oninput={e=>{draft.unavailableReason=e.currentTarget.value;changed();}} /></label>{/if}
 {#if draft.type==='resource'}<label>来源名称<input value={draft.sourceName??''} oninput={e=>{draft.sourceName=e.currentTarget.value;changed();}} /></label><label>来源 URL<input value={draft.sourceUrl??''} oninput={e=>{draft.sourceUrl=e.currentTarget.value;changed();}} /></label>{/if}
 <p>系列：{data.series??'未加入'}（独立管理）</p>
 <Upload oninsert={text=>{editor.insert(text);settings.close();}} />
{/snippet}
<dialog bind:this={settings}><div class="actions"><h2>内容设置</h2><button onclick={()=>settings.close()}>关闭设置</button></div>{@render fields()}</dialog>
<dialog bind:this={conflictDialog}><h2>两份稿件发生冲突</h2><p>本地稿已保留。先导出，再比较字段并决定如何合入；不会自动覆盖。</p><div class="compare"><div><h3>本地 · 修订 {revision}</h3><pre>{JSON.stringify(draft,null,2)}</pre></div><div><h3>服务器 · 修订 {conflict?.serverRevision}</h3><pre>{JSON.stringify(conflict?.serverDraft,null,2)}</pre></div></div><div class="actions"><button onclick={exportLocal}>导出本地稿</button><button onclick={()=>conflictDialog.close()}>继续比较与编辑</button><button onclick={()=>{if(conflict){auto.rebase(conflict.serverRevision);auto.change(JSON.stringify(draft));conflictDialog.close();}}}>以服务器修订为基线保存当前稿</button><button onclick={()=>{if(conflict&&confirm('确认放弃本地修改，改用服务器稿？')){draft={...conflict.serverDraft as DraftInput};auto.rebase(conflict.serverRevision);auto.change(JSON.stringify(draft));conflictDialog.close();}}}>明确放弃本地修改</button></div></dialog>
<style>
 header{margin-bottom:24px}.toolbar{margin:16px 0}.layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px}.editor-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;min-width:0}.source,.preview{min-width:0}.preview{max-height:75vh;overflow:auto}.settings{align-self:start}.mobile-tabs,.settings-trigger{display:none}.history{margin-top:32px}.history summary{min-height:44px;cursor:pointer}.compare{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.compare pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px}dialog{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:16px;max-width:900px;width:calc(100% - 32px);max-height:90dvh;padding:24px}dialog::backdrop{background:#17152299}.focus-mode{grid-template-columns:1fr}.focus-mode .editor-grid{grid-template-columns:1fr}.focus-mode .preview,.focus-mode .settings{display:none}@media(max-width:1099px){.layout{grid-template-columns:1fr}.settings{display:none}.settings-trigger{display:inline-block}}@media(max-width:767px){.editor-grid,.compare{grid-template-columns:1fr}.mobile-tabs{display:flex;margin-bottom:16px}.inactive{display:none}.preview{max-height:none}dialog{width:100%;max-width:100%;max-height:100dvh;border-radius:0;padding:16px}.focus-mode .preview{display:block}}
</style>
