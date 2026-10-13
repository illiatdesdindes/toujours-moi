<!-- A chore type's fields (spec Q2, Q4), posting `icon`, `shortLabel` and `fullLabel`: Types de tâches' rows and Ajouter un type. Each row ends with the caller's buttons. -->
<script lang="ts">
	import {
		MAX_CHORE_TYPE_FULL_LABEL_LENGTH,
		MAX_CHORE_TYPE_SHORT_LABEL_LENGTH,
		type ChoreTypeCatalogEntry
	} from '#lib/domain.js';
	import type { Snippet } from 'svelte';

	let {
		choreType,
		afterShortLabel,
		afterFullLabel
	}: {
		/** Empty for Ajouter un type. */
		choreType?: ChoreTypeCatalogEntry;
		afterShortLabel?: Snippet;
		afterFullLabel: Snippet;
	} = $props();

	/** Archived: the fields are dimmed, not the buttons, so Restaurer doesn't look disabled. */
	const fieldDimming = $derived(choreType?.isArchived && 'opacity-60');
</script>

<div class="flex items-center gap-2">
	<input
		class={['input w-14 text-center text-lg input-sm', fieldDimming]}
		name="icon"
		value={choreType?.icon ?? ''}
		defaultValue={choreType?.icon ?? ''}
		required
		placeholder={choreType ? undefined : '🧽'}
		aria-label="Icône (un emoji)"
	/>
	<input
		class={['input min-w-0 flex-1 input-sm', fieldDimming]}
		name="shortLabel"
		value={choreType?.shortLabel ?? ''}
		defaultValue={choreType?.shortLabel ?? ''}
		required
		maxlength={MAX_CHORE_TYPE_SHORT_LABEL_LENGTH}
		placeholder="libellé court"
		aria-label="Libellé court"
	/>
	{@render afterShortLabel?.()}
</div>
<!-- On a phone the buttons wrap under the full label, so it stays readable. -->
<div class="flex flex-wrap items-center gap-2">
	<input
		class={['input w-full min-w-0 input-sm sm:w-auto sm:flex-1', fieldDimming]}
		name="fullLabel"
		value={choreType?.fullLabel ?? ''}
		defaultValue={choreType?.fullLabel ?? ''}
		maxlength={MAX_CHORE_TYPE_FULL_LABEL_LENGTH}
		placeholder={choreType ? 'libellé complet' : 'libellé complet (facultatif)'}
		aria-label="Libellé complet"
	/>
	{@render afterFullLabel()}
</div>
