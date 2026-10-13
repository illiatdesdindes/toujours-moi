<!-- Rapports' "Dans le temps" (spec Q9, prototype 02): one CSS bar per sub-period (day or month), as tall as its share of the longest; stacked in each person's colour for Famille, the page's primary otherwise. -->
<script lang="ts">
	import { formatDuration } from '#lib/chore-timing.js';
	import { PERSONAL_COLOURS, type ReportStats } from '#lib/domain.js';
	import type { ReportBucket } from '#lib/report-periods.js';

	let {
		periodBuckets,
		bucketTotals,
		stackedByPerson
	}: {
		/** Each bar's boundaries and labels. */
		periodBuckets: ReportBucket[];
		/** Each bar's minutes, same order as `periodBuckets`. */
		bucketTotals: ReportStats['bucketTotals'];
		stackedByPerson: boolean;
	} = $props();

	const longestMinutes = $derived(
		Math.max(1, ...bucketTotals.map((bucketTotal) => bucketTotal.totalMinutes))
	);
</script>

<ul class="flex h-32 items-end gap-0.5">
	{#each periodBuckets as periodBucket, index (periodBucket.start)}
		{@const bucketTotal = bucketTotals[index]!}
		<li
			class="flex h-full flex-1 flex-col justify-end"
			title="{periodBucket.title} · {formatDuration(bucketTotal.totalMinutes)}"
		>
			<span class="sr-only">{periodBucket.title} : {formatDuration(bucketTotal.totalMinutes)}</span>
			<div
				class="flex w-full flex-col-reverse overflow-hidden rounded-t"
				style:height="{(bucketTotal.totalMinutes / longestMinutes) * 100}%"
				aria-hidden="true"
			>
				{#each bucketTotal.segments as segment (segment.userId)}
					<div
						style:flex-grow={segment.minutes}
						style:background={stackedByPerson
							? PERSONAL_COLOURS[segment.colourKey].background
							: 'var(--color-primary)'}
					></div>
				{/each}
			</div>
		</li>
	{/each}
</ul>
<div class="mt-1 flex gap-0.5 text-center text-[0.6rem] opacity-70" aria-hidden="true">
	{#each periodBuckets as periodBucket (periodBucket.start)}
		<span class="flex-1">{periodBucket.label}</span>
	{/each}
</div>
