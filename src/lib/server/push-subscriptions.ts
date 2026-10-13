// This device's Web Push subscription (spec Q10 "Notifications sur cet appareil", Q20 point 3):
// one row per browser, from Réglages' toggle. Queries as notakid's db.ts.
import { uuidV7 } from '../uuid';

/** The `PushSubscription.toJSON()` fields a push needs. */
export type SavedPushSubscription = {
	userId: string;
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

const isNonEmptyTextUpTo = (candidate: unknown, maxLength: number): candidate is string =>
	typeof candidate === 'string' && candidate.length > 0 && candidate.length <= maxLength;

/** The server fetches the endpoint: only an https URL. */
export const isPushEndpoint = (candidate: unknown): candidate is string =>
	isNonEmptyTextUpTo(candidate, 2048) &&
	URL.canParse(candidate) &&
	new URL(candidate).protocol === 'https:';

/** `{ endpoint }` from the page (untrusted): the endpoint, or null when it isn't one. */
export const parsePushEndpointBody = (body: unknown) => {
	const { endpoint } = (body ?? {}) as { endpoint?: unknown };
	return isPushEndpoint(endpoint) ? endpoint : null;
};

/** `PushSubscription.toJSON()` from the page (untrusted), or null when it isn't one. */
export const parsePushSubscriptionBody = (body: unknown) => {
	const { endpoint, keys } = (body ?? {}) as {
		endpoint?: unknown;
		keys?: { p256dh?: unknown; auth?: unknown } | null;
	};
	const [p256dh, auth] = [keys?.p256dh, keys?.auth];
	if (
		!isPushEndpoint(endpoint) ||
		!isNonEmptyTextUpTo(p256dh, 200) ||
		!isNonEmptyTextUpTo(auth, 200)
	)
		return null;
	return { endpoint, keys: { p256dh, auth } };
};

/** A device belongs to whoever subscribed it last (a shared family tablet changes hands). */
export const savePushSubscription = (
	db: D1Database,
	userId: string,
	subscription: Omit<SavedPushSubscription, 'userId'>,
	now = new Date()
) =>
	db
		.prepare(
			`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
		)
		.bind(
			uuidV7(now.getTime()),
			userId,
			subscription.endpoint,
			subscription.keys.p256dh,
			subscription.keys.auth,
			now.toISOString()
		)
		.run();

/** The device turned notifications off, or its push service says it's gone (404/410). */
export const deletePushSubscription = (db: D1Database, endpoint: string) =>
	db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();

/** Every device of the active users; deactivated users' devices get nothing. */
export const listActiveUsersPushSubscriptions = async (
	db: D1Database
): Promise<SavedPushSubscription[]> => {
	const { results } = await db
		.prepare(
			`SELECT s.user_id, s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
			JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL ORDER BY s.id`
		)
		.all<{ user_id: string; endpoint: string; p256dh: string; auth: string }>();
	return results.map((row) => ({
		userId: row.user_id,
		endpoint: row.endpoint,
		keys: { p256dh: row.p256dh, auth: row.auth }
	}));
};

/** One of the viewer's own devices, or null (someone else's, or gone). */
export const findViewerPushSubscription = async (
	db: D1Database,
	viewerUserId: string,
	endpoint: string
): Promise<SavedPushSubscription | null> => {
	const row = await db
		.prepare(
			`SELECT s.user_id, s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
			JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
			WHERE s.user_id = ? AND s.endpoint = ?`
		)
		.bind(viewerUserId, endpoint)
		.first<{ user_id: string; endpoint: string; p256dh: string; auth: string }>();
	return row
		? { userId: row.user_id, endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }
		: null;
};
