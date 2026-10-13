// Editing and soft-deleting a saved chore from Historique (spec Q6, Q7), through saveWithVersion().
import { NO_FUTURE_CHORE_MESSAGE } from '../chore-timing';
import type { UserRole, Viewer } from '../domain';
import { isUuidV7 } from '../uuid';
import { canEditOrDeleteChore, canLogFor } from './access-policy';
import {
	endsInTheFutureForTheServer,
	findChoreTypeAndPerformer,
	parseNewChore
} from './chore-logging';
import { saveWithVersion } from './record-versions';

type ChoreEditingAnswer = { status: 200 } | { status: 400 | 403 | 404; message: string };

const refused = (status: 400 | 403 | 404, message: string) => ({ status, message }) as const;
const NOT_FOUND = refused(404, 'Tâche introuvable : elle a peut-être été supprimée');
const FORBIDDEN = refused(403, 'Tu ne peux pas modifier cette tâche');

/** The live (not deleted) chore, with what canEditOrDeleteChore needs; null when there's none. */
const findEditableChore = async (db: D1Database, viewer: Viewer, choreId: unknown) => {
	if (!isUuidV7(choreId)) return NOT_FOUND;
	const chore = await db
		.prepare(
			`SELECT performer_user_id, author_user_id, users.role AS performer_role FROM chores
			JOIN users ON users.id = chores.performer_user_id
			WHERE chores.id = ? AND chores.deleted_at IS NULL`
		)
		.bind(choreId)
		.first<{ performer_user_id: string; author_user_id: string; performer_role: UserRole }>();
	if (!chore) return NOT_FOUND;
	const allowed = canEditOrDeleteChore(viewer, {
		performer: { id: chore.performer_user_id, role: chore.performer_role },
		authorUserId: chore.author_user_id
	});
	return allowed ? { choreId, performerUserId: chore.performer_user_id } : FORBIDDEN;
};

/** The edit sheet's Enregistrer: every field but the author, one version per save. */
export const updateChore = async (
	db: D1Database,
	viewer: Viewer,
	body: unknown,
	now = new Date()
): Promise<ChoreEditingAnswer> => {
	const chore = parseNewChore(body);
	if (typeof chore === 'string') return refused(400, chore);
	const existing = await findEditableChore(db, viewer, chore.id);
	if ('status' in existing) return existing;
	if (endsInTheFutureForTheServer(chore, now)) return refused(400, NO_FUTURE_CHORE_MESSAGE);
	const performer = await findChoreTypeAndPerformer(db, chore);
	if (typeof performer === 'string') return refused(400, performer);
	// Handing it to someone else is logging for them (Q3); keeping the performer is always fine
	// (the admin editing Maman's chore).
	if (performer.id !== existing.performerUserId && !canLogFor(viewer, performer))
		return refused(403, 'Tu ne peux pas noter une tâche pour cette personne');
	await saveWithVersion(
		db,
		'chores',
		chore.id,
		{
			chore_type_id: chore.choreTypeId,
			duration_minutes: chore.durationMinutes,
			started_at: new Date(chore.startedAt).toISOString(),
			performer_user_id: performer.id,
			note: chore.note
		},
		viewer.id
	);
	return { status: 200 };
};

/** Supprimer: the soft delete (spec Q7). The chore leaves Historique and the reports. */
export const deleteChore = async (
	db: D1Database,
	viewer: Viewer,
	choreId: unknown
): Promise<ChoreEditingAnswer> => {
	const existing = await findEditableChore(db, viewer, choreId);
	if ('status' in existing) return existing;
	await saveWithVersion(
		db,
		'chores',
		existing.choreId,
		{ deleted_at: new Date().toISOString(), deleted_by_user_id: viewer.id },
		viewer.id
	);
	return { status: 200 };
};
