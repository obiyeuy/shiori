<script lang="ts">import Listing from '$lib/components/public/Listing.svelte';let {data}=$props();</script>
<section>{#if data.description}<p>{data.description}</p>{/if}{#if data.cover}<img src={`/media/public/${data.cover}`} alt={data.name}/>{/if}</section><Listing title={data.name} items={data.items} page={data.page} total={data.total} path={data.path}/>

<style>section{max-width:900px;margin:auto}img{max-width:100%;height:auto;border-radius:16px}</style>
