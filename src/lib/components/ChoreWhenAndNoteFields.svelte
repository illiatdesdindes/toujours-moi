<!-- A chore's date, start (Paris wall time, by the quarter hour) and one-line note (spec Q3, Q4): the home's details line and the edit sheet. -->
<script lang="ts">
	import { MAX_CHORE_NOTE_LENGTH } from '#lib/domain.js';

	let {
		date = $bindable(),
		time = $bindable(),
		note = $bindable(),
		latestDate,
		required = false
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
	} = $props();
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
			{required}
		/></label
	>
	<label class="col-span-2"
		>Note<input
			class="input w-full input-sm"
			bind:value={note}
			maxlength={MAX_CHORE_NOTE_LENGTH}
			placeholder="facultatif"
		/></label
	>
</div>
