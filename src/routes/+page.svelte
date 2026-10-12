<!-- Accueil: the quick log (spec Q4). Duration first, a tap on a type logs it through the pending card. -->
<script lang="ts">
	import { getChoreOutbox, getShowToast } from '#lib/app-context.js';
	import { deriveStartedAt, endsInTheFuture, formatDuration } from '#lib/chore-timing.js';
	import type { NewChore } from '#lib/chore-outbox.js';
	import ChoreEditSheet from '#lib/components/ChoreEditSheet.svelte';
	import ChoreTypePicker from '#lib/components/ChoreTypePicker.svelte';
	import DurationStepper from '#lib/components/DurationStepper.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PendingChoreCard from '#lib/components/PendingChoreCard.svelte';
	import { MAX_CHORE_NOTE_LENGTH, type ChoreTypeOption } from '#lib/domain.js';
	import {
		formatParisDayAndTime,
		fromParisDateAndTime,
		toParisDateAndTime
	} from '#lib/paris-time.js';
	import { createPendingChore } from '#lib/pending-chore.js';
	import { uuidV7 } from '#lib/uuid.js';
	import { onMount } from 'svelte';

	let { data } = $props();
	const choreOutbox = getChoreOutbox();
	const showToast = getShowToast();

	// svelte-ignore state_referenced_locally
	let durationMinutes = $state(data.defaultDurationMinutes);
	/** The collapsed line's overrides; empty date and time = now − duration (spec Q4). */
	let details = $state({ open: false, date: '', time: '', note: '' });
	let now = $state(new Date());
	let pendingChore = $state<NewChore | null>(null);
	let choreInEditSheet = $state<NewChore | null>(null);

	const choreTypeById = (choreTypeId: string) =>
		data.choreTypes.find((choreType) => choreType.id === choreTypeId);

	const startedAtFor = (tappedAt: Date) => {
		const derived = deriveStartedAt(tappedAt, durationMinutes);
		if (!details.date && !details.time) return derived;
		const derivedWallTime = toParisDateAndTime(derived);
		return fromParisDateAndTime(
			details.date || derivedWallTime.date,
			details.time || derivedWallTime.time
		);
	};
	const detailsSummary = $derived(
		`${formatParisDayAndTime(startedAtFor(now), now)} · Moi${details.note.trim() ? ' · 📝' : ''}`
	);

	const commit = (chore: NewChore) => {
		void choreOutbox.submit(chore);
		details = { open: false, date: '', time: '', note: '' };
		const choreType = choreTypeById(chore.choreTypeId);
		showToast(`✓ ${choreType?.shortLabel} · ${formatDuration(chore.durationMinutes)} enregistré`);
	};
	const pendingChoreTimer = createPendingChore<NewChore>({
		commit,
		onChange: (chore) => (pendingChore = chore)
	});

	const logChoreType = (choreType: ChoreTypeOption) => {
		const tappedAt = new Date();
		const startedAt = startedAtFor(tappedAt);
		if (endsInTheFuture(startedAt, durationMinutes, tappedAt)) {
			showToast('Pas de tâche dans le futur : change la date ou le début.');
			return;
		}
		pendingChoreTimer.start({
			id: uuidV7(tappedAt.getTime()),
			choreTypeId: choreType.id,
			durationMinutes,
			startedAt: startedAt.toISOString(),
			note: details.note.trim() || null,
			performerUserId: data.viewer.id
		});
	};

	onMount(() => {
		const clock = setInterval(() => (now = new Date()), 30_000);
		// Closing or backgrounding the app never loses a quick log (spec Q4).
		const flushWhenHidden = () =>
			document.visibilityState === 'hidden' && pendingChoreTimer.flush();
		addEventListener('pagehide', pendingChoreTimer.flush);
		document.addEventListener('visibilitychange', flushWhenHidden);
		return () => {
			clearInterval(clock);
			removeEventListener('pagehide', pendingChoreTimer.flush);
			document.removeEventListener('visibilitychange', flushWhenHidden);
			pendingChoreTimer.flush(); // leaving for another tab commits it too
		};
	});

	const today = $derived(toParisDateAndTime(now).date);
</script>

<div class="md:grid md:grid-cols-[18rem_1fr] md:gap-8">
	<section aria-labelledby="duration-heading" class="mb-4">
		<h2 id="duration-heading" class="mb-2 text-sm font-semibold opacity-70">Combien de temps ?</h2>
		<DurationStepper bind:durationMinutes />
	</section>

	<section aria-labelledby="chore-type-heading">
		<h2 id="chore-type-heading" class="text-sm font-semibold opacity-70">
			Quoi ? <span class="font-normal">(un tap enregistre)</span>
		</h2>
		<div class="mt-2">
			<ChoreTypePicker choreTypes={data.choreTypes} onPick={logChoreType} />
		</div>

		<details
			class="mt-4 rounded-field border-2 border-base-content bg-base-200"
			bind:open={details.open}
		>
			<summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
				<Icon glyph="chevron-right" class={['size-4 transition', details.open && 'rotate-90']} />
				<span class="first-letter:uppercase">{detailsSummary}</span>
			</summary>
			<div class="grid grid-cols-2 gap-2 border-t-2 border-base-content p-3 text-sm">
				<label
					>Date<input
						type="date"
						class="input w-full input-sm"
						bind:value={details.date}
						max={today}
					/></label
				>
				<label
					>Début<input
						type="time"
						step="900"
						class="input w-full input-sm"
						bind:value={details.time}
					/></label
				>
				<label class="col-span-2"
					>Note<input
						class="input w-full input-sm"
						bind:value={details.note}
						maxlength={MAX_CHORE_NOTE_LENGTH}
						placeholder="facultatif"
					/></label
				>
				<p class="col-span-2 text-xs opacity-70">
					Laisse date et début vides pour « maintenant − durée ».
				</p>
			</div>
		</details>
	</section>
</div>

{#if pendingChore}
	{@const choreType = choreTypeById(pendingChore.choreTypeId)}
	{#key pendingChore.id}
		<PendingChoreCard
			icon={choreType?.icon ?? ''}
			summary={`${choreType?.shortLabel} · ${formatDuration(pendingChore.durationMinutes)}`}
			dayAndTime={formatParisDayAndTime(new Date(pendingChore.startedAt), now)}
			onEdit={() => (choreInEditSheet = pendingChoreTimer.takeForEdit())}
			onCancel={pendingChoreTimer.cancel}
		/>
	{/key}
{/if}

{#if choreInEditSheet}
	{#key choreInEditSheet.id}
		<ChoreEditSheet
			chore={choreInEditSheet}
			choreTypes={data.choreTypes}
			onSave={(chore) => {
				choreInEditSheet = null;
				commit(chore);
			}}
			onClose={() => (choreInEditSheet = null)}
		/>
	{/key}
{/if}
