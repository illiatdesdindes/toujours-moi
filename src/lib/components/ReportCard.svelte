<!-- One card of Rapports (spec Q9, prototype 02): a titled box, with "Rien sur cette période." when it has nothing to show. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		isEmpty = false,
		children
	}: {
		title: string;
		/** Shows "Rien sur cette période." under the content. */
		isEmpty?: boolean;
		children: Snippet;
	} = $props();

	const titleId = $props.id();
</script>

<section class="rounded-box bg-base-100 p-3 pop-edge" aria-labelledby={titleId}>
	<h3 id={titleId} class="mb-2 text-sm font-semibold">{title}</h3>
	{@render children()}
	{#if isEmpty}<p class="text-sm opacity-70">Rien sur cette période.</p>{/if}
</section>
