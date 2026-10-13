// A chore's duration and start time (spec Q3, Q4).

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 24 * 60;
/** The home's duration chips (spec Q4, prototype 02). */
export const DURATION_CHIPS_MINUTES = [15, 30, 45, 60, 90, 120, 180] as const;
/** The home's duration before the viewer's first chore (prototype 02). */
export const FIRST_DURATION_MINUTES = 45;

const MINUTE_MS = 60_000;
const QUARTER_MS = 15 * MINUTE_MS;

/** `45 min`, `1 h`, `1 h 30` (prototype 02). */
export const formatDuration = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (!hours) return `${rest} min`;
	return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
};

/** Rapports' change against the previous period: `+1 h 15`, `−30 min`, `=` (prototype 02). */
export const formatSignedDuration = (minutes: number) =>
	minutes === 0 ? '=' : `${minutes > 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`;

export const clampDurationMinutes = (minutes: number) =>
	Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));

/** Multiple of 15, 15 to 1440: the `chores.duration_minutes` CHECK. */
export const isValidDurationMinutes = (minutes: number) =>
	Number.isInteger(minutes) &&
	minutes % 15 === 0 &&
	minutes >= MIN_DURATION_MINUTES &&
	minutes <= MAX_DURATION_MINUTES;

/**
 * The quick log's start time: the tap minus the duration, on a quarter hour (spec Q4). Rounded
 * down, never to the nearest: rounding up always makes the chore end after the tap, which the
 * no-future rule (Q3) refuses.
 */
export const deriveStartedAt = (tappedAt: Date, durationMinutes: number) =>
	new Date(
		Math.floor((tappedAt.getTime() - durationMinutes * MINUTE_MS) / QUARTER_MS) * QUARTER_MS
	);

/** Spec Q3's refusal, as the server, the edit sheet and the home say it. */
export const NO_FUTURE_CHORE_MESSAGE = 'Pas de tâche dans le futur';

/** Spec Q3: `started_at + duration` can't be after now. */
export const endsInTheFuture = (startedAt: Date, durationMinutes: number, now: Date) =>
	startedAt.getTime() + durationMinutes * MINUTE_MS > now.getTime();
