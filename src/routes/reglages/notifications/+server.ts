// This device's push subscription, from Réglages' "Notifications sur cet appareil" (spec Q10):
// any viewer, for themselves. As notakid's /reglages/notifications.
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import {
	deletePushSubscription,
	isPushEndpoint,
	parsePushSubscriptionBody,
	savePushSubscription
} from '#lib/server/push-subscriptions.js';
import type { RequestHandler } from './$types';

const readJsonBody = (request: Request): Promise<unknown> => request.json().catch(() => null);

/** `PushSubscription.toJSON()`. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const subscription = parsePushSubscriptionBody(await readJsonBody(request));
	if (!subscription) error(400, 'Abonnement invalide');
	await savePushSubscription(env.DB, locals.viewer.id, subscription);
	return new Response(null, { status: 204 });
};

/** `{ endpoint }`: the device turned notifications off. */
export const DELETE: RequestHandler = async ({ request }) => {
	const endpoint = ((await readJsonBody(request)) as { endpoint?: unknown } | null)?.endpoint;
	if (!isPushEndpoint(endpoint)) error(400, 'Abonnement invalide');
	await deletePushSubscription(env.DB, endpoint);
	return new Response(null, { status: 204 });
};
