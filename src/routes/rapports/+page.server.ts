import { env } from 'cloudflare:workers';
import { loadSelectedProfile } from '#lib/server/profile-selection.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { selectedProfile, profileOptions } = await loadSelectedProfile(env.DB, locals.viewer, url);
	return { selectedProfile, profileOptions };
};
