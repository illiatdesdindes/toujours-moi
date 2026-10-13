// One Web Push to one device, VAPID-signed (spec Q20 point 3): the chore notifications' and
// Réglages' Tester's. No retry: a failure is logged, and push services keep a push for an offline
// phone for TTL_SECONDS. Copied from notakid's notification-sending.ts.
import { buildPushPayload, type VapidKeys } from '@block65/webcrypto-web-push';
import type { PushNotificationPayload } from '../domain';
import { deletePushSubscription, type SavedPushSubscription } from './push-subscriptions';

export type VapidEnv = { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string };

/** How long a push service keeps a push for a phone that's offline. */
const TTL_SECONDS = 24 * 3600;

/** `expired`: the device unsubscribed (404/410), its subscription is deleted. `failed`: logged. */
export type PushDelivery = 'sent' | 'expired' | 'failed';

export const vapidKeysFrom = (env: VapidEnv): VapidKeys | null =>
	env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
		? {
				// The push services' contact for this sender: the app itself (no owner email in TJM).
				subject: 'https://tjm.samyv.com',
				publicKey: env.VAPID_PUBLIC_KEY,
				privateKey: env.VAPID_PRIVATE_KEY
			}
		: null;

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
			title: 'Toujours Moi!',
			body: 'Les notifications marchent sur cet appareil.',
			tag: 'test',
			url: '/reglages'
		},
		vapidKeys
	);
};

export const deliverAndForgetExpired = async (
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
