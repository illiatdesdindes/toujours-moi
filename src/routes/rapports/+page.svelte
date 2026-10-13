<!-- Rapports (spec Q9, prototype 02): a day, week, month or year of the profile on screen, ‹ › through the past, never the future. Headline, over-time bars, per type, and per person for Famille. -->
<script lang="ts">
	import { formatDuration, formatSignedDuration } from '#lib/chore-timing.js';
	import PersonColourDot from '#lib/components/PersonColourDot.svelte';
	import ReportCard from '#lib/components/ReportCard.svelte';
	import ReportOverTimeBars from '#lib/components/ReportOverTimeBars.svelte';
	import ReportPeriodNav from '#lib/components/ReportPeriodNav.svelte';
	import ReportShareBar from '#lib/components/ReportShareBar.svelte';
	import { PERSONAL_COLOURS } from '#lib/domain.js';
	import { profilePageHref } from '#lib/profile-page-href.js';
	import { REPORT_PERIOD_TABS } from '#lib/report-periods.js';

	let { data } = $props();
	const period = $derived(data.reportPeriod);
	const stats = $derived(data.reportStats);
	const isFamily = $derived(data.selectedProfile.kind === 'family');
	const periodParam = $derived(
		REPORT_PERIOD_TABS.find((tab) => tab.kind === period.kind)!.periodParam
	);

	/** This page for `periode` and `date` (null = today), keeping `?profil=`. */
	const reportHref = (reportPeriodParam: string, date: string | null) =>
		profilePageHref('/rapports', data.selectedProfileParam, [
			['periode', reportPeriodParam],
			...(date ? [['date', date] as [string, string]] : [])
		]);
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

	<ReportPeriodNav
		periodLabel={period.label}
		previousHref={reportHref(periodParam, period.previousDate)}
		nextHref={period.nextDate ? reportHref(periodParam, period.nextDate) : null}
		todayHref={reportHref(periodParam, null)}
	/>

	<div class="rounded-box bg-secondary p-4 text-secondary-content pop-edge">
		<p class="text-4xl font-bold">{formatDuration(stats.totalMinutes)}</p>
		<p>{stats.choreCount} tâche{stats.choreCount > 1 ? 's' : ''}</p>
		<p class="text-sm opacity-80">
			{formatSignedDuration(stats.totalMinutes - stats.previousTotalMinutes)} vs {period.previousLabel}
		</p>
	</div>

	{#if period.buckets.length}
		<ReportCard title="Dans le temps">
			<ReportOverTimeBars
				periodBuckets={period.buckets}
				bucketTotals={stats.bucketTotals}
				stackedByPerson={isFamily}
			/>
		</ReportCard>
	{/if}

	<ReportCard title="Par type" isEmpty={!stats.byType.length}>
		<ul>
			{#each stats.byType as typeRow (typeRow.choreTypeId)}
				<ReportShareBar minutes={typeRow.minutes} percent={typeRow.percent}>
					<span aria-hidden="true">{typeRow.icon}</span>
					<span title={typeRow.fullLabel}>{typeRow.shortLabel}</span>
					<span class="opacity-70">×{typeRow.count}</span>
				</ReportShareBar>
			{/each}
		</ul>
	</ReportCard>

	{#if isFamily}
		<ReportCard title="Par personne" isEmpty={!stats.byPerson.length}>
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
		</ReportCard>
	{/if}
</div>
