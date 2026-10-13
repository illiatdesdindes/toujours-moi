// Creating a chore (spec Q3, Q20 point 1): POST /api/chores, sent by the pending card and the
// outbox. Idempotent by the browser-made id: a retry of the same chore answers 200 and writes nothing.
import { NO_FUTURE_CHORE_MESSAGE } from '../chore-timing';
import type { Viewer } from '../domain';
import { canLogFor } from './access-policy';
import {
	choreColumnsFrom,
	endsInTheFutureForTheServer,
	findActivePerformer,
	findChoreTypeRefusal,
	parseChoreFields
} from './chore-validation';
import { saveWithVersion } from './record-versions';

type ChoreLoggingAnswer = {
	status: 200 | 201 | 400 | 409 | 422;
	body: { id: string } | { message: string };
};

const refused = (status: 400 | 409 | 422, message: string): ChoreLoggingAnswer => ({
	status,
	body: { message }
});

export const logChore = async (
	db: D1Database,
	viewer: Viewer,
	body: unknown,
	now = new Date()
): Promise<ChoreLoggingAnswer> => {
	const chore = parseChoreFields(body);
	if (typeof chore === 'string') return refused(400, chore);

	// A retry: the chore is already there (spec Q20 point 1: same author, or it isn't theirs).
	const existingChoreAuthor = await findChoreAuthor(db, chore.id);
	if (existingChoreAuthor) return answerRetry(existingChoreAuthor, chore.id, viewer);

	if (endsInTheFutureForTheServer(chore, now)) return refused(400, NO_FUTURE_CHORE_MESSAGE);
	// Archived types still take chores: one queued in the outbox before the archiving must go through.
	const choreTypeRefusal = await findChoreTypeRefusal(db, chore.choreTypeId, {
		archivedTypeAllowed: true
	});
	if (choreTypeRefusal) return refused(400, choreTypeRefusal);
	const performer = await findActivePerformer(db, chore.performerUserId);
	if (!performer) return refused(400, 'Personne inconnue');
	// 422, not 403: the outbox drops it and says so, while a 403 (Access JWT check) is retried.
	if (!canLogFor(viewer, performer))
		return refused(422, 'Tu ne peux pas noter une tâche pour cette personne');

	const saved = await saveWithVersion(
		db,
		'chores',
		chore.id,
		{ ...choreColumnsFrom(chore), author_user_id: viewer.id },
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

const answerRetry = (
	existingChoreAuthor: { author_user_id: string },
	choreId: string,
	viewer: Viewer
) =>
	existingChoreAuthor.author_user_id === viewer.id
		? ({ status: 200, body: { id: choreId } } as const)
		: refused(409, 'Cette tâche existe déjà');

/** The duration of the user's last logged chore, null before the first one. */
export const readLastDurationMinutes = (db: D1Database, userId: string) =>
	db
		.prepare('SELECT last_duration_minutes FROM users WHERE id = ?')
		.bind(userId)
		.first<number | null>('last_duration_minutes');

/** The home's next default duration (spec Q4). Only written when it changes: one version per change. */
const rememberLastDuration = async (db: D1Database, viewerId: string, durationMinutes: number) => {
	if ((await readLastDurationMinutes(db, viewerId)) !== durationMinutes)
		await saveWithVersion(
			db,
			'users',
			viewerId,
			{ last_duration_minutes: durationMinutes },
			viewerId
		);
};
