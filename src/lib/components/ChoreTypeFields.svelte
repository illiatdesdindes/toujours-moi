<!-- A chore type's fields (spec Q2, Q4), posting `icon`, `shortLabel` and `fullLabel`: Types de tâches' rows and Ajouter un type. Each row ends with the caller's buttons. -->
<script lang="ts">
	import {
		MAX_CHORE_TYPE_FULL_LABEL_LENGTH,
		MAX_CHORE_TYPE_SHORT_LABEL_LENGTH,
		type ChoreTypeOption
	} from '#lib/domain.js';
	import type { Snippet } from 'svelte';

	let {
		choreType,
		afterShortLabel,
		afterFullLabel
	}: {
		/** Empty for Ajouter un type. */
		choreType?: ChoreTypeOption;
		afterShortLabel?: Snippet;
		afterFullLabel: Snippet;
	} = $props();
</script>

<div class="flex items-center gap-2">
	<input
		class="input w-14 text-center text-lg input-sm"
		name="icon"
		value={choreType?.icon ?? ''}
		required
		placeholder={choreType ? undefined : '🧽'}
		aria-label="Icône (un emoji)"
	/>
	<input
		class="input min-w-0 flex-1 input-sm"
		name="shortLabel"
		value={choreType?.shortLabel ?? ''}
		required
		maxlength={MAX_CHORE_TYPE_SHORT_LABEL_LENGTH}
		placeholder="libellé court"
		aria-label="Libellé court"
	/>
	{@render afterShortLabel?.()}
</div>
<div class="flex items-center gap-2">
	<input
		class="input min-w-0 flex-1 input-sm"
		name="fullLabel"
		value={choreType?.fullLabel ?? ''}
		maxlength={MAX_CHORE_TYPE_FULL_LABEL_LENGTH}
		placeholder={choreType ? 'libellé complet' : 'libellé complet (facultatif)'}
		aria-label="Libellé complet"
	/>
	{@render afterFullLabel()}
</div>
