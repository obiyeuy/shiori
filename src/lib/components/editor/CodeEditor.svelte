<script lang="ts">
 import {onMount} from 'svelte';
 import {EditorState} from '@codemirror/state';
 import {EditorView,keymap,lineNumbers,drawSelection} from '@codemirror/view';
 import {defaultKeymap,history,historyKeymap} from '@codemirror/commands';
 import {markdown} from '@codemirror/lang-markdown';
 let {value,onchange}:{value:string;onchange:(text:string)=>void}=$props();
 let host:HTMLDivElement;let view:EditorView|undefined;
 onMount(()=>{
  view=new EditorView({parent:host,state:EditorState.create({doc:value,extensions:[lineNumbers(),drawSelection(),history(),keymap.of([...defaultKeymap,...historyKeymap]),markdown(),EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'Markdown 正文','spellcheck':'false'}),EditorView.updateListener.of(update=>{if(update.docChanged)onchange(update.state.doc.toString());}),EditorView.theme({'&':{minHeight:'420px',fontSize:'16px'},'.cm-content':{fontFamily:'"JetBrains Mono", monospace'},'.cm-scroller':{overflow:'auto'},'.cm-gutters':{backgroundColor:'var(--soft)',color:'var(--muted)',border:'none'},'&.cm-focused':{outline:'2px solid var(--focus)'}})]})});return ()=>view?.destroy();
 });
 $effect(()=>{const text=value;if(view&&view.state.doc.toString()!==text)view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}});});
 export function insert(text:string){if(view){view.dispatch(view.state.replaceSelection(text));view.focus();}}
</script>
<div class="code-editor" bind:this={host}></div>
<style>.code-editor{min-width:0;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--surface)}</style>
