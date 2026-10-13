<!-- One row of Rapports' "Par type" / "Par personne" (spec Q9, prototype 02): what it is, its duration and share, and a horizontal CSS bar of that share. -->
<script lang="ts">
	import { formatDuration } from '#lib/chore-timing.js';
	import type { Snippet } from 'svelte';

	let {
		minutes,
		percent,
		barColour = 'var(--color-primary)',
		children
	}: {
		minutes: number;
		percent: number;
		/** A CSS colour; the page's primary (the person on screen) by default. */
		barColour?: string;
		/** What the row is about: icon and label, or the person. */
		children: Snippet;
	} = $props();
</script>

<li class="mb-2">
	<div class="flex justify-between gap-2 text-sm">
		<span class="min-w-0">{@render children()}</span>
		<span class="shrink-0 tabular-nums"><b>{formatDuration(minutes)}</b> · {percent} %</span>
	</div>
	<div class="h-2.5 rounded-full bg-base-200" aria-hidden="true">
		<div class="h-full rounded-full" style:width="{percent}%" style:background={barColour}></div>
	</div>
</li>
