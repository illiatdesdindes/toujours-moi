<!-- The edit sheet (spec Q4, Q6): a bottom sheet on mobile, a centred modal on desktop, saved with an explicit "Enregistrer". The home's Modifier opens it on the pending chore; #7 adds editing a saved one. -->
<script lang="ts">
	import { endsInTheFuture, NO_FUTURE_CHORE_MESSAGE } from '#lib/chore-timing.js';
	import type { ChoreTypeOption, NewChore } from '#lib/domain.js';
	import { fromParisDateAndTime, toParisDateAndTime } from '#lib/paris-time.js';
	import ChoreTypePicker from './ChoreTypePicker.svelte';
	import ChoreWhenAndNoteFields from './ChoreWhenAndNoteFields.svelte';
	import DurationStepper from './DurationStepper.svelte';
	import Icon from './Icon.svelte';

	let {
		chore,
		choreTypes,
		onSave,
		onClose
	}: {
		/** Copied into the form when the sheet opens; key the sheet on it. */
		chore: NewChore;
		choreTypes: ChoreTypeOption[];
		onSave: (chore: NewChore) => void;
		/** Closed without saving (✕, Échap, the backdrop). */
		onClose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const initialStart = toParisDateAndTime(new Date(chore.startedAt));
	// svelte-ignore state_referenced_locally
	const draft = $state({
		choreTypeId: chore.choreTypeId,
		durationMinutes: chore.durationMinutes,
		date: initialStart.date,
		time: initialStart.time,
		note: chore.note ?? ''
	});
	const today = toParisDateAndTime(new Date()).date;
	const draftError = $derived(
		!draft.date || !draft.time
			? 'Date et heure obligatoires'
			: endsInTheFuture(
						fromParisDateAndTime(draft.date, draft.time),
						draft.durationMinutes,
						new Date()
				  )
				? NO_FUTURE_CHORE_MESSAGE
				: null
	);

	let dialog: HTMLDialogElement;
	$effect(() => dialog.showModal());

	let saved = false;
	const save = () => {
		if (draftError) return;
		saved = true;
		onSave({
			...chore,
			choreTypeId: draft.choreTypeId,
			durationMinutes: draft.durationMinutes,
			startedAt: fromParisDateAndTime(draft.date, draft.time).toISOString(),
			note: draft.note.trim() || null
		});
		dialog.close();
	};
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom md:modal-middle"
	aria-labelledby="chore-edit-sheet-title"
	onclose={() => saved || onClose()}
>
	<div class="modal-box max-h-[90dvh] bg-base-100 p-4 pop-edge">
		<div class="mb-3 flex items-center justify-between">
			<h2 id="chore-edit-sheet-title" class="text-lg font-bold">Modifier avant d'enregistrer</h2>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-sm"
				aria-label="Fermer"
				onclick={() => dialog.close()}><Icon glyph="x-mark" /></button
			>
		</div>
		<form
			class="space-y-3"
			onsubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<DurationStepper bind:durationMinutes={draft.durationMinutes} compact />
			<ChoreTypePicker
				{choreTypes}
				selectedChoreTypeId={draft.choreTypeId}
				onPick={(choreType) => (draft.choreTypeId = choreType.id)}
			/>
			<ChoreWhenAndNoteFields
				bind:date={draft.date}
				bind:time={draft.time}
				bind:note={draft.note}
				latestDate={today}
				required
			/>
			{#if draftError}<p class="text-sm font-semibold text-error" role="alert">{draftError}</p>{/if}
			<button class="btn w-full btn-primary" disabled={!!draftError}>Enregistrer</button>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
</dialog>
