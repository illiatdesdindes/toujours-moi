// Historique's day groups (spec Q6): newest first, one header per Paris day with its total.
import { formatParisDay, toParisDateAndTime } from './paris-time';

type DatedChore = { startedAt: string; durationMinutes: number };

/** `chores` newest first → one group per Paris day, in the same order. */
export const groupChoresByParisDay = <Chore extends DatedChore>(chores: Chore[], now: Date) => {
	const days: { date: string; label: string; totalMinutes: number; chores: Chore[] }[] = [];
	for (const chore of chores) {
		const startedAt = new Date(chore.startedAt);
		const date = toParisDateAndTime(startedAt).date;
		let day = days.at(-1);
		if (day?.date !== date) {
			day = { date, label: formatParisDay(startedAt, now), totalMinutes: 0, chores: [] };
			days.push(day);
		}
		day.chores.push(chore);
		day.totalMinutes += chore.durationMinutes;
	}
	return days;
};
