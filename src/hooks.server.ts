import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { findOrBootstrapViewer, resolveViewerEmail } from '#lib/server/viewer-resolution.js';

export const handle: Handle = async ({ event, resolve }) => {
	const email = await resolveViewerEmail(event.request, env, { useDevViewerEmail: dev });
	if (!email) error(403, 'Accès refusé');
	// Before the users lookup, so a looping client doesn't reach D1.
	const { success } = await env.VIEWER_RATE_LIMIT.limit({ key: email });
	if (!success) error(429, 'Trop de requêtes');
	const viewer = await findOrBootstrapViewer(env.DB, email);
	if (!viewer) error(403, 'Accès refusé');
	event.locals.viewer = viewer;
	return resolve(event);
};
