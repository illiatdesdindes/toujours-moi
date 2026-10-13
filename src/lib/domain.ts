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

/** Each colour as `--color-primary` and its readable `--color-primary-content` (prototype 02). */
export const PERSONAL_COLOURS: Record<ColourKey, { background: string; content: string }> = {
	tomato: { background: '#c43a26', content: '#ffffff' },
	tangerine: { background: '#f08a24', content: '#2a1300' },
	mustard: { background: '#d9a404', content: '#241a00' },
	sage: { background: '#7fa878', content: '#10200f' },
	turquoise: { background: '#1aa39a', content: '#00201e' },
	cornflower: { background: '#4565d0', content: '#ffffff' },
	lavender: { background: '#a58bd8', content: '#1a1030' },
	raspberry: { background: '#c2185b', content: '#ffffff' }
};

/** Just what the access policy needs to know about a person. */
export type PersonRef = { id: string; role: UserRole };

/** An active `users` row, as the pages show it (the profile switcher, "Fait par"). */
export type User = PersonRef & { name: string; colourKey: ColourKey };

/** The active user behind a request (spec Q20 point 4). */
export type Viewer = User;

/** The `?profil=` value of the family profile (spec Q8); leaving it out means the viewer. */
export const FAMILY_PROFILE_PARAM = 'famille';

/** The profile on screen (spec Q8): one person, or the whole household. */
export type SelectedProfile = { kind: 'person'; person: User } | { kind: 'family' };

/** One entry of the profile switcher; `profileParam` null = the viewer (no `?profil=`). */
export type ProfileOption = {
	profileParam: string | null;
	label: string;
	/** Null for Famille, which stays neutral. */
	colourKey: ColourKey | null;
};

/** A chore type as the picker shows it (spec Q2): icon + short label, full label for `title`. */
export type ChoreTypeOption = { id: string; shortLabel: string; fullLabel: string; icon: string };

/** A chore's editable fields: the body of POST /api/chores (the quick log) and of Historique's `?/updateChore` (the edit sheet). */
export type ChoreFields = {
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

/** One Historique row (spec Q6): the chore as the edit sheet takes it, plus what the row shows. */
export type HistoryChore = ChoreFields & {
	icon: string;
	shortLabel: string;
	fullLabel: string;
	performerName: string;
	performerColourKey: ColourKey;
	performerRole: UserRole;
	/** The access policy's answer; false = the sheet opens read-only (🔒). */
	canEdit: boolean;
	/** The "✎ n" badge, admin only (spec Q6): null for everyone else. */
	updateCount: number | null;
};

/** One page of Historique; `nextCursor` (`?avant=`) fetches the next, null on the last. */
export type HistoryPage = { chores: HistoryChore[]; nextCursor: string | null };

/** Rapports' numbers for one period (spec Q9), summed in SQL by `report-stats.ts`. */
export type ReportStats = {
	totalMinutes: number;
	choreCount: number;
	previousTotalMinutes: number;
	/** Longest first. */
	byType: {
		choreTypeId: string;
		icon: string;
		shortLabel: string;
		fullLabel: string;
		minutes: number;
		count: number;
		percent: number;
	}[];
	/** Longest first; the page shows it for Famille only. */
	byPerson: {
		userId: string;
		name: string;
		colourKey: ColourKey;
		minutes: number;
		count: number;
		percent: number;
	}[];
	/** One per `period.buckets` (the sub-period boundaries), in order: each sub-period's minutes, split per person. */
	bucketTotals: {
		totalMinutes: number;
		segments: { userId: string; colourKey: ColourKey; minutes: number }[];
	}[];
};
