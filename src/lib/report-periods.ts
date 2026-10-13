// Rapports' periods (spec Q9): a day, a Monday-to-Sunday week, a month or a year, in Europe/Paris,
// as UTC instants D1 can compare with `started_at`, plus the sub-periods of the "over time" bars.
// Calendar maths runs on Paris dates ('YYYY-MM-DD'); only the boundaries become instants, at Paris
// midnight, so days stay whole across the clock changes (23 or 25 hours).
import { formatParisDay, fromParisDateAndTime, toParisDateAndTime } from './paris-time';

export const REPORT_PERIOD_KINDS = ['day', 'week', 'month', 'year'] as const;
export type ReportPeriodKind = (typeof REPORT_PERIOD_KINDS)[number];

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

/** A Paris date as a UTC midnight, so plain Date.UTC arithmetic moves it by calendar days. */
const asUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);
const formatIsoDate = (utcDate: Date) => utcDate.toISOString().slice(0, 10);
type DateShift = { days?: number; months?: number; years?: number };
const shiftDate = (date: string, { days = 0, months = 0, years = 0 }: DateShift) => {
	const utcDate = asUtcDate(date);
	return formatIsoDate(
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

type BucketLabels = (date: string, index: number) => { label: string; title: string };

/** Each kind's rules in one place: its URL param and tab, its length, where it starts, its label and its sub-periods. */
const REPORT_PERIOD_RULES: Record<
	ReportPeriodKind,
	{
		periodParam: string;
		tabLabel: string;
		/** `la semaine précédente`, for "+1 h 15 vs la semaine précédente". */
		previousLabel: string;
		periodLength: DateShift;
		firstDateOf: (date: string) => string;
		labelOf: (firstDate: string, endDate: string, now: Date) => string;
		/** The "over time" bars: one per `length` from the first date; none for a day. */
		buckets: { length: DateShift; labelsOf: BucketLabels } | null;
	}
> = {
	day: {
		periodParam: 'jour',
		tabLabel: 'Jour',
		previousLabel: 'la veille',
		periodLength: { days: 1 },
		firstDateOf: (date) => date,
		labelOf: (firstDate, _endDate, now) => formatParisDay(new Date(startInstant(firstDate)), now),
		buckets: null
	},
	week: {
		periodParam: 'semaine',
		tabLabel: 'Semaine',
		previousLabel: 'la semaine précédente',
		periodLength: { days: 7 },
		firstDateOf: (date) => shiftDate(date, { days: -((asUtcDate(date).getUTCDay() + 6) % 7) }),
		labelOf: (firstDate, endDate) => {
			const lastDate = shiftDate(endDate, { days: -1 });
			const sameMonth = firstDate.slice(0, 7) === lastDate.slice(0, 7);
			const firstDayText = formatDate(
				firstDate,
				sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }
			);
			return `semaine du ${firstDayText} au ${formatDate(lastDate, { day: 'numeric', month: 'short' })}`;
		},
		buckets: {
			length: { days: 1 },
			labelsOf: (date, index) => ({
				label: 'LMMJVSD'[index]!,
				title: formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })
			})
		}
	},
	month: {
		periodParam: 'mois',
		tabLabel: 'Mois',
		previousLabel: 'le mois précédent',
		periodLength: { months: 1 },
		firstDateOf: (date) => `${date.slice(0, 7)}-01`,
		labelOf: (firstDate) => formatDate(firstDate, { month: 'long', year: 'numeric' }),
		buckets: {
			length: { days: 1 },
			labelsOf: (date) => {
				const dayOfMonth = Number(date.slice(8));
				return {
					label: dayOfMonth % 5 === 1 ? String(dayOfMonth) : '',
					title: formatDate(date, { day: 'numeric', month: 'short' })
				};
			}
		}
	},
	year: {
		periodParam: 'annee',
		tabLabel: 'Année',
		previousLabel: "l'année précédente",
		periodLength: { years: 1 },
		firstDateOf: (date) => `${date.slice(0, 4)}-01-01`,
		labelOf: (firstDate) => firstDate.slice(0, 4),
		buckets: {
			length: { months: 1 },
			labelsOf: (date, index) => ({
				label: 'JFMAMJJASOND'[index]!,
				title: formatDate(date, { month: 'long' })
			})
		}
	}
};

/** The tabs, in order, and their `?periode=` value. */
export const REPORT_PERIOD_TABS = REPORT_PERIOD_KINDS.map((kind) => ({
	kind,
	periodParam: REPORT_PERIOD_RULES[kind].periodParam,
	label: REPORT_PERIOD_RULES[kind].tabLabel
}));

const shiftPeriod = (kind: ReportPeriodKind, firstDate: string, by: 1 | -1) => {
	const { days = 0, months = 0, years = 0 } = REPORT_PERIOD_RULES[kind].periodLength;
	return shiftDate(firstDate, { days: days * by, months: months * by, years: years * by });
};

/** Each sub-period's first date, from `firstDate` up to `endDate`. */
const bucketDatesOf = (kind: ReportPeriodKind, firstDate: string, endDate: string) => {
	const bucketDates: string[] = [];
	const bucketRules = REPORT_PERIOD_RULES[kind].buckets;
	if (!bucketRules) return bucketDates;
	for (let date = firstDate; date < endDate; date = shiftDate(date, bucketRules.length))
		bucketDates.push(date);
	return bucketDates;
};

/** The `kind` period that holds the Paris date `date`. */
export const reportPeriodFor = (kind: ReportPeriodKind, date: string, now: Date): ReportPeriod => {
	const rules = REPORT_PERIOD_RULES[kind];
	const firstDate = rules.firstDateOf(date);
	const endDate = shiftPeriod(kind, firstDate, 1);
	const previousDate = shiftPeriod(kind, firstDate, -1);
	const bucketDates = bucketDatesOf(kind, firstDate, endDate);
	return {
		kind,
		firstDate,
		start: startInstant(firstDate),
		end: startInstant(endDate),
		previousStart: startInstant(previousDate),
		label: rules.labelOf(firstDate, endDate, now),
		previousLabel: rules.previousLabel,
		previousDate,
		nextDate: endDate <= toParisDateAndTime(now).date ? endDate : null,
		buckets: bucketDates.map((bucketDate, index) => ({
			...rules.buckets!.labelsOf(bucketDate, index),
			start: startInstant(bucketDate),
			end: startInstant(bucketDates[index + 1] ?? endDate)
		}))
	};
};

const isRealDate = (date: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const [year, month, day] = date.split('-').map(Number) as [number, number, number];
	return formatIsoDate(new Date(Date.UTC(year, month - 1, day))) === date;
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
