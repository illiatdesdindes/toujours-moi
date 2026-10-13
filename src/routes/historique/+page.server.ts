import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { listPickableChoreTypes } from '#lib/server/chore-types.js';
import { deleteChore, updateChore } from '#lib/server/chore-editing.js';
import { listHistoryPage } from '#lib/server/chore-history.js';
import { listPerformerOptions } from '#lib/server/performer-choice.js';
import { loadSelectedProfile } from '#lib/server/profile-selection.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const [choreTypes, { activeUsers, profileHeader }] = await Promise.all([
		listPickableChoreTypes(env.DB),
		loadSelectedProfile(env.DB, locals.viewer, url)
	]);
	return {
		...profileHeader,
		historyPage: await listHistoryPage(env.DB, locals.viewer, profileHeader.selectedProfile, null),
		choreTypes,
		performerOptions: listPerformerOptions(locals.viewer, activeUsers)
	};
};

const answerAction = (answer: Awaited<ReturnType<typeof updateChore>>) =>
	answer.status === 200 ? { saved: true } : fail(answer.status, { message: answer.message });

export const actions: Actions = {
	updateChore: async ({ locals, request }) => {
		const fields = Object.fromEntries(await request.formData());
		return answerAction(
			await updateChore(env.DB, locals.viewer, {
				...fields,
				durationMinutes: Number(fields.durationMinutes)
			})
		);
	},
	deleteChore: async ({ locals, request }) =>
		answerAction(await deleteChore(env.DB, locals.viewer, (await request.formData()).get('id')))
};
