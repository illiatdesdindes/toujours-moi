// Réglages' "Tester": a notification to this device now, to check it receives them (spec Q10).
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { sendTestNotification, type PushDelivery } from '#lib/server/chore-notification-sending.js';
import { listActiveUsersPushSubscriptions } from '#lib/server/push-subscriptions.js';
import type { RequestHandler } from './$types';

/** 410: the device unsubscribed (its subscription is gone); 502: the push service refused it. */
const STATUS_BY_DELIVERY: Record<PushDelivery, number> = { sent: 204, expired: 410, failed: 502 };

/** `{ endpoint }`: one of the viewer's own devices. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	const subscription = (await listActiveUsersPushSubscriptions(env.DB)).find(
		(candidate) => candidate.userId === locals.viewer.id && candidate.endpoint === body?.endpoint
	);
	if (!subscription) error(404, 'Abonnement introuvable');
	return new Response(null, {
		status: STATUS_BY_DELIVERY[await sendTestNotification(env.DB, env, subscription)]
	});
};
