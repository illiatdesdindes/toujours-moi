// Domain types shared by the server and the pages.

export const USER_ROLES = ['admin', 'parent', 'child'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** The 8 personal colours (spec Q10, keys and order from prototypes/02-screens.html). */
export const COLOUR_KEYS = [
	'tomato',
	'tangerine',
	'mustard',
	'sage',
	'turquoise',
	'cornflower',
	'lavender',
	'raspberry'
] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];

/** The active `users` row behind a request (spec Q20 point 4). */
export type Viewer = { id: string; role: UserRole; name: string; colourKey: ColourKey };

/** Just what the access policy needs to know about a person. */
export type PersonRef = { id: string; role: UserRole };

/** A chore type as the picker shows it (spec Q2): icon + short label, full label for `title`. */
export type ChoreTypeOption = { id: string; shortLabel: string; fullLabel: string; icon: string };

/** The body of POST /api/chores: what the quick log and the edit sheet send. */
export type NewChore = {
	id: string;
	choreTypeId: string;
	durationMinutes: number;
	/** ISO UTC. */
	startedAt: string;
	note: string | null;
	performerUserId: string;
};

/** A chore's note is one line (spec Q3), this long at most. */
export const MAX_CHORE_NOTE_LENGTH = 200;
