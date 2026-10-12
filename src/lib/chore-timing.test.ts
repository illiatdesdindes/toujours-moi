import { describe, expect, it } from 'vitest';
import {
	clampDurationMinutes,
	deriveStartedAt,
	endsInTheFuture,
	formatDuration,
	isValidDurationMinutes
} from './chore-timing';

describe('formatDuration', () => {
	it.each([
		[15, '15 min'],
		[45, '45 min'],
		[60, '1 h'],
		[90, '1 h 30'],
		[135, '2 h 15'],
		[1440, '24 h']
	])('%i minutes → %s', (minutes, label) => expect(formatDuration(minutes)).toBe(label));
});

describe('clampDurationMinutes', () => {
	it('keeps the stepper between 15 min and 24 h', () => {
		expect(clampDurationMinutes(0)).toBe(15);
		expect(clampDurationMinutes(30)).toBe(30);
		expect(clampDurationMinutes(1455)).toBe(1440);
	});
});

describe('isValidDurationMinutes', () => {
	it('accepts multiples of 15 from 15 to 1440 only', () => {
		expect([15, 45, 1440].map(isValidDurationMinutes)).toEqual([true, true, true]);
		expect([0, 10, 1455, 22.5, Number.NaN].map(isValidDurationMinutes)).toEqual([
			false,
			false,
			false,
			false,
			false
		]);
	});
});

describe('deriveStartedAt', () => {
	it('is the tap minus the duration, on a quarter hour', () => {
		// 14:59 − 45 min = 14:14 → 14:00
		expect(deriveStartedAt(new Date('2026-10-13T14:59:00Z'), 45).toISOString()).toBe(
			'2026-10-13T14:00:00.000Z'
		);
		expect(deriveStartedAt(new Date('2026-10-13T14:45:00Z'), 45).toISOString()).toBe(
			'2026-10-13T14:00:00.000Z'
		);
	});

	it('never rounds up into a chore that ends after the tap', () => {
		// 14:08 − 15 min = 13:53: the nearest quarter (14:00) would end at 14:15.
		const tappedAt = new Date('2026-10-13T14:08:00Z');
		const startedAt = deriveStartedAt(tappedAt, 15);
		expect(startedAt.toISOString()).toBe('2026-10-13T13:45:00.000Z');
		expect(endsInTheFuture(startedAt, 15, tappedAt)).toBe(false);
	});
});

describe('endsInTheFuture', () => {
	it('is true when start + duration is after now', () => {
		const now = new Date('2026-10-13T14:00:00Z');
		expect(endsInTheFuture(new Date('2026-10-13T13:15:00Z'), 45, now)).toBe(false);
		expect(endsInTheFuture(new Date('2026-10-13T13:30:00Z'), 45, now)).toBe(true);
	});
});
