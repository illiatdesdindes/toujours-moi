<!-- A chore's date, start (Paris wall time, by the quarter hour) and one-line note (spec Q3, Q4): the home's details line and the edit sheet. `children` goes between the start and the note, full width ("Fait par"). -->
<script lang="ts">
	import { MAX_CHORE_NOTE_LENGTH } from '#lib/domain.js';
	import type { Snippet } from 'svelte';

	let {
		date = $bindable(),
		time = $bindable(),
		note = $bindable(),
		latestDate,
		required = false,
		children
	}: {
		/** `YYYY-MM-DD`, Paris. */
		date: string;
		/** `HH:MM`, Paris. */
		time: string;
		note: string;
		/** Today in Paris: no chore in the future (Q3). */
		latestDate: string;
		/** The edit sheet's; the home leaves them empty for "now − duration". */
		required?: boolean;
		children?: Snippet;
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
	{@render children?.()}
	<label class="col-span-2"
		>Note<input
			class="input w-full input-sm"
			bind:value={note}
			maxlength={MAX_CHORE_NOTE_LENGTH}
			placeholder="facultatif"
		/></label
	>
</div>
