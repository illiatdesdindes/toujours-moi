import { env } from 'cloudflare:workers';
import { FIRST_DURATION_MINUTES, isValidDurationMinutes } from '#lib/chore-timing.js';
import { readLastDurationMinutes } from '#lib/server/chore-logging.js';
import { listPickableChoreTypes } from '#lib/server/chore-types.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [choreTypes, lastDurationMinutes] = await Promise.all([
		listPickableChoreTypes(env.DB),
		readLastDurationMinutes(env.DB, locals.viewer.id)
	]);
	return {
		choreTypes,
		// Spec Q4: the viewer's last-used duration, overall.
		defaultDurationMinutes:
			lastDurationMinutes && isValidDurationMinutes(lastDurationMinutes)
				? lastDurationMinutes
				: FIRST_DURATION_MINUTES
	};
};
