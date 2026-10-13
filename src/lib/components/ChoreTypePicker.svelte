<!-- The chore type tiles (spec Q4): icon + short label, full label in title / aria-label. The one picker, on the home (a tap logs) and in the edit sheet (a tap selects). -->
<script lang="ts">
	import type { ChoreTypeOption } from '#lib/domain.js';

	let {
		choreTypes,
		onPick,
		selectedChoreTypeId
	}: {
		choreTypes: ChoreTypeOption[];
		onPick: (choreType: ChoreTypeOption) => void;
		/** Set in the edit sheet: the tiles become a single choice. Left out on the home. */
		selectedChoreTypeId?: string;
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
					: 'min-h-20 rounded-box bg-base-200 pop-edge'
			]}
			title={choreType.fullLabel}
			aria-label={choreType.fullLabel}
			role={isChoice ? 'radio' : undefined}
			aria-checked={isChoice ? isSelected : undefined}
			onclick={() => onPick(choreType)}
		>
			<span class="text-2xl" aria-hidden="true">{choreType.icon}</span>
			<span class="text-center text-[0.68rem] leading-tight font-semibold" aria-hidden="true"
				>{choreType.shortLabel}</span
			>
		</button>
	{/each}
</div>
