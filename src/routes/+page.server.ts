import { env } from 'cloudflare:workers';
import { FIRST_DURATION_MINUTES, isValidDurationMinutes } from '#lib/chore-timing.js';
import { readLastDurationMinutes } from '#lib/server/chore-logging.js';
import { listPickableChoreTypes } from '#lib/server/chore-types.js';
import {
	defaultPerformerFor,
	listPerformerOptions,
	loadSelectedProfile
} from '#lib/server/profile-selection.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const [choreTypes, lastDurationMinutes, { activeMembers, selectedProfile, profileOptions }] =
		await Promise.all([
			listPickableChoreTypes(env.DB),
			readLastDurationMinutes(env.DB, locals.viewer.id),
			loadSelectedProfile(env.DB, locals.viewer, url)
		]);
	return {
		choreTypes,
		// Spec Q4: the viewer's last-used duration, overall.
		defaultDurationMinutes:
			lastDurationMinutes && isValidDurationMinutes(lastDurationMinutes)
				? lastDurationMinutes
				: FIRST_DURATION_MINUTES,
		selectedProfile,
		profileOptions,
		// Spec Q8: the profile on screen logs by default; "Fait par" for parents and admin.
		defaultPerformerUserId: defaultPerformerFor(locals.viewer, selectedProfile),
		performerOptions: listPerformerOptions(locals.viewer, activeMembers)
	};
};
