<script lang="ts">
 type Course={name:string;weekday:number;start:string;end:string;from:string;until:string};
 const courses:Course[]=[
  {name:'高级数据库系统',weekday:1,start:'10:00',end:'11:45',from:'2026-08-31',until:'2026-11-01'},
  {name:'中国式现代化的理论与实践',weekday:1,start:'13:45',end:'15:30',from:'2026-08-31',until:'2026-10-04'},
  {name:'中国式现代化的理论与实践',weekday:1,start:'13:45',end:'15:30',from:'2026-10-12',until:'2026-12-13'},
  {name:'矩阵分析',weekday:1,start:'15:45',end:'17:30',from:'2026-08-31',until:'2026-11-01'},
  {name:'高级数据库系统',weekday:3,start:'10:00',end:'11:45',from:'2026-09-02',until:'2026-11-03'},
  {name:'中国式现代化的理论与实践',weekday:5,start:'13:45',end:'15:30',from:'2026-12-11',until:'2026-12-17'},
  {name:'矩阵分析',weekday:4,start:'13:45',end:'15:30',from:'2026-09-03',until:'2026-11-04'},
  {name:'滑冰',weekday:4,start:'15:45',end:'17:30',from:'2026-09-10',until:'2026-11-04'},
  {name:'心理咨询',weekday:4,start:'19:25',end:'20:15',from:'2026-09-24',until:'2026-09-30'},
  {name:'人工智能原理及应用',weekday:2,start:'15:45',end:'17:30',from:'2026-09-01',until:'2026-11-02'},
  {name:'人工智能原理及应用',weekday:6,start:'13:45',end:'15:30',from:'2026-09-05',until:'2026-11-06'},
  {name:'学术写作与学术规范',weekday:6,start:'15:45',end:'17:30',from:'2026-10-10',until:'2026-11-20'},
  {name:'学术写作与学术规范',weekday:6,start:'15:45',end:'17:30',from:'2026-11-28',until:'2026-12-11'},
  {name:'人工智能实验',weekday:6,start:'18:30',end:'20:15',from:'2026-10-31',until:'2026-11-06'}
 ];
 const weekdays=['日','一','二','三','四','五','六'];
 const today=new Date(); const start=new Date(today); start.setHours(0,0,0,0); start.setDate(start.getDate()-start.getDay());
 function iso(d:Date){return d.toISOString().slice(0,10)}
 function coursesFor(d:Date){const key=iso(d);return courses.filter(c=>c.weekday===d.getDay()&&key>=c.from&&key<=c.until).sort((a,b)=>a.start.localeCompare(b.start))}
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {date:d,label:`${d.getMonth()+1}/${d.getDate()}`,weekday:weekdays[d.getDay()],items:coursesFor(d)}});
 let selected=$state(0); const selectedDay=$derived(days[selected]);
</script>
<section class="schedule-widget" aria-label="本周课表"><div class="widget-head"><p class="kicker">THIS WEEK</p><span>{today.getMonth()+1}月</span></div><div class="day-strip">{#each days as day,i}<button type="button" class:active={selected===i} onclick={()=>selected=i}><small>周{day.weekday}</small><strong>{day.label.split('/')[1]}</strong></button>{/each}</div><div class="schedule-list"><p class="day-title">{selected===today.getDay()?'今天':`周${selectedDay.weekday} · ${selectedDay.label}`}</p>{#if selectedDay.items.length}{#each selectedDay.items as item}<div class="course"><time>{item.start}<br/><span>{item.end}</span></time><strong>{item.name}</strong></div>{/each}{:else}<p class="empty">今天没有安排</p>{/if}</div></section>
<style>.schedule-widget{padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid var(--line)}.widget-head{display:flex;align-items:center;justify-content:space-between}.kicker{margin:0 0 8px;color:var(--primary);font:0.625rem/1.4 'DM Mono',monospace;letter-spacing:.14em}.widget-head>span{font-size:.6875rem;color:var(--muted)}.day-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:4px 0 12px}.day-strip button{display:grid;gap:2px;place-items:center;min-height:43px;padding:4px 1px;border:0;border-radius:9px;background:transparent;color:var(--muted)}.day-strip button.active,.day-strip button:hover{background:var(--soft);color:var(--primary)}.day-strip small{font-size:.5625rem}.day-strip strong{font-size:.75rem}.day-title{margin:0 0 8px;font-size:.75rem;font-weight:600}.course{display:grid;grid-template-columns:43px 1fr;gap:8px;align-items:start;padding:8px 0;border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}.course time{font:0.625rem/1.45 'DM Mono',monospace;color:var(--primary)}.course time span{color:var(--muted)}.course strong{font-size:.75rem;line-height:1.5}.empty{margin:0;color:var(--muted);font-size:.6875rem}@media(max-width:950px){.schedule-widget{display:none}}
</style>
