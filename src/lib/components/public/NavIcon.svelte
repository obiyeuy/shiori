<script lang="ts">
 let {name,size=18}:{name:string;size?:number}=$props();
 const paths:Record<string,string>={
 type:'M3 5h12 M9 5v15 M5 20h8 M15 12h7 M18.5 12v8',
 palette:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8H18a4 4 0 0 0 3-4A9 9 0 0 0 12 3 M7 10h.01 M10 7h.01 M15 7h.01 M18 10h.01',
 articles:'M4 3h12l4 4v14H4z M8 8h4 M8 12h8 M8 16h8',
 notes:'M4 4h10 M4 4v16h16v-9 M10 14l1-4 8-8 3 3-8 8z',
 moments:'M21 11a9 9 0 0 1-9 9H4l-3 2 2-6a9 9 0 1 1 18-5 M7 11h.01 M12 11h.01 M17 11h.01',
 projects:'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',
 tools:'M14 3a6 6 0 0 0-7 8l-5 6 4 4 6-6a6 6 0 0 0 8-7l-4 4-4-4z',
 resources:'M3 6h7l2 3h9v11H3z', tags:'M3 3h8l10 10-8 8L3 11z M7 7h.01',
 series:'M3 4h5v16H3z M10 4h5v16h-5z M17 5l3-1 3 15-3 1z',
 about:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-2a8 8 0 0 1 16 0v2',
 search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 more:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z',
 sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2',
 moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
 system:'M2 3h20v14H2z M8 22h8 M12 17v5',
 settings:'M4 3v18 M12 3v18 M20 3v18 M1 8h6 M9 16h6 M17 8h6',
 home:'M2 10l10-8 10 8 M5 8v13h5v-7h4v7h5V8'
 };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]??paths.more}/></svg>
<style>svg{flex-shrink:0;vertical-align:middle}</style>
