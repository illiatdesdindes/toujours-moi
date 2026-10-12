import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { logChore } from '#lib/server/chore-logging.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body: unknown = await request.json().catch(() => null);
	const { status, body: answer } = await logChore(env.DB, locals.viewer, body);
	return json(answer, { status });
};
