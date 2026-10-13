// This device's push subscription, from Réglages' "Notifications sur cet appareil" (spec Q10):
// any viewer, for themselves. As notakid's /reglages/notifications.
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import {
	deletePushSubscription,
	parsePushEndpointBody,
	parsePushSubscriptionBody,
	savePushSubscription
} from '#lib/server/push-subscriptions.js';
import type { RequestHandler } from './$types';

/** `PushSubscription.toJSON()`. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const subscription = parsePushSubscriptionBody(await request.json().catch(() => null));
	if (!subscription) error(400, 'Abonnement invalide');
	await savePushSubscription(env.DB, locals.viewer.id, subscription);
	return new Response(null, { status: 204 });
};

/** `{ endpoint }`: the device turned notifications off. */
export const DELETE: RequestHandler = async ({ request }) => {
	const endpoint = parsePushEndpointBody(await request.json().catch(() => null));
	if (!endpoint) error(400, 'Abonnement invalide');
	await deletePushSubscription(env.DB, endpoint);
	return new Response(null, { status: 204 });
};
