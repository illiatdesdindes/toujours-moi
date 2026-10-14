<!-- The chore type tiles (spec Q4): icon + short label, full label in title / aria-label. The one picker, on the home (a tap logs) and in the edit sheet (a tap selects). On the home, the pending chore's tile shows its 5 s countdown and doesn't log again. -->
<script lang="ts">
	import type { ChoreTypeOption } from '#lib/domain.js';
	import { PENDING_DELAY_MS } from '#lib/pending-chore.js';

	let {
		choreTypes,
		onPick,
		selectedChoreTypeId,
		pendingChoreTypeId
	}: {
		choreTypes: ChoreTypeOption[];
		onPick: (choreType: ChoreTypeOption) => void;
		/** Set in the edit sheet: the tiles become a single choice. Left out on the home. */
		selectedChoreTypeId?: string;
		/** The home's pending chore type: its tile is "in progress" until the chore commits. */
		pendingChoreTypeId?: string | undefined;
	} = $props();
	const isChoice = $derived(selectedChoreTypeId !== undefined);
</script>

<div
	class={['grid grid-cols-4 gap-2', !isChoice && 'md:grid-cols-6']}
	role={isChoice ? 'radiogroup' : undefined}
	aria-label={isChoice ? 'Type de tâche' : undefined}
>
	{#each choreTypes as choreType (choreType.id)}
		{@const isSelected = choreType.id === selectedChoreTypeId}
		{@const isPending = choreType.id === pendingChoreTypeId}
		<button
			type="button"
			data-chore-type-id={choreType.id}
			class={[
				'relative flex flex-col items-center justify-center gap-1 overflow-hidden p-2 transition active:scale-95',
				isChoice
					? [
							'min-h-16 rounded-field border-2',
							isSelected
								? 'border-base-content bg-primary text-primary-content'
								: 'border-base-content/20 bg-base-200'
						]
					: [
							'min-h-20 rounded-box pop-edge',
							isPending
								? 'cursor-wait bg-primary text-primary-content active:scale-100'
								: 'bg-base-200'
						]
			]}
			title={choreType.fullLabel}
			aria-label={choreType.fullLabel}
			role={isChoice ? 'radio' : undefined}
			aria-checked={isChoice ? isSelected : undefined}
			aria-disabled={isPending || undefined}
			onclick={() => onPick(choreType)}
		>
			<span class="text-2xl" aria-hidden="true">{choreType.icon}</span>
			<span class="text-center text-[0.68rem] leading-tight font-semibold" aria-hidden="true"
				>{choreType.shortLabel}</span
			>
			{#if isPending}
				<span
					class="pending-bar absolute inset-x-0 bottom-0 h-1.5 bg-primary-content"
					style:animation-duration="{PENDING_DELAY_MS}ms"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	{/each}
</div>

<style>
	/* The tile's copy of PendingChoreCard's bar, so the countdown shows where the tap was. */
	.pending-bar {
		animation: pending-fill linear forwards;
	}
	@keyframes pending-fill {
		from {
			width: 0;
		}
		to {
			width: 100%;
		}
	}
</style>
