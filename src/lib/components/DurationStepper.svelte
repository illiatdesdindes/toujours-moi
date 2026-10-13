<!-- The duration, first on the home (spec Q4): −/+ by 15 min up to 24 h, and the chips on the home. -->
<script lang="ts">
	import {
		clampDurationMinutes,
		DURATION_CHIPS_MINUTES,
		formatDuration,
		MAX_DURATION_MINUTES,
		MIN_DURATION_MINUTES
	} from '#lib/chore-timing.js';
	import Icon from './Icon.svelte';

	let {
		durationMinutes = $bindable(),
		compact = false
	}: {
		durationMinutes: number;
		/** The edit sheet's: smaller, no chips. */
		compact?: boolean;
	} = $props();

	const STEP_MINUTES = 15;
	const step = (minutes: number) =>
		(durationMinutes = clampDurationMinutes(durationMinutes + minutes));
</script>

<div class="flex items-center justify-between" role="group" aria-label="Durée">
	<button
		type="button"
		class={['btn btn-circle', !compact && 'btn-lg']}
		aria-label="Moins 15 minutes"
		disabled={durationMinutes <= MIN_DURATION_MINUTES}
		onclick={() => step(-STEP_MINUTES)}><Icon glyph="minus" class="size-6" /></button
	>
	<output class={['font-bold tabular-nums', compact ? 'text-3xl' : 'text-4xl']} aria-live="polite"
		>{formatDuration(durationMinutes)}</output
	>
	<button
		type="button"
		class={['btn btn-circle', !compact && 'btn-lg']}
		aria-label="Plus 15 minutes"
		disabled={durationMinutes >= MAX_DURATION_MINUTES}
		onclick={() => step(STEP_MINUTES)}><Icon glyph="plus" class="size-6" /></button
	>
</div>
{#if !compact}
	<div class="mt-2 flex flex-wrap gap-1.5">
		{#each DURATION_CHIPS_MINUTES as chipMinutes (chipMinutes)}
			<button
				type="button"
				class={['btn h-auto min-h-6 btn-xs', durationMinutes === chipMinutes && 'btn-primary']}
				aria-pressed={durationMinutes === chipMinutes}
				onclick={() => (durationMinutes = chipMinutes)}>{formatDuration(chipMinutes)}</button
			>
		{/each}
	</div>
{/if}
