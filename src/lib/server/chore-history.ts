// Historique's list (spec Q6): the chores performed by the profile on screen, newest first, by pages
// of 50 that never split a Paris day (so a day header's total is always the whole day's).
import type {
	ColourKey,
	HistoryChore,
	HistoryPage,
	SelectedProfile,
	UserRole,
	Viewer
} from '../domain';
import { startOfParisDay } from '../paris-time';
import { canEditOrDeleteChore, canSeeChoreUpdateCount } from './access-policy';

export const HISTORY_PAGE_SIZE = 50;

type HistoryRow = {
	id: string;
	chore_type_id: string;
	duration_minutes: number;
	started_at: string;
	note: string | null;
	performer_user_id: string;
	author_user_id: string;
	update_count: number;
	icon: string;
	short_label: string;
	full_label: string;
	performer_name: string;
	performer_role: UserRole;
	performer_colour_key: ColourKey;
};

// Deactivated performers and archived types still show: their chores stay (spec Q2, Q10).
const HISTORY_ROWS = `SELECT chores.id, chore_type_id, duration_minutes, started_at, note,
		performer_user_id, author_user_id, chores.update_count, icon, short_label, full_label,
		users.name AS performer_name, users.role AS performer_role,
		users.colour_key AS performer_colour_key
	FROM chores
	JOIN users ON users.id = chores.performer_user_id
	JOIN chore_types ON chore_types.id = chores.chore_type_id
	WHERE chores.deleted_at IS NULL AND (?1 IS NULL OR performer_user_id = ?1) AND started_at < ?2`;
const NEWEST_FIRST = 'ORDER BY started_at DESC, chores.id DESC';

/**
 * The page of chores that started before `before` (an ISO instant, the previous page's
 * `nextCursor`; null = the first page): the 50 newest, plus the rest of the 50th's Paris day.
 */
export const listHistoryPage = async (
	db: D1Database,
	viewer: Viewer,
	selectedProfile: SelectedProfile,
	before: string | null
): Promise<HistoryPage> => {
	const performerUserId = selectedProfile.kind === 'person' ? selectedProfile.person.id : null;
	const beforeInstant =
		before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : '9999';
	const lastOfPage = await db
		.prepare(`${HISTORY_ROWS} ${NEWEST_FIRST} LIMIT 1 OFFSET ?3`)
		.bind(performerUserId, beforeInstant, HISTORY_PAGE_SIZE - 1)
		.first<HistoryRow>();
	// Fewer than a page left: they all are the last page.
	const pageStart = lastOfPage
		? startOfParisDay(new Date(lastOfPage.started_at)).toISOString()
		: '';
	const [rows, older] = await db.batch<HistoryRow>([
		db
			.prepare(`${HISTORY_ROWS} AND started_at >= ?3 ${NEWEST_FIRST}`)
			.bind(performerUserId, beforeInstant, pageStart),
		db
			.prepare(`${HISTORY_ROWS} AND started_at < ?3 LIMIT 1`)
			.bind(performerUserId, beforeInstant, pageStart)
	]);
	return {
		chores: rows!.results.map((row) => toHistoryChore(viewer, row)),
		nextCursor: older!.results.length ? pageStart : null
	};
};

const toHistoryChore = (viewer: Viewer, row: HistoryRow): HistoryChore => ({
	id: row.id,
	choreTypeId: row.chore_type_id,
	durationMinutes: row.duration_minutes,
	startedAt: row.started_at,
	note: row.note,
	performerUserId: row.performer_user_id,
	icon: row.icon,
	shortLabel: row.short_label,
	fullLabel: row.full_label,
	performerName: row.performer_name,
	performerColourKey: row.performer_colour_key,
	canEdit: canEditOrDeleteChore(viewer, {
		performer: { id: row.performer_user_id, role: row.performer_role },
		authorUserId: row.author_user_id
	}),
	updateCount: canSeeChoreUpdateCount(viewer) ? row.update_count : null
});
