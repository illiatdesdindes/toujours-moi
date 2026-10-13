import { describe, expect, it } from 'vitest';
import { groupChoresByParisDay } from './history-days';

const chore = (id: string, startedAt: string, durationMinutes: number) => ({
	id,
	startedAt,
	durationMinutes
});
const NOW = new Date('2026-10-12T18:00:00Z'); // Monday 12 Oct, 20:00 in Paris

describe('groupChoresByParisDay', () => {
	it('groups newest-first chores by Paris day, with the daily total and the day label', () => {
		const days = groupChoresByParisDay(
			[
				chore('a', '2026-10-12T15:00:00.000Z', 45),
				chore('b', '2026-10-12T06:00:00.000Z', 90),
				// 23:30 UTC on the 10th is 01:30 on Sunday the 11th in Paris
				chore('c', '2026-10-10T23:30:00.000Z', 15),
				chore('d', '2026-10-08T10:00:00.000Z', 30)
			],
			NOW
		);
		expect(
			days.map(({ date, label, totalMinutes, chores }) => ({
				date,
				label,
				totalMinutes,
				ids: chores.map((c) => c.id)
			}))
		).toEqual([
			{ date: '2026-10-12', label: "aujourd'hui", totalMinutes: 135, ids: ['a', 'b'] },
			{ date: '2026-10-11', label: 'hier', totalMinutes: 15, ids: ['c'] },
			{ date: '2026-10-08', label: 'jeudi 8 oct.', totalMinutes: 30, ids: ['d'] }
		]);
	});

	it('is empty without chores', () => {
		expect(groupChoresByParisDay([], NOW)).toEqual([]);
	});
});
