// Rapports' periods (spec Q9): a day, a Monday-to-Sunday week, a month or a year, in Europe/Paris,
// as UTC instants D1 can compare with `started_at`, plus the sub-periods of the "over time" bars.
// Calendar maths runs on Paris dates ('YYYY-MM-DD'); only the boundaries become instants, at Paris
// midnight, so days stay whole across the clock changes (23 or 25 hours).
import { formatParisDay, fromParisDateAndTime, toParisDateAndTime } from './paris-time';

export const REPORT_PERIOD_KINDS = ['day', 'week', 'month', 'year'] as const;
export type ReportPeriodKind = (typeof REPORT_PERIOD_KINDS)[number];

/** The tabs, in order, and their `?periode=` value. */
export const REPORT_PERIOD_TABS: { kind: ReportPeriodKind; periodParam: string; label: string }[] =
	[
		{ kind: 'day', periodParam: 'jour', label: 'Jour' },
		{ kind: 'week', periodParam: 'semaine', label: 'Semaine' },
		{ kind: 'month', periodParam: 'mois', label: 'Mois' },
		{ kind: 'year', periodParam: 'annee', label: 'Année' }
	];

/** One bar of the "over time" chart: [start, end) as ISO UTC. */
export type ReportBucket = { label: string; title: string; start: string; end: string };

export type ReportPeriod = {
	kind: ReportPeriodKind;
	/** The period's first Paris day: its `?date=`. */
	firstDate: string;
	/** [start, end) as ISO UTC; the previous period is [previousStart, start). */
	start: string;
	end: string;
	previousStart: string;
	/** `semaine du 5 au 11 oct.`, lower case (the page capitalises it). */
	label: string;
	/** `la semaine précédente`, for "+1 h 15 vs la semaine précédente". */
	previousLabel: string;
	previousDate: string;
	/** Null on the current period: no future (spec Q9). */
	nextDate: string | null;
	buckets: ReportBucket[];
};

const PREVIOUS_LABELS: Record<ReportPeriodKind, string> = {
	day: 'la veille',
	week: 'la semaine précédente',
	month: 'le mois précédent',
	year: "l'année précédente"
};

/** A Paris date as a UTC midnight, so plain Date.UTC arithmetic moves it by calendar days. */
const asUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);
const toDate = (utcDate: Date) => utcDate.toISOString().slice(0, 10);
const shiftDate = (date: string, { days = 0, months = 0, years = 0 }) => {
	const utcDate = asUtcDate(date);
	return toDate(
		new Date(
			Date.UTC(
				utcDate.getUTCFullYear() + years,
				utcDate.getUTCMonth() + months,
				utcDate.getUTCDate() + days
			)
		)
	);
};
const startInstant = (date: string) => fromParisDateAndTime(date, '00:00').toISOString();
const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(asUtcDate(date));

const firstDateOf = (kind: ReportPeriodKind, date: string) => {
	if (kind === 'day') return date;
	if (kind === 'week') return shiftDate(date, { days: -((asUtcDate(date).getUTCDay() + 6) % 7) });
	if (kind === 'month') return `${date.slice(0, 7)}-01`;
	return `${date.slice(0, 4)}-01-01`;
};

const STEP: Record<ReportPeriodKind, Parameters<typeof shiftDate>[1]> = {
	day: { days: 1 },
	week: { days: 7 },
	month: { months: 1 },
	year: { years: 1 }
};
const shiftPeriod = (kind: ReportPeriodKind, firstDate: string, by: 1 | -1) => {
	const { days = 0, months = 0, years = 0 } = STEP[kind];
	return shiftDate(firstDate, { days: days * by, months: months * by, years: years * by });
};

/** Each sub-period's first date, label and title. */
const bucketDatesOf = (kind: ReportPeriodKind, firstDate: string, endDate: string) => {
	const buckets: { date: string; label: string; title: string }[] = [];
	if (kind === 'day') return buckets;
	const step = kind === 'year' ? { months: 1 } : { days: 1 };
	for (let date = firstDate; date < endDate; date = shiftDate(date, step)) {
		const dayOfMonth = Number(date.slice(8));
		if (kind === 'week')
			buckets.push({
				date,
				label: 'LMMJVSD'[buckets.length]!,
				title: formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })
			});
		else if (kind === 'month')
			buckets.push({
				date,
				label: dayOfMonth % 5 === 1 ? String(dayOfMonth) : '',
				title: formatDate(date, { day: 'numeric', month: 'short' })
			});
		else
			buckets.push({
				date,
				label: 'JFMAMJJASOND'[buckets.length]!,
				title: formatDate(date, { month: 'long' })
			});
	}
	return buckets;
};

const labelOf = (kind: ReportPeriodKind, firstDate: string, endDate: string, now: Date) => {
	if (kind === 'day') return formatParisDay(new Date(startInstant(firstDate)), now);
	if (kind === 'month') return formatDate(firstDate, { month: 'long', year: 'numeric' });
	if (kind === 'year') return firstDate.slice(0, 4);
	const lastDate = shiftDate(endDate, { days: -1 });
	const sameMonth = firstDate.slice(0, 7) === lastDate.slice(0, 7);
	const from = formatDate(
		firstDate,
		sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }
	);
	return `semaine du ${from} au ${formatDate(lastDate, { day: 'numeric', month: 'short' })}`;
};

/** The `kind` period that holds the Paris date `date`. */
export const reportPeriodFor = (kind: ReportPeriodKind, date: string, now: Date): ReportPeriod => {
	const firstDate = firstDateOf(kind, date);
	const endDate = shiftPeriod(kind, firstDate, 1);
	const previousDate = shiftPeriod(kind, firstDate, -1);
	const bucketDates = bucketDatesOf(kind, firstDate, endDate);
	return {
		kind,
		firstDate,
		start: startInstant(firstDate),
		end: startInstant(endDate),
		previousStart: startInstant(previousDate),
		label: labelOf(kind, firstDate, endDate, now),
		previousLabel: PREVIOUS_LABELS[kind],
		previousDate,
		nextDate: endDate <= toParisDateAndTime(now).date ? endDate : null,
		buckets: bucketDates.map((bucket, index) => ({
			label: bucket.label,
			title: bucket.title,
			start: startInstant(bucket.date),
			end: startInstant(bucketDates[index + 1]?.date ?? endDate)
		}))
	};
};

const isRealDate = (date: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const [year, month, day] = date.split('-').map(Number) as [number, number, number];
	return toDate(new Date(Date.UTC(year, month - 1, day))) === date;
};

/** `?periode=` and `?date=`: this week and today when missing or wrong; a future date is today. */
export const readReportPeriodParams = (searchParams: URLSearchParams, now: Date) => {
	const today = toParisDateAndTime(now).date;
	const date = searchParams.get('date') ?? '';
	return {
		kind:
			REPORT_PERIOD_TABS.find((tab) => tab.periodParam === searchParams.get('periode'))?.kind ??
			'week',
		date: isRealDate(date) && date <= today ? date : today
	};
};
