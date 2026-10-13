<!-- A chore's details (spec Q3, Q4, Q8): date, start (Paris wall time, by the quarter hour), "Fait par" and the one-line note. The home's details line and the edit sheet. -->
<script lang="ts">
	import { MAX_CHORE_NOTE_LENGTH, type User } from '#lib/domain.js';

	let {
		date = $bindable(),
		time = $bindable(),
		note = $bindable(),
		performerUserId = $bindable(),
		performerOptions,
		defaultPerformerName,
		latestDate,
		required = false
	}: {
		/** `YYYY-MM-DD`, Paris. */
		date: string;
		/** `HH:MM`, Paris. */
		time: string;
		note: string;
		/** '' = the default performer (home only). */
		performerUserId: string;
		/** "Fait par" (spec Q3): whom the viewer may log for; hidden when there is no choice (children). */
		performerOptions: User[];
		/** The home's: an extra first option "<name> (par défaut)" that follows the profile on screen. */
		defaultPerformerName?: string;
		/** Today in Paris: no chore in the future (Q3). */
		latestDate: string;
		/** The edit sheet's; the home leaves them empty for "now − duration". */
		required?: boolean;
	} = $props();

	// The pickers allow any minute; snap to the quarter (as Q4's derived start) so the home and the
	// sheet agree, rather than the sheet blocking on a browser bubble and the home saving 00:07.
	const floorTimeToQuarter = (wallTime: string) => {
		const [hours, minutes] = wallTime.split(':');
		if (minutes === undefined) return wallTime;
		return `${hours}:${String(Math.floor(Number(minutes) / 15) * 15).padStart(2, '0')}`;
	};
</script>

<div class="grid grid-cols-2 gap-2 text-sm">
	<label
		>Date<input
			type="date"
			class="input w-full input-sm"
			bind:value={date}
			max={latestDate}
			{required}
		/></label
	>
	<label
		>Début<input
			type="time"
			step="900"
			class="input w-full input-sm"
			bind:value={time}
			onchange={() => (time = floorTimeToQuarter(time))}
			{required}
		/></label
	>
	{#if performerOptions.length > 1}
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
	{/if}
	<label class="col-span-2"
		>Note<input
			class="input w-full input-sm"
			bind:value={note}
			maxlength={MAX_CHORE_NOTE_LENGTH}
			placeholder="facultatif"
		/></label
	>
</div>
