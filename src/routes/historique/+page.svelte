<!-- Historique (spec Q6): the chores performed by the profile on screen, newest first, by Paris day with its total; 50 more on scroll. A row opens the edit sheet. -->
<script lang="ts">
	import { getShowToast } from '#lib/app-context.js';
	import { formatDuration } from '#lib/chore-timing.js';
	import ChoreEditSheet from '#lib/components/ChoreEditSheet.svelte';
	import HistoryChoreRow from '#lib/components/HistoryChoreRow.svelte';
	import type { HistoryChore, HistoryPage, ChoreFields } from '#lib/domain.js';
	import { groupChoresByParisDay } from '#lib/history-days.js';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	const showToast = getShowToast();

	// A new load (profile switch, a save) starts again from its first page.
	let loadedChores = $derived(data.historyPage.chores);
	let nextCursor = $derived(data.historyPage.nextCursor);
	const days = $derived(groupChoresByParisDay(loadedChores, new Date()));
	const showsPerformer = $derived(data.selectedProfile.kind === 'family');

	const OFFLINE_MESSAGE = "Pas de réseau : l'historique en a besoin, réessaie quand il revient";

	let isLoadingMore = false;
	const loadMore = async () => {
		if (isLoadingMore || !nextCursor) return;
		isLoadingMore = true;
		const query = new URLSearchParams({
			avant: nextCursor,
			...(data.selectedProfileParam && { profil: data.selectedProfileParam })
		});
		try {
			const res = await fetch(`/api/chores?${query}`);
			if (!res.ok) throw new Error(String(res.status));
			const page = (await res.json()) as HistoryPage;
			loadedChores = [...loadedChores, ...page.chores];
			nextCursor = page.nextCursor;
		} catch {
			showToast(OFFLINE_MESSAGE);
		} finally {
			isLoadingMore = false;
		}
	};
	/** Infinite scroll: the next page once the end of the list comes near. */
	const loadMoreWhenVisible = (sentinel: HTMLElement) => {
		const observer = new IntersectionObserver(
			(entries) => entries.some((entry) => entry.isIntersecting) && void loadMore(),
			{ rootMargin: '400px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	};

	/** A form action of this page, sent from the sheet; the French reason it was refused, or null. */
	const sendChoreAction = async (action: 'updateChore' | 'deleteChore', fields: object) => {
		try {
			const res = await fetch(`?/${action}`, {
				method: 'POST',
				headers: { Accept: 'application/json', 'x-sveltekit-action': 'true' },
				body: new URLSearchParams(
					Object.entries(fields).map(([field, fieldValue]) => [field, String(fieldValue ?? '')])
				)
			});
			const answer = deserialize(await res.text());
			if (answer.type === 'success') {
				await invalidateAll();
				return null;
			}
			if (answer.type === 'failure') {
				// Deleted elsewhere meanwhile: drop it from the list too; the sheet keeps the reason.
				if (answer.status === 404) await invalidateAll();
				return String(answer.data?.message ?? 'Refusé');
			}
			return 'Erreur du serveur : réessaie';
		} catch {
			return OFFLINE_MESSAGE;
		}
	};

	let choreInEditSheet = $state<HistoryChore | null>(null);
	/** The page's lists, plus the chore's own type or performer when they're not offered (archived type, the admin editing Maman's). */
	const choreTypesFor = (chore: HistoryChore) =>
		data.choreTypes.some((choreType) => choreType.id === chore.choreTypeId)
			? data.choreTypes
			: [
					{
						id: chore.choreTypeId,
						icon: chore.icon,
						shortLabel: chore.shortLabel,
						fullLabel: chore.fullLabel
					},
					...data.choreTypes
				];
	const performerOptionsFor = (chore: HistoryChore) =>
		data.performerOptions.some((performer) => performer.id === chore.performerUserId)
			? data.performerOptions
			: [
					{
						id: chore.performerUserId,
						name: chore.performerName,
						colourKey: chore.performerColourKey,
						role: chore.performerRole
					},
					...data.performerOptions
				];
</script>

{#each days as day (day.date)}
	<section class="mb-4" aria-labelledby="day-{day.date}">
		<h2 id="day-{day.date}" class="mb-1 flex justify-between text-sm font-bold">
			<span class="first-letter:uppercase">{day.label}</span>
			<span>{formatDuration(day.totalMinutes)}</span>
		</h2>
		<ul class="divide-y-2 divide-base-content/15 rounded-box bg-base-100 pop-edge">
			{#each day.chores as chore (chore.id)}
				<li>
					<HistoryChoreRow {chore} {showsPerformer} onOpen={() => (choreInEditSheet = chore)} />
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<p class="py-10 text-center opacity-70">Aucune tâche pour l'instant.</p>
{/each}

{#if nextCursor}
	{#key nextCursor}
		<div {@attach loadMoreWhenVisible} class="flex justify-center py-4">
			<button type="button" class="btn btn-ghost btn-sm" onclick={loadMore}>Plus ancien</button>
		</div>
	{/key}
{/if}

{#if choreInEditSheet}
	{@const chore = choreInEditSheet}
	{#key chore.id}
		<ChoreEditSheet
			{chore}
			title={chore.canEdit ? 'Modifier la tâche' : 'Tâche'}
			readOnly={!chore.canEdit}
			loggedForPerformerByName={chore.loggedForPerformerByName}
			choreTypes={choreTypesFor(chore)}
			performerOptions={performerOptionsFor(chore)}
			onSave={async (savedChore: ChoreFields) => {
				const refusal = await sendChoreAction('updateChore', savedChore);
				if (!refusal) showToast('✓ Enregistré');
				return refusal;
			}}
			onDelete={async () => {
				const refusal = await sendChoreAction('deleteChore', { id: chore.id });
				if (!refusal) showToast('Tâche supprimée');
				return refusal;
			}}
			onClose={() => (choreInEditSheet = null)}
		/>
	{/key}
{/if}
