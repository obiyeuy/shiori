<script lang="ts">import Listing from '$lib/components/public/Listing.svelte';let {data}=$props();</script>
<Listing title={data.name} items={data.items} page={data.page} total={data.total} path={data.path}/>
