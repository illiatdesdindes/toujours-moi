// What creating a chore (chore-logging.ts) and editing one (chore-editing.ts) both check, so they
// refuse the same things with the same French messages.
import { endsInTheFuture, isValidDurationMinutes } from '../chore-timing';
import { MAX_CHORE_NOTE_LENGTH, type ChoreFields, type UserRole } from '../domain';
import { isUuidV7 } from '../uuid';

export const INVALID_CHORE_ID_MESSAGE = 'Identifiant de tâche invalide';

/** A phone's clock may run a little ahead of the server's: don't call that the future. */
const CLOCK_SKEW_ALLOWANCE_MS = 2 * 60_000;

/** The request body as ChoreFields, or the French reason it isn't one. */
export const parseChoreFields = (body: unknown): ChoreFields | string => {
	if (!body || typeof body !== 'object') return 'Requête invalide';
	const { id, choreTypeId, durationMinutes, startedAt, note, performerUserId } = body as Record<
		string,
		unknown
	>;
	if (!isUuidV7(id)) return INVALID_CHORE_ID_MESSAGE;
	if (!isUuidV7(choreTypeId)) return 'Type de tâche inconnu';
	if (!isUuidV7(performerUserId)) return 'Personne inconnue';
	if (typeof durationMinutes !== 'number' || !isValidDurationMinutes(durationMinutes))
		return 'Durée invalide : par quarts d’heure, de 15 min à 24 h';
	if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt)))
		return 'Date de début invalide';
	if (note != null && typeof note !== 'string') return 'Note invalide';
	// One line (spec Q3).
	const oneLineNote = note?.replace(/\s+/g, ' ').trim() || null;
	if (oneLineNote && oneLineNote.length > MAX_CHORE_NOTE_LENGTH)
		return `Note trop longue (${MAX_CHORE_NOTE_LENGTH} caractères au plus)`;
	return { id, choreTypeId, durationMinutes, startedAt, note: oneLineNote, performerUserId };
};

/** Spec Q3's no-future rule, with the phone's clock allowance. */
export const endsInTheFutureForTheServer = (chore: ChoreFields, now: Date) =>
	endsInTheFuture(
		new Date(chore.startedAt),
		chore.durationMinutes,
		new Date(now.getTime() + CLOCK_SKEW_ALLOWANCE_MS)
	);

/**
 * The French reason a chore can't take this type, or null. A deleted type never; an archived one
 * only when `archivedTypeAllowed` (spec Q2: out of the picker, past chores keep it).
 */
export const findChoreTypeRefusal = async (
	db: D1Database,
	choreTypeId: string,
	{ archivedTypeAllowed }: { archivedTypeAllowed: boolean }
) => {
	const choreType = await db
		.prepare('SELECT archived_at FROM chore_types WHERE id = ? AND deleted_at IS NULL')
		.bind(choreTypeId)
		.first<{ archived_at: string | null }>();
	if (!choreType) return 'Type de tâche inconnu';
	if (choreType.archived_at && !archivedTypeAllowed) return 'Type de tâche archivé';
	return null;
};

/** The performer as the access policy needs them; null when unknown or deactivated. */
export const findActivePerformer = (db: D1Database, performerUserId: string) =>
	db
		.prepare('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL')
		.bind(performerUserId)
		.first<{ id: string; role: UserRole }>();

/** The `chores` columns the quick log and the edit sheet both write. */
export const choreColumnsFrom = (chore: ChoreFields) => ({
	chore_type_id: chore.choreTypeId,
	duration_minutes: chore.durationMinutes,
	started_at: new Date(chore.startedAt).toISOString(),
	performer_user_id: chore.performerUserId,
	note: chore.note
});
