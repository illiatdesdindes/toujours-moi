import { env, waitUntil } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { listHistoryPage } from '#lib/server/chore-history.js';
import { logChore } from '#lib/server/chore-logging.js';
import { sendChoreNotifications } from '#lib/server/chore-notification-sending.js';
import { loadSelectedProfile } from '#lib/server/profile-selection.js';
import type { RequestHandler } from './$types';

/** Historique's next pages (infinite scroll): `?profil=` as the page, `?avant=` its `nextCursor`. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { profileHeader } = await loadSelectedProfile(env.DB, locals.viewer, url);
	return json(
		await listHistoryPage(
			env.DB,
			locals.viewer,
			profileHeader.selectedProfile,
			url.searchParams.get('avant')
		)
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const body: unknown = await request.json().catch(() => null);
	const { status, body: answer } = await logChore(env.DB, locals.viewer, body);
	// Spec Q11: on creation only (201), not on a retry (200); sent after the answer, not awaited by it.
	// `waitUntil` from cloudflare:workers: adapter-cloudflare 8 passes no `platform.context`.
	if (status === 201 && 'id' in answer) waitUntil(sendChoreNotifications(env.DB, env, answer.id));
	return json(answer, { status });
};
