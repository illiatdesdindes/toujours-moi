<!-- The edit sheet (spec Q4, Q6): a bottom sheet on mobile, a centred modal on desktop, saved with an explicit "Enregistrer". The home's Modifier opens it on the pending chore, Historique on a saved one (with Supprimer, or read-only when the access policy forbids editing). -->
<script lang="ts">
	import { endsInTheFuture, NO_FUTURE_CHORE_MESSAGE } from '#lib/chore-timing.js';
	import type { ChoreTypeOption, ChoreFields, User } from '#lib/domain.js';
	import { fromParisDateAndTime, toParisDateAndTime } from '#lib/paris-time.js';
	import ChoreTypePicker from './ChoreTypePicker.svelte';
	import ChoreDetailsFields from './ChoreDetailsFields.svelte';
	import DurationStepper from './DurationStepper.svelte';
	import Icon from './Icon.svelte';

	let {
		chore,
		title,
		choreTypes,
		performerOptions,
		readOnly = false,
		loggedForPerformerByName = null,
		onSave,
		onDelete,
		onClose
	}: {
		/** Copied into the form when the sheet opens; key the sheet on it. */
		chore: ChoreFields;
		title: string;
		choreTypes: ChoreTypeOption[];
		/** "Fait par" (spec Q3): shown when there is a choice. */
		performerOptions: User[];
		/** 🔒 (spec Q6): shown, not editable; no Enregistrer nor Supprimer. */
		readOnly?: boolean;
		/** A saved chore logged for its performer by someone else: "Notée par …". */
		loggedForPerformerByName?: string | null;
		/** A French reason it wasn't saved keeps the sheet open with it; nothing closes it. */
		onSave: (chore: ChoreFields) => void | Promise<string | null>;
		/** A saved chore's Supprimer, after "Supprimer cette tâche ?" (spec Q6). Same answer as onSave. */
		onDelete?: () => Promise<string | null>;
		/** Closed, saved or not (✕, Échap, the backdrop, after a save or a delete): unmount the sheet. */
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
		note: chore.note ?? '',
		performerUserId: chore.performerUserId
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

	// null once unmounted: the home unmounts the sheet in its onSave, before the answer comes back.
	let dialog: HTMLDialogElement | null = null;
	$effect(() => dialog?.showModal());

	let serverError = $state<string | null>(null);
	let isSending = $state(false);
	/** Closes on success; a refusal stays on screen with the draft, so nothing typed is lost. */
	const closeUnlessRefused = async (answer: void | Promise<string | null>) => {
		isSending = true;
		serverError = (await answer) ?? null;
		isSending = false;
		if (!serverError) dialog?.close();
	};
	const save = () => {
		if (draftError || readOnly) return;
		void closeUnlessRefused(
			onSave({
				...chore,
				choreTypeId: draft.choreTypeId,
				durationMinutes: draft.durationMinutes,
				startedAt: fromParisDateAndTime(draft.date, draft.time).toISOString(),
				note: draft.note.trim() || null,
				performerUserId: draft.performerUserId
			})
		);
	};
	const confirmAndDelete = () => {
		if (onDelete && confirm('Supprimer cette tâche ?')) void closeUnlessRefused(onDelete());
	};
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom md:modal-middle"
	aria-labelledby="chore-edit-sheet-title"
	onclose={onClose}
>
	<div class="modal-box max-h-[90dvh] bg-base-100 p-4 pop-edge">
		<div class="mb-3 flex items-center justify-between">
			<h2 id="chore-edit-sheet-title" class="text-lg font-bold">{title}</h2>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-sm"
				aria-label="Fermer"
				onclick={() => dialog?.close()}><Icon glyph="x-mark" /></button
			>
		</div>
		{#if loggedForPerformerByName}
			<p class="mb-3 text-sm opacity-70">Notée par <b>{loggedForPerformerByName}</b></p>
		{/if}
		{#if readOnly}
			<p class="mb-3 alert text-sm">
				<Icon glyph="lock-closed" class="size-4" />Tu ne peux pas modifier cette tâche.
			</p>
		{/if}
		<form
			class="space-y-3"
			onsubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<!-- Read-only values stay legible (daisyUI greys disabled inputs to 40 %): they're all the sheet shows. -->
			<fieldset
				class={[
					'space-y-3',
					readOnly && '[&_:is(input,select,textarea):disabled]:text-base-content'
				]}
				disabled={readOnly}
			>
				<DurationStepper bind:durationMinutes={draft.durationMinutes} compact />
				<ChoreTypePicker
					{choreTypes}
					selectedChoreTypeId={draft.choreTypeId}
					onPick={(choreType) => (draft.choreTypeId = choreType.id)}
				/>
				<ChoreDetailsFields
					bind:date={draft.date}
					bind:time={draft.time}
					bind:note={draft.note}
					bind:performerUserId={draft.performerUserId}
					{performerOptions}
					latestDate={today}
					required
				/>
			</fieldset>
			{#if !readOnly}
				{#if draftError ?? serverError}<p class="text-sm font-semibold text-error" role="alert">
						{draftError ?? serverError}
					</p>{/if}
				<div class="flex gap-2">
					{#if onDelete}
						<button
							type="button"
							class="btn btn-outline btn-error"
							disabled={isSending}
							onclick={confirmAndDelete}>Supprimer</button
						>
					{/if}
					<button class="btn flex-1 btn-primary" disabled={!!draftError || isSending}
						>Enregistrer</button
					>
				</div>
			{/if}
		</form>
	</div>
	<form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
</dialog>
