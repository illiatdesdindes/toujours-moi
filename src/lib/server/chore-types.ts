// The chore type catalog (spec Q2). #9 adds the admin's edits.
import type { ChoreTypeOption } from '../domain';

/** The types the picker offers: archived ones drop out, past chores keep them. */
export const listPickableChoreTypes = async (db: D1Database): Promise<ChoreTypeOption[]> => {
	const { results } = await db
		.prepare(
			`SELECT id, short_label, full_label, icon FROM chore_types
			WHERE archived_at IS NULL AND deleted_at IS NULL ORDER BY sort_order`
		)
		.all<{ id: string; short_label: string; full_label: string; icon: string }>();
	return results.map((row) => ({
		id: row.id,
		shortLabel: row.short_label,
		fullLabel: row.full_label,
		icon: row.icon
	}));
};
