import { describe, expect, it } from 'vitest';
import { readReportPeriodParams, reportPeriodFor } from './report-periods';

const NOW = new Date('2026-10-13T20:00:00Z'); // Tuesday 13 Oct 2026, 22:00 in Paris

describe('reportPeriodFor', () => {
	it('a day is Paris midnight to midnight, with no buckets', () => {
		const period = reportPeriodFor('day', '2026-10-13', NOW);
		expect(period).toMatchObject({
			kind: 'day',
			firstDate: '2026-10-13',
			start: '2026-10-12T22:00:00.000Z',
			end: '2026-10-13T22:00:00.000Z',
			previousStart: '2026-10-11T22:00:00.000Z',
			label: "aujourd'hui",
			previousLabel: 'la veille',
			previousDate: '2026-10-12',
			nextDate: null,
			buckets: []
		});
		expect(reportPeriodFor('day', '2026-10-12', NOW)).toMatchObject({
			label: 'hier',
			nextDate: '2026-10-13'
		});
	});

	it('a week runs Monday to Sunday, whatever day it is given, with 7 day buckets', () => {
		const period = reportPeriodFor('week', '2026-10-08', NOW);
		expect(period).toMatchObject({
			firstDate: '2026-10-05',
			start: '2026-10-04T22:00:00.000Z',
			end: '2026-10-11T22:00:00.000Z',
			previousStart: '2026-09-27T22:00:00.000Z',
			label: 'semaine du 5 au 11 oct.',
			previousLabel: 'la semaine précédente',
			previousDate: '2026-09-28',
			nextDate: '2026-10-12'
		});
		expect(period.buckets.map((bucket) => bucket.label).join('')).toBe('LMMJVSD');
		expect(period.buckets[0]).toEqual({
			label: 'L',
			title: 'lundi 5 oct.',
			start: '2026-10-04T22:00:00.000Z',
			end: '2026-10-05T22:00:00.000Z'
		});
		// A Sunday belongs to the week before it.
		expect(reportPeriodFor('week', '2026-10-11', NOW).firstDate).toBe('2026-10-05');
	});

	it('names both months when a week spans two', () => {
		expect(reportPeriodFor('week', '2026-10-01', NOW).label).toBe('semaine du 28 sept. au 4 oct.');
	});

	it("names the year of a day or week outside now's year", () => {
		expect(reportPeriodFor('day', '2025-10-05', NOW).label).toBe('dimanche 5 oct. 2025');
		expect(reportPeriodFor('week', '2025-10-08', NOW).label).toBe('semaine du 6 au 12 oct. 2025');
		expect(reportPeriodFor('week', '2025-12-31', NOW).label).toBe(
			'semaine du 29 déc. 2025 au 4 janv. 2026'
		);
	});

	it('the current week has no next', () => {
		expect(reportPeriodFor('week', '2026-10-13', NOW)).toMatchObject({
			firstDate: '2026-10-12',
			nextDate: null
		});
	});

	it('a month has one bucket per day, labelled every 5 days', () => {
		const period = reportPeriodFor('month', '2026-02-14', NOW);
		expect(period).toMatchObject({
			firstDate: '2026-02-01',
			start: '2026-01-31T23:00:00.000Z',
			end: '2026-02-28T23:00:00.000Z',
			previousStart: '2025-12-31T23:00:00.000Z',
			label: 'février 2026',
			previousLabel: 'le mois précédent',
			previousDate: '2026-01-01',
			nextDate: '2026-03-01'
		});
		expect(period.buckets).toHaveLength(28);
		expect(period.buckets.map((bucket) => bucket.label).filter(Boolean)).toEqual([
			'1',
			'6',
			'11',
			'16',
			'21',
			'26'
		]);
		expect(period.buckets[13]!.title).toBe('14 févr.');
	});

	it('a year has 12 month buckets', () => {
		const period = reportPeriodFor('year', '2025-06-30', NOW);
		expect(period).toMatchObject({
			firstDate: '2025-01-01',
			start: '2024-12-31T23:00:00.000Z',
			end: '2025-12-31T23:00:00.000Z',
			previousStart: '2023-12-31T23:00:00.000Z',
			label: '2025',
			previousLabel: "l'année précédente",
			previousDate: '2024-01-01',
			nextDate: '2026-01-01'
		});
		expect(period.buckets.map((bucket) => bucket.label).join('')).toBe('JFMAMJJASOND');
		expect(period.buckets[9]).toEqual({
			label: 'O',
			title: 'octobre',
			start: '2025-09-30T22:00:00.000Z',
			end: '2025-10-31T23:00:00.000Z'
		});
		expect(reportPeriodFor('year', '2026-01-01', NOW).nextDate).toBeNull();
	});

	describe('across the clock changes (Europe/Paris)', () => {
		it('the day clocks go back lasts 25 hours, the day they go forward 23', () => {
			const autumn = reportPeriodFor('day', '2026-10-25', NOW);
			expect(autumn.start).toBe('2026-10-24T22:00:00.000Z');
			expect(autumn.end).toBe('2026-10-25T23:00:00.000Z');
			const spring = reportPeriodFor('day', '2026-03-29', NOW);
			expect(spring.start).toBe('2026-03-28T23:00:00.000Z');
			expect(spring.end).toBe('2026-03-29T22:00:00.000Z');
		});

		it('week buckets follow Paris midnight on both sides of the change', () => {
			const week = reportPeriodFor('week', '2026-03-29', NOW);
			expect(week.firstDate).toBe('2026-03-23');
			expect(week.buckets[5]!.end).toBe('2026-03-28T23:00:00.000Z'); // Saturday, still winter time
			expect(week.buckets[6]).toMatchObject({
				start: '2026-03-28T23:00:00.000Z',
				end: '2026-03-29T22:00:00.000Z' // Sunday ends in summer time
			});
			expect(week.end).toBe('2026-03-29T22:00:00.000Z');
		});

		it('consecutive buckets leave no gap and no overlap', () => {
			for (const kind of ['week', 'month', 'year'] as const) {
				const { buckets, start, end } = reportPeriodFor(kind, '2026-10-25', NOW);
				expect(buckets[0]!.start).toBe(start);
				expect(buckets.at(-1)!.end).toBe(end);
				buckets.slice(1).forEach((bucket, index) => expect(bucket.start).toBe(buckets[index]!.end));
			}
		});
	});
});

describe('readReportPeriodParams', () => {
	const read = (query: string) => readReportPeriodParams(new URLSearchParams(query), NOW);

	it('defaults to this week', () => {
		expect(read('')).toEqual({ kind: 'week', date: '2026-10-13' });
	});

	it('reads ?periode= and ?date=', () => {
		expect(read('periode=jour&date=2026-10-01')).toEqual({ kind: 'day', date: '2026-10-01' });
		expect(read('periode=mois')).toEqual({ kind: 'month', date: '2026-10-13' });
		expect(read('periode=annee&date=2024-02-29')).toEqual({ kind: 'year', date: '2024-02-29' });
	});

	it('falls back to this week and today on anything else, and never goes into the future', () => {
		expect(read('periode=decennie')).toEqual({ kind: 'week', date: '2026-10-13' });
		expect(read('date=2026-02-30')).toEqual({ kind: 'week', date: '2026-10-13' });
		expect(read('date=hier')).toEqual({ kind: 'week', date: '2026-10-13' });
		expect(read('date=2026-10-14')).toEqual({ kind: 'week', date: '2026-10-13' });
	});
});
