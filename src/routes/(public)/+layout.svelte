<script lang="ts">import PublicLayout from '$lib/components/public/PublicLayout.svelte';let {children,data}=$props();</script><PublicLayout tools={data?.hasTools}>{@render children()}</PublicLayout>
