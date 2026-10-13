<!-- Accueil: the quick log (spec Q4). Duration first, a tap on a type logs it through the pending card. -->
<script lang="ts">
	import { getChoreOutbox, getShowToast } from '#lib/app-context.js';
	import {
		deriveStartedAt,
		endsInTheFuture,
		formatDuration,
		NO_FUTURE_CHORE_MESSAGE
	} from '#lib/chore-timing.js';
	import ChoreEditSheet from '#lib/components/ChoreEditSheet.svelte';
	import ChoreTypePicker from '#lib/components/ChoreTypePicker.svelte';
	import ChoreWhenAndNoteFields from '#lib/components/ChoreWhenAndNoteFields.svelte';
	import DurationStepper from '#lib/components/DurationStepper.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PendingChoreCard from '#lib/components/PendingChoreCard.svelte';
	import type { ChoreTypeOption, NewChore } from '#lib/domain.js';
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
	let quickLogOverrides = $state({ open: false, date: '', time: '', note: '' });
	let now = $state(new Date());
	let pendingChore = $state<NewChore | null>(null);
	let choreInEditSheet = $state<NewChore | null>(null);

	const choreTypeById = (choreTypeId: string) =>
		data.choreTypes.find((choreType) => choreType.id === choreTypeId);

	const startedAtFor = (tappedAt: Date) => {
		const derived = deriveStartedAt(tappedAt, durationMinutes);
		if (!quickLogOverrides.date && !quickLogOverrides.time) return derived;
		const derivedWallTime = toParisDateAndTime(derived);
		return fromParisDateAndTime(
			quickLogOverrides.date || derivedWallTime.date,
			quickLogOverrides.time || derivedWallTime.time
		);
	};
	const quickLogOverridesSummary = $derived(
		`${formatParisDayAndTime(startedAtFor(now), now)} · Moi${quickLogOverrides.note.trim() ? ' · 📝' : ''}`
	);

	/** `Vaisselle · 45 min` */
	const choreLabelFor = (chore: NewChore) =>
		`${choreTypeById(chore.choreTypeId)?.shortLabel} · ${formatDuration(chore.durationMinutes)}`;

	const commit = async (chore: NewChore, savedToastMessage: string) => {
		const choreLabel = choreLabelFor(chore);
		const submitted = choreOutbox.submit(chore, choreLabel); // stored before this returns
		quickLogOverrides = { open: false, date: '', time: '', note: '' };
		const isWaitingForNetwork = await submitted;
		// Never "enregistré" while it only sits in this browser.
		showToast(
			isWaitingForNetwork
				? `⏳ ${choreLabel} en attente du réseau : envoyée dès son retour`
				: savedToastMessage
		);
	};
	const pendingChoreTimer = createPendingChore<NewChore>({
		commit: (chore) => void commit(chore, `✓ ${choreLabelFor(chore)} enregistré`),
		onChange: (chore) => (pendingChore = chore)
	});

	/** A second tap on the same tile this soon is a double tap or a bounce, not a second chore. */
	const DOUBLE_TAP_MS = 600;
	let lastPick = { choreTypeId: '', at: 0 };

	const logChoreType = (choreType: ChoreTypeOption) => {
		const tappedAt = new Date();
		const isDoubleTap =
			lastPick.choreTypeId === choreType.id && tappedAt.getTime() - lastPick.at < DOUBLE_TAP_MS;
		lastPick = { choreTypeId: choreType.id, at: tappedAt.getTime() };
		if (isDoubleTap && pendingChoreTimer.current) return;
		const startedAt = startedAtFor(tappedAt);
		if (endsInTheFuture(startedAt, durationMinutes, tappedAt)) {
			showToast(`${NO_FUTURE_CHORE_MESSAGE} : change la date ou le début.`);
			return;
		}
		pendingChoreTimer.start({
			id: uuidV7(tappedAt.getTime()),
			choreTypeId: choreType.id,
			durationMinutes,
			startedAt: startedAt.toISOString(),
			note: quickLogOverrides.note.trim() || null,
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
			bind:open={quickLogOverrides.open}
		>
			<summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
				<Icon
					glyph="chevron-right"
					class={['size-4 transition', quickLogOverrides.open && 'rotate-90']}
				/>
				<span>{quickLogOverridesSummary}</span>
			</summary>
			<div class="space-y-2 border-t-2 border-base-content p-3">
				<ChoreWhenAndNoteFields
					bind:date={quickLogOverrides.date}
					bind:time={quickLogOverrides.time}
					bind:note={quickLogOverrides.note}
					latestDate={today}
				/>
				<p class="text-xs opacity-70">Laisse date et début vides pour « maintenant − durée ».</p>
			</div>
		</details>
	</section>
</div>

{#if pendingChore}
	{@const choreType = choreTypeById(pendingChore.choreTypeId)}
	{#key pendingChore.id}
		<PendingChoreCard
			icon={choreType?.icon ?? ''}
			summary={choreLabelFor(pendingChore)}
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
				void commit(chore, '✓ Enregistré'); // the prototype's saveSheet
			}}
			onClose={() => (choreInEditSheet = null)}
		/>
	{/key}
{/if}
