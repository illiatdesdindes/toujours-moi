<!-- One Historique row (spec Q6, prototype 02): icon, short label (and who, in Famille), note, the admin's "✎ n", 🔒 when read-only, duration and start time. Opens the edit sheet. -->
<script lang="ts">
	import type { HistoryChore } from '#lib/domain.js';
	import { formatDuration } from '#lib/chore-timing.js';
	import { toParisDateAndTime } from '#lib/paris-time.js';
	import Icon from './Icon.svelte';
	import PersonColourDot from './PersonColourDot.svelte';

	let {
		chore,
		showsPerformer,
		onOpen
	}: { chore: HistoryChore; showsPerformer: boolean; onOpen: () => void } = $props();
</script>

<button
	type="button"
	class="flex w-full items-center gap-3 rounded-box px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current"
	onclick={onOpen}
>
	<span class="text-xl" title={chore.fullLabel} aria-hidden="true">{chore.icon}</span>
	<span class="min-w-0 flex-1">
		<span class="block font-semibold"
			><span class="sr-only">{chore.fullLabel}</span><span aria-hidden="true"
				>{chore.shortLabel}</span
			>
			{#if showsPerformer}
				<span class="ml-1 inline-flex items-center gap-1 text-xs font-normal"
					><PersonColourDot colourKey={chore.performerColourKey} />{chore.performerName}</span
				>
			{/if}
		</span>
		{#if chore.note}<span class="block truncate text-xs opacity-70">{chore.note}</span>{/if}
	</span>
	{#if chore.updateCount}
		<span class="badge h-auto badge-sm badge-secondary" title="Modifiée {chore.updateCount} fois"
			>✎ {chore.updateCount}</span
		>
	{/if}
	{#if !chore.canEdit}
		<span class="opacity-60" title="Tu ne peux pas la modifier"
			><Icon glyph="lock-closed" class="size-4" /><span class="sr-only">(lecture seule)</span></span
		>
	{/if}
	<span class="text-right text-sm tabular-nums"
		><b>{formatDuration(chore.durationMinutes)}</b><br /><span class="opacity-70"
			>{toParisDateAndTime(new Date(chore.startedAt)).time}</span
		></span
	>
</button>
