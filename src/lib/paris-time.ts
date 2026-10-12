// Europe/Paris wall time (spec Q3: days are Paris days), with Intl only. The date/time inputs show
// and take Paris time whatever the device's zone; D1 keeps UTC instants.

const PARIS = 'Europe/Paris';

/** `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` in Paris (the `en-CA` trick from notakid's calendar-date.ts). */
export const toParisDateAndTime = (instant: Date) => ({
	date: new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(instant),
	time: new Intl.DateTimeFormat('fr-FR', {
		timeZone: PARIS,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(instant)
});

/** The instant Paris clocks show `time` on `date`. A time skipped in spring lands an hour later. */
export const fromParisDateAndTime = (date: string, time: string) => {
	const wallTimeAsUtc = wallTimeToUtcMs(date, time);
	// Paris is UTC+1 or +2: try the offset in force then, and once more if that crossed a change.
	let instant = wallTimeAsUtc - parisOffsetMs(new Date(wallTimeAsUtc));
	instant = wallTimeAsUtc - parisOffsetMs(new Date(instant));
	return new Date(instant);
};

const parisOffsetMs = (instant: Date) => {
	const { date, time } = toParisDateAndTime(instant);
	return wallTimeToUtcMs(date, time) - Math.floor(instant.getTime() / 60_000) * 60_000;
};

/** The wall date and time read as if they were UTC. */
const wallTimeToUtcMs = (date: string, time = '00:00') => {
	const [year, month, day] = date.split('-').map(Number) as [number, number, number];
	const [hour, minute] = time.split(':').map(Number) as [number, number];
	return Date.UTC(year, month - 1, day, hour, minute);
};

const DAY_MS = 86_400_000;

/** `aujourd'hui, 14:15`, `hier, 09:00`, `lundi 5 oct., 10:00` (prototype 02's formatDayTime). */
export const formatParisDayAndTime = (instant: Date, now: Date) => {
	const { date, time } = toParisDateAndTime(instant);
	const today = toParisDateAndTime(now).date;
	const yesterday = new Date(wallTimeToUtcMs(today) - DAY_MS).toISOString().slice(0, 10);
	const day =
		date === today
			? "aujourd'hui"
			: date === yesterday
				? 'hier'
				: new Intl.DateTimeFormat('fr-FR', {
						timeZone: PARIS,
						weekday: 'long',
						day: 'numeric',
						month: 'short'
					}).format(instant);
	return `${day}, ${time}`;
};
