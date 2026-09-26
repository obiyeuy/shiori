<script lang="ts">
 import {invalidateAll} from '$app/navigation';
 import '$lib/components/ui/tokens.css';
 let {data}=$props();let mode=$state('publish');let time=$state('');let important=$state(false);let keep=$state(false);let status=$state('idle');let message=$state('');let result=$state<{url?:string;id?:string;publishedAt?:string;schedule?:string}|null>(null);let key=$state('');let withdrawing=$state(false);
 const paths={article:'articles',note:'notes',moment:'moments',project:'projects',tool:'tools',resource:'resources'};
 async function query(){status='unknown';message='正在核对操作结果…';try{const r=await fetch(`./publish/api?key=${key}`);if(!r.ok)throw new Error();const body=await r.json();if(body.result){result=body.result;status='success';message='已确认操作成功';}else message='结果待确认：尚未查到已提交记录。保留本页，请稍后再次查询，不要盲目重发。';}catch{message='结果待确认：暂时无法查询。请保留本页，稍后再次查询。';}}
 async function submit(){
  status='submitting';message='正在提交已确认修订…';key=crypto.randomUUID();
  try{const r=await fetch('./publish/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:mode,key,revision:data.revision,expectedScheduleRevision:data.schedule?.revision??null,important,keepSchedule:keep,runAt:time?new Date(time+'+08:00').toISOString():null})});const body=await r.json();
   if(!r.ok){if(r.status===422||r.status===401){status='failed';message=body.error??'会话已过期，请重新登录';return;}await query();return;}
   result=body;status='success';message='操作成功';
  }catch{await query();}
 }
 async function withdraw(){status='submitting';try{const r=await fetch('./publish/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'withdraw'})});if(!r.ok)throw new Error();message='已撤回，所有未结束排期已取消';status='withdrawn';withdrawing=false;await invalidateAll();}catch{status='unknown';message='撤回结果待确认，请核对内容状态。';}}
</script>
<svelte:head><title>发布确认 · 工作台</title><meta name="robots" content="noindex" /></svelte:head>
<main class="page"><a href={`/workspace/content/${data.id}/edit`}>返回编辑</a><section class="panel publish"><h1>发布前确认</h1><p>目标：服务端已保存修订 {data.revision}</p><h2>{data.payload.title||'无独立标题'}</h2><p class="url">公开地址：/{paths[data.payload.type]}/{data.payload.slug}</p><p>最终摘要：{data.preflight.summary||'将使用类型与实际公开日期作为列表文案'}</p><p>封面：{data.payload.cover||'无封面，不留空位'} · 标签：{data.payload.tags?.length??0} 个 · 评论：{data.payload.commentsEnabled?'开放':'关闭'}</p>
 {#if !data.preflight.ok}<div role="alert"><h2>需要处理</h2><ul>{#each data.preflight.errors as e}<li><a href={`/workspace/content/${data.id}/edit#${e.field}`}>{e.field}：{e.message}</a></li>{/each}</ul></div>{:else}<p>字段、地址和站内媒体检查通过。</p>{/if}
 <h2>本次公开文件</h2>{#if !data.preflight.media.length}<p>未引用站内媒体</p>{:else}<ul>{#each data.preflight.media as media}<li>{media.description} · {media.variant==='original'?'原文件将公开':'仅展示图公开，原图保持私有'} · {media.key}</li>{/each}</ul>{/if}
 {#if data.preflight.alreadyPublic.length}<p class="notice">存在已公开文件。撤回正文无法让这些文件或外部缓存重新保密。</p>{/if}
 <fieldset disabled={['submitting','unknown','success','withdrawn'].includes(status)}><legend>发布选择</legend>
 <label>发布方式<select bind:value={mode}><option value="publish">立即发布</option><option value="schedule" disabled={!!data.schedule}>指定时间</option></select></label>
 {#if mode==='schedule'}<label>时间（Asia/Shanghai，UTC+08:00）<input type="datetime-local" bind:value={time} required /></label>{/if}
 <label class="check"><input type="checkbox" bind:checked={important} />标记为重要更新，更新首页事件时间</label>
 {#if data.schedule}<p>已有排期：{new Date(data.schedule.run_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {data.schedule.status}</p><label class="check"><input type="checkbox" bind:checked={keep} />保留原排期（默认取消）</label>{#if keep}<p class="notice">原排期到期后会用固定旧快照替换本次公开内容。</p>{/if}<a href={`/workspace/schedules/${data.schedule.id}`}>管理现有排期</a>{/if}
 <button class="primary" disabled={!data.preflight.ok||(mode==='schedule'&&!time)} onclick={submit}>{mode==='schedule'?'创建固定版本排期':data.schedule?(keep?'发布并保留排期':'发布并取消排期'):'确认发布'}</button></fieldset>
 {#if message}<p role="status" class="notice">{message}</p>{/if}{#if status==='unknown'&&key}<button onclick={query}>再次查询操作结果</button>{/if}
 {#if result}<div class="notice">{#if result.url}<p>实际发布时间：{result.publishedAt?new Date(result.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):''}</p><a href={result.url}>查看公开地址</a><p>排期处理：{result.schedule==='kept'?'已保留':result.schedule==='cancelled'?'已取消':'无'}</p>{:else if result.id}<a href={`/workspace/schedules/${result.id}`}>查看排期</a>{/if}</div>{/if}
 <hr /><button class="danger" disabled={status==='submitting'||status==='unknown'} onclick={()=>withdrawing=true}>撤回公开内容</button>
 {#if withdrawing}<section class="notice"><h2>确认撤回</h2><p>撤回将停止本站正文、搜索和 RSS 分发，并取消未结束排期。已公开附件、外部副本与 GitHub 讨论无法保证撤回。</p><div class="actions"><button class="danger" onclick={withdraw}>确认撤回并取消排期</button><button onclick={()=>withdrawing=false}>返回</button></div></section>{/if}
 </section></main>
<style>.publish{max-width:640px;margin:24px auto}.url,li{overflow-wrap:anywhere}fieldset{border:0;padding:0}fieldset button{width:100%;margin-top:16px}hr{border:0;border-top:1px solid var(--line);margin:24px 0}@media(max-width:767px){.page{padding:12px}.publish{margin:16px 0;padding:16px}}</style>
