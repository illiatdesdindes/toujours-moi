<!-- "Fait par" (spec Q3, Q8): who did the chore, among those the viewer may log for. Only for parents and the admin; the caller hides it when there is no choice. -->
<script lang="ts">
	import type { FamilyMember } from '#lib/domain.js';

	let {
		performerUserId = $bindable(),
		performerOptions,
		defaultPerformerName
	}: {
		/** '' = the default performer (home only). */
		performerUserId: string;
		performerOptions: FamilyMember[];
		/** The home's: an extra first option "<name> (par défaut)" that follows the profile on screen. */
		defaultPerformerName?: string;
	} = $props();
</script>

<label class="col-span-2"
	>Fait par<select class="select w-full select-sm" bind:value={performerUserId}>
		{#if defaultPerformerName !== undefined}
			<option value="">{defaultPerformerName} (par défaut)</option>
		{/if}
		{#each performerOptions as performer (performer.id)}
			<option value={performer.id}>{performer.name}</option>
		{/each}
	</select></label
>
