<!-- Rapports' period navigator (spec Q9, prototype 02): ‹ the period › and "Aujourd'hui"; on the current period › is disabled and "Aujourd'hui" hidden (no future). -->
<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import Icon from './Icon.svelte';

	let {
		periodLabel,
		previousHref,
		nextHref,
		todayHref
	}: {
		/** Lower case; capitalised here. */
		periodLabel: string;
		previousHref: ResolvedPathname;
		/** Null on the current period. */
		nextHref: ResolvedPathname | null;
		todayHref: ResolvedPathname;
	} = $props();
</script>

<div class="flex items-center gap-2">
	<a href={previousHref} class="btn btn-square btn-sm" aria-label="Période précédente"
		><Icon glyph="chevron-left" class="size-4" /></a
	>
	<h2 class="flex-1 text-center font-semibold first-letter:uppercase">{periodLabel}</h2>
	{#if nextHref}
		<a href={nextHref} class="btn btn-square btn-sm" aria-label="Période suivante"
			><Icon glyph="chevron-right" class="size-4" /></a
		>
		<a href={todayHref} class="btn btn-sm">Aujourd'hui</a>
	{:else}
		<button type="button" class="btn btn-square btn-sm" disabled aria-label="Période suivante"
			><Icon glyph="chevron-right" class="size-4" /></button
		>
	{/if}
</div>
