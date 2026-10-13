import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { listHistoryPage } from '#lib/server/chore-history.js';
import { logChore } from '#lib/server/chore-logging.js';
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
	return json(answer, { status });
};
