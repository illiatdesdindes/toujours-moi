// Editing and soft-deleting a saved chore from Historique (spec Q6, Q7), through saveWithVersion().
import { NO_FUTURE_CHORE_MESSAGE } from '../chore-timing';
import type { UserRole, Viewer } from '../domain';
import { isUuidV7 } from '../uuid';
import { canEditOrDeleteChore, canLogFor } from './access-policy';
import {
	choreColumnsFrom,
	endsInTheFutureForTheServer,
	findActivePerformer,
	findChoreTypeRefusal,
	parseChoreFields
} from './chore-validation';
import { saveWithVersion } from './record-versions';

type ChoreEditingAnswer = { status: 200 } | { status: 400 | 403 | 404; message: string };

const refused = (status: 400 | 403 | 404, message: string) => ({ status, message }) as const;
const NOT_FOUND = refused(404, 'Tâche introuvable : elle a peut-être été supprimée');
const FORBIDDEN = refused(403, 'Tu ne peux pas modifier cette tâche');

/**
 * The live (not deleted) chore's current type and performer when the access policy lets the viewer
 * edit or delete it; else the refusal to answer (404 unknown or deleted, 403 not theirs to touch).
 */
const findChoreTheViewerMayEdit = async (db: D1Database, viewer: Viewer, choreId: unknown) => {
	if (!isUuidV7(choreId)) return NOT_FOUND;
	const chore = await db
		.prepare(
			`SELECT chore_type_id, performer_user_id, author_user_id, users.role AS performer_role
			FROM chores JOIN users ON users.id = chores.performer_user_id
			WHERE chores.id = ? AND chores.deleted_at IS NULL`
		)
		.bind(choreId)
		.first<{
			chore_type_id: string;
			performer_user_id: string;
			author_user_id: string;
			performer_role: UserRole;
		}>();
	if (!chore) return NOT_FOUND;
	const allowed = canEditOrDeleteChore(viewer, {
		performer: { id: chore.performer_user_id, role: chore.performer_role },
		authorUserId: chore.author_user_id
	});
	return allowed
		? {
				choreId,
				choreTypeId: chore.chore_type_id,
				performerUserId: chore.performer_user_id
			}
		: FORBIDDEN;
};

/** The edit sheet's Enregistrer: every field but the author, one version per save. */
export const updateChore = async (
	db: D1Database,
	viewer: Viewer,
	body: unknown,
	now = new Date()
): Promise<ChoreEditingAnswer> => {
	const chore = parseChoreFields(body);
	if (typeof chore === 'string') return refused(400, chore);
	const existing = await findChoreTheViewerMayEdit(db, viewer, chore.id);
	if ('status' in existing) return existing;
	if (endsInTheFutureForTheServer(chore, now)) return refused(400, NO_FUTURE_CHORE_MESSAGE);
	// The chore keeps its own archived type; moving it onto another archived one is refused (Q2).
	const choreTypeRefusal = await findChoreTypeRefusal(db, chore.choreTypeId, {
		archivedTypeAllowed: chore.choreTypeId === existing.choreTypeId
	});
	if (choreTypeRefusal) return refused(400, choreTypeRefusal);
	// Keeping the performer is always fine, even a deactivated one (the admin fixing Maman's note,
	// spec Q6 "Admin: everything"). Handing it to someone else is logging for them (Q3).
	if (chore.performerUserId !== existing.performerUserId) {
		const performer = await findActivePerformer(db, chore.performerUserId);
		if (!performer) return refused(400, 'Personne inconnue');
		if (!canLogFor(viewer, performer))
			return refused(403, 'Tu ne peux pas noter une tâche pour cette personne');
	}
	await saveWithVersion(db, 'chores', chore.id, choreColumnsFrom(chore), viewer.id);
	return { status: 200 };
};

/** Supprimer: the soft delete (spec Q7). The chore leaves Historique and the reports. */
export const deleteChore = async (
	db: D1Database,
	viewer: Viewer,
	choreId: unknown,
	now = new Date()
): Promise<ChoreEditingAnswer> => {
	const existing = await findChoreTheViewerMayEdit(db, viewer, choreId);
	if ('status' in existing) return existing;
	await saveWithVersion(
		db,
		'chores',
		existing.choreId,
		{ deleted_at: now.toISOString(), deleted_by_user_id: viewer.id },
		viewer.id
	);
	return { status: 200 };
};
