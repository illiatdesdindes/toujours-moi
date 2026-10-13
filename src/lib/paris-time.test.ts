import { describe, expect, it } from 'vitest';
import {
	formatParisDayAndTime,
	fromParisDateAndTime,
	startOfParisDay,
	toParisDateAndTime
} from './paris-time';

describe('toParisDateAndTime', () => {
	it('gives the Paris wall date and time, summer and winter', () => {
		expect(toParisDateAndTime(new Date('2026-07-01T12:15:00Z'))).toEqual({
			date: '2026-07-01',
			time: '14:15'
		});
		expect(toParisDateAndTime(new Date('2026-12-31T23:30:00Z'))).toEqual({
			date: '2027-01-01',
			time: '00:30'
		});
	});
});

describe('fromParisDateAndTime', () => {
	it('is the instant of a Paris wall time, summer and winter', () => {
		expect(fromParisDateAndTime('2026-07-01', '14:15').toISOString()).toBe(
			'2026-07-01T12:15:00.000Z'
		);
		expect(fromParisDateAndTime('2026-12-01', '14:15').toISOString()).toBe(
			'2026-12-01T13:15:00.000Z'
		);
	});

	it('handles the days the clocks change', () => {
		// 25 Oct 2026, 03:00 CEST → 02:00 CET: before and after the change.
		expect(fromParisDateAndTime('2026-10-25', '01:30').toISOString()).toBe(
			'2026-10-24T23:30:00.000Z'
		);
		expect(fromParisDateAndTime('2026-10-25', '04:00').toISOString()).toBe(
			'2026-10-25T03:00:00.000Z'
		);
		// 29 Mar 2026, 02:00 CET → 03:00 CEST.
		expect(fromParisDateAndTime('2026-03-29', '01:45').toISOString()).toBe(
			'2026-03-29T00:45:00.000Z'
		);
		expect(fromParisDateAndTime('2026-03-29', '03:15').toISOString()).toBe(
			'2026-03-29T01:15:00.000Z'
		);
	});

	it('round-trips with toParisDateAndTime', () => {
		const instant = new Date('2026-10-13T12:15:00Z');
		const { date, time } = toParisDateAndTime(instant);
		expect(fromParisDateAndTime(date, time)).toEqual(instant);
	});
});

describe('formatParisDayAndTime', () => {
	const now = new Date('2026-10-13T20:00:00Z'); // Tuesday 22:00 in Paris
	it.each([
		['2026-10-13T12:15:00Z', "aujourd'hui, 14:15"],
		['2026-10-12T21:45:00Z', 'hier, 23:45'],
		['2026-10-11T22:30:00Z', 'hier, 00:30'],
		['2026-10-05T08:00:00Z', 'lundi 5 oct., 10:00']
	])('%s → %s', (instant, label) =>
		expect(formatParisDayAndTime(new Date(instant), now)).toBe(label)
	);
});

describe('startOfParisDay', () => {
	it('is Paris midnight of that day, summer, winter and on a DST change', () => {
		expect(startOfParisDay(new Date('2026-07-01T12:15:00Z')).toISOString()).toBe(
			'2026-06-30T22:00:00.000Z'
		);
		expect(startOfParisDay(new Date('2026-12-31T23:30:00Z')).toISOString()).toBe(
			'2026-12-31T23:00:00.000Z'
		);
		// 25 Oct 2026, clocks go back at 03:00: the day still starts at 00:00 summer time
		expect(startOfParisDay(new Date('2026-10-25T20:00:00Z')).toISOString()).toBe(
			'2026-10-24T22:00:00.000Z'
		);
	});
});
