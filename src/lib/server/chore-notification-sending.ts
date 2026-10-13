// Sends a new chore's Web Push notifications (spec Q11, Q20 point 3), during the request through
// `platform.context.waitUntil`, after the chore is committed. No queue, no retry: a failure is
// logged, and push services keep a push for an offline phone for TTL_SECONDS. Delivery copied
// from notakid's notification-sending.ts.
import { buildPushPayload, type VapidKeys } from '@block65/webcrypto-web-push';
import type { PushNotificationPayload } from '../domain';
import { chooseChoreNotificationRecipients, formatChoreNotification } from './chore-notifications';
import {
	deletePushSubscription,
	listActiveUsersPushSubscriptions,
	type SavedPushSubscription
} from './push-subscriptions';
import { listActiveUsers } from './users';

export type VapidEnv = { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string };

/** How long a push service keeps a push for a phone that's offline. */
const TTL_SECONDS = 24 * 3600;

/** `expired`: the device unsubscribed (404/410), its subscription is deleted. `failed`: logged. */
export type PushDelivery = 'sent' | 'expired' | 'failed';

const vapidKeysFrom = (env: VapidEnv): VapidKeys | null =>
	env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
		? {
				// The push services' contact for this sender: the app itself (no owner email in TJM).
				subject: 'https://tjm.samyv.com',
				publicKey: env.VAPID_PUBLIC_KEY,
				privateKey: env.VAPID_PRIVATE_KEY
			}
		: null;

/** Spec Q11: one push per device of each recipient; never throws (it runs after the answer). */
export const sendChoreNotifications = async (
	db: D1Database,
	env: VapidEnv,
	choreId: string,
	now = new Date()
) => {
	try {
		const vapidKeys = vapidKeysFrom(env);
		if (!vapidKeys) return void console.error('VAPID keys missing: chore notifications not sent');
		const chore = await db
			.prepare(
				`SELECT c.performer_user_id, c.author_user_id, c.duration_minutes, c.started_at, t.short_label
				FROM chores c JOIN chore_types t ON t.id = c.chore_type_id WHERE c.id = ?`
			)
			.bind(choreId)
			.first<{
				performer_user_id: string;
				author_user_id: string;
				duration_minutes: number;
				started_at: string;
				short_label: string;
			}>();
		if (!chore) return;
		const activeUsers = await listActiveUsers(db);
		const findUser = (userId: string) => activeUsers.find((user) => user.id === userId);
		const performer = findUser(chore.performer_user_id);
		const author = findUser(chore.author_user_id);
		if (!performer || !author) return;
		const recipients = chooseChoreNotificationRecipients(
			{ performer, authorUserId: author.id },
			activeUsers
		);
		const subscriptions = await listActiveUsersPushSubscriptions(db);
		await Promise.all(
			recipients.flatMap((recipient) => {
				const payload = formatChoreNotification(
					{
						performer,
						author,
						shortLabel: chore.short_label,
						durationMinutes: chore.duration_minutes,
						startedAt: new Date(chore.started_at)
					},
					recipient,
					now
				);
				return subscriptions
					.filter((subscription) => subscription.userId === recipient.id)
					.map((subscription) => deliverAndForgetExpired(db, subscription, payload, vapidKeys));
			})
		);
	} catch (error) {
		console.error('Chore notifications not sent', String(error));
	}
};

/** Réglages' "Tester": one notification to one device, now. */
export const sendTestNotification = async (
	db: D1Database,
	env: VapidEnv,
	subscription: SavedPushSubscription
): Promise<PushDelivery> => {
	const vapidKeys = vapidKeysFrom(env);
	if (!vapidKeys) return 'failed';
	return deliverAndForgetExpired(
		db,
		subscription,
		{
			title: 'TJM',
			body: 'Les notifications marchent sur cet appareil.',
			tag: 'test',
			url: '/reglages'
		},
		vapidKeys
	);
};

const deliverAndForgetExpired = async (
	db: D1Database,
	subscription: SavedPushSubscription,
	payload: PushNotificationPayload,
	vapidKeys: VapidKeys
) => {
	const delivery = await deliver(subscription, payload, vapidKeys);
	if (delivery === 'expired') await deletePushSubscription(db, subscription.endpoint);
	return delivery;
};

const deliver = async (
	subscription: SavedPushSubscription,
	payload: PushNotificationPayload,
	vapidKeys: VapidKeys
): Promise<PushDelivery> => {
	// Host only: the endpoint itself lets anyone push to the device.
	const pushServiceHost = new URL(subscription.endpoint).host;
	try {
		const request = await buildPushPayload(
			{ data: payload, options: { ttl: TTL_SECONDS } },
			{ endpoint: subscription.endpoint, keys: subscription.keys, expirationTime: null },
			vapidKeys
		);
		const response = await fetch(subscription.endpoint, request);
		if (response.ok) return 'sent';
		if (response.status === 404 || response.status === 410) return 'expired';
		console.error('Push refused', pushServiceHost, response.status);
	} catch (error) {
		console.error('Push failed', pushServiceHost, String(error));
	}
	return 'failed';
};
