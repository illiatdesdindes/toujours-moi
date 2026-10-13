<!-- Rapports (spec Q9, prototype 02): a day, week, month or year of the profile on screen, ‹ › through the past, never the future. Headline, over-time bars, per type, and per person for Famille. -->
<script lang="ts">
	import { formatDuration, formatSignedDuration } from '#lib/chore-timing.js';
	import Icon from '#lib/components/Icon.svelte';
	import PersonColourDot from '#lib/components/PersonColourDot.svelte';
	import ReportOverTimeBars from '#lib/components/ReportOverTimeBars.svelte';
	import ReportShareBar from '#lib/components/ReportShareBar.svelte';
	import { PERSONAL_COLOURS } from '#lib/domain.js';
	import { REPORT_PERIOD_TABS } from '#lib/report-periods.js';
	import { resolve } from '$app/paths';

	let { data } = $props();
	const period = $derived(data.reportPeriod);
	const stats = $derived(data.reportStats);
	const isFamily = $derived(data.selectedProfile.kind === 'family');
	const periodParam = $derived(
		REPORT_PERIOD_TABS.find((tab) => tab.kind === period.kind)!.periodParam
	);

	/** This page for `periode` and `date` (null = today), keeping `?profil=`. */
	const reportHref = (reportPeriodParam: string, date: string | null) => {
		const query = new URLSearchParams({
			...(data.selectedProfileParam && { profil: data.selectedProfileParam }),
			periode: reportPeriodParam,
			...(date && { date })
		});
		return resolve(`/rapports?${query}`);
	};
</script>

<div class="space-y-4">
	<nav class="tabs tabs-box w-full" aria-label="Période">
		{#each REPORT_PERIOD_TABS as tab (tab.kind)}
			<a
				href={reportHref(tab.periodParam, null)}
				class={['tab flex-1', { 'tab-active': tab.kind === period.kind }]}
				aria-current={tab.kind === period.kind ? 'page' : undefined}>{tab.label}</a
			>
		{/each}
	</nav>

	<div class="flex items-center gap-2">
		<a
			href={reportHref(periodParam, period.previousDate)}
			class="btn btn-square btn-sm"
			aria-label="Période précédente"><Icon glyph="chevron-left" class="size-4" /></a
		>
		<h2 class="flex-1 text-center font-semibold first-letter:uppercase">{period.label}</h2>
		{#if period.nextDate}
			<a
				href={reportHref(periodParam, period.nextDate)}
				class="btn btn-square btn-sm"
				aria-label="Période suivante"><Icon glyph="chevron-right" class="size-4" /></a
			>
			<a href={reportHref(periodParam, null)} class="btn btn-sm">Aujourd'hui</a>
		{:else}
			<button type="button" class="btn btn-square btn-sm" disabled aria-label="Période suivante"
				><Icon glyph="chevron-right" class="size-4" /></button
			>
		{/if}
	</div>

	<div class="rounded-box bg-secondary p-4 text-secondary-content pop-edge">
		<p class="text-4xl font-bold">{formatDuration(stats.totalMinutes)}</p>
		<p>{stats.choreCount} tâche{stats.choreCount > 1 ? 's' : ''}</p>
		<p class="text-sm opacity-80">
			{formatSignedDuration(stats.totalMinutes - stats.previousTotalMinutes)} vs {period.previousLabel}
		</p>
	</div>

	{#if period.buckets.length}
		<section class="rounded-box bg-base-100 p-3 pop-edge" aria-labelledby="over-time">
			<h3 id="over-time" class="mb-2 text-sm font-semibold">Dans le temps</h3>
			<ReportOverTimeBars
				periodBuckets={period.buckets}
				bucketStats={stats.buckets}
				stackedByPerson={isFamily}
			/>
		</section>
	{/if}

	<section class="rounded-box bg-base-100 p-3 pop-edge" aria-labelledby="by-type">
		<h3 id="by-type" class="mb-2 text-sm font-semibold">Par type</h3>
		<ul>
			{#each stats.byType as typeRow (typeRow.choreTypeId)}
				<ReportShareBar minutes={typeRow.minutes} percent={typeRow.percent}>
					<span aria-hidden="true">{typeRow.icon}</span>
					<span title={typeRow.fullLabel}>{typeRow.shortLabel}</span>
					<span class="opacity-70">×{typeRow.count}</span>
				</ReportShareBar>
			{/each}
		</ul>
		{#if !stats.byType.length}<p class="text-sm opacity-70">Rien sur cette période.</p>{/if}
	</section>

	{#if isFamily}
		<section class="rounded-box bg-base-100 p-3 pop-edge" aria-labelledby="by-person">
			<h3 id="by-person" class="mb-2 text-sm font-semibold">Par personne</h3>
			<ul>
				{#each stats.byPerson as personRow (personRow.userId)}
					<ReportShareBar
						minutes={personRow.minutes}
						percent={personRow.percent}
						barColour={PERSONAL_COLOURS[personRow.colourKey].background}
					>
						<span class="inline-flex items-center gap-1"
							><PersonColourDot colourKey={personRow.colourKey} />{personRow.name}</span
						>
					</ReportShareBar>
				{/each}
			</ul>
			{#if !stats.byPerson.length}<p class="text-sm opacity-70">Rien sur cette période.</p>{/if}
		</section>
	{/if}
</div>
