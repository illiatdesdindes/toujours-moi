// Creating a chore (spec Q3, Q20 point 1): POST /api/chores, sent by the pending card and the
// outbox. Idempotent by the browser-made id: a retry of the same chore answers 200 and writes nothing.
import { endsInTheFuture, isValidDurationMinutes } from '../chore-timing';
import type { NewChore } from '../chore-outbox';
import { MAX_CHORE_NOTE_LENGTH, type UserRole, type Viewer } from '../domain';
import { isUuidV7 } from '../uuid';
import { canLogFor } from './access-policy';
import { saveWithVersion } from './record-versions';

/** A phone's clock may run a little ahead of the server's: don't call that the future. */
const CLOCK_SKEW_ALLOWANCE_MS = 2 * 60_000;

type ChoreLoggingAnswer = {
	status: 200 | 201 | 400 | 403 | 409;
	body: { id: string } | { message: string };
};

const refused = (status: 400 | 403 | 409, message: string): ChoreLoggingAnswer => ({
	status,
	body: { message }
});

export const logChore = async (
	db: D1Database,
	viewer: Viewer,
	body: unknown,
	now = new Date()
): Promise<ChoreLoggingAnswer> => {
	const chore = parseNewChore(body);
	if (typeof chore === 'string') return refused(400, chore);

	// A retry: the chore is already there (spec Q20 point 1: same author, or it isn't theirs).
	const existing = await findChoreAuthor(db, chore.id);
	if (existing) return answerRetry(existing, chore.id, viewer);

	const startedAt = new Date(chore.startedAt);
	if (
		endsInTheFuture(
			startedAt,
			chore.durationMinutes,
			new Date(now.getTime() + CLOCK_SKEW_ALLOWANCE_MS)
		)
	)
		return refused(400, 'Pas de tâche dans le futur');
	const [choreType, performer] = await Promise.all([
		db
			.prepare('SELECT 1 FROM chore_types WHERE id = ? AND deleted_at IS NULL')
			.bind(chore.choreTypeId)
			.first(),
		db
			.prepare('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL')
			.bind(chore.performerUserId)
			.first<{ id: string; role: UserRole }>()
	]);
	if (!choreType) return refused(400, 'Type de tâche inconnu');
	if (!performer) return refused(400, 'Personne inconnue');
	if (!canLogFor(viewer, performer))
		return refused(403, 'Tu ne peux pas noter une tâche pour cette personne');

	const saved = await saveWithVersion(
		db,
		'chores',
		chore.id,
		{
			chore_type_id: chore.choreTypeId,
			duration_minutes: chore.durationMinutes,
			started_at: startedAt.toISOString(),
			performer_user_id: performer.id,
			author_user_id: viewer.id,
			note: chore.note
		},
		viewer.id
	);
	// Lost a race with the same chore's other request: it is a retry after all.
	if (!saved) return answerRetry((await findChoreAuthor(db, chore.id))!, chore.id, viewer);
	await rememberLastDuration(db, viewer.id, chore.durationMinutes);
	return { status: 201, body: { id: chore.id } };
};

const findChoreAuthor = (db: D1Database, choreId: string) =>
	db
		.prepare('SELECT author_user_id FROM chores WHERE id = ?')
		.bind(choreId)
		.first<{ author_user_id: string }>();

const answerRetry = (existing: { author_user_id: string }, choreId: string, viewer: Viewer) =>
	existing.author_user_id === viewer.id
		? ({ status: 200, body: { id: choreId } } as const)
		: refused(409, 'Cette tâche existe déjà');

/** The home's next default duration (spec Q4). Only written when it changes: one version per change. */
const rememberLastDuration = async (db: D1Database, viewerId: string, durationMinutes: number) => {
	const viewerRow = await db
		.prepare('SELECT last_duration_minutes FROM users WHERE id = ?')
		.bind(viewerId)
		.first<{ last_duration_minutes: number | null }>();
	if (viewerRow?.last_duration_minutes !== durationMinutes)
		await saveWithVersion(
			db,
			'users',
			viewerId,
			{ last_duration_minutes: durationMinutes },
			viewerId
		);
};

/** The request body as a NewChore, or the French reason it isn't one. */
const parseNewChore = (body: unknown): NewChore | string => {
	if (!body || typeof body !== 'object') return 'Requête invalide';
	const { id, choreTypeId, durationMinutes, startedAt, note, performerUserId } = body as Record<
		string,
		unknown
	>;
	if (!isUuidV7(id)) return 'Identifiant de tâche invalide';
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
