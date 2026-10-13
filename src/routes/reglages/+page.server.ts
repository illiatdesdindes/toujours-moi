import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { canManageChoreTypes, canManageMembers } from '#lib/server/access-policy.js';
import {
	addChoreType,
	listChoreTypeCatalog,
	moveChoreType,
	setChoreTypeArchived,
	updateChoreType
} from '#lib/server/chore-types.js';
import {
	addMember,
	setMemberActive,
	updateMember,
	updatePersonDetails,
	type SettingsAnswer
} from '#lib/server/member-settings.js';
import { listMembers } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

// Spec Q10: Mon profil for everyone, Enfants for parents, Membres and Types de tâches for the admin.
export const load: PageServerLoad = async ({ locals: { viewer } }) => {
	const members = await listMembers(env.DB);
	return {
		children:
			viewer.role === 'parent'
				? members.filter((member) => member.isActive && member.role === 'child')
				: null,
		members: canManageMembers(viewer) ? members : null,
		choreTypeCatalog: canManageChoreTypes(viewer) ? await listChoreTypeCatalog(env.DB) : null
	};
};

const answerAction = (answer: SettingsAnswer) =>
	answer.status === 200 ? { saved: true } : fail(answer.status, { message: answer.message });
const formFields = async (request: Request) => Object.fromEntries(await request.formData());

export const actions: Actions = {
	updatePersonDetails: async ({ locals, request }) =>
		answerAction(await updatePersonDetails(env.DB, locals.viewer, await formFields(request))),
	addMember: async ({ locals, request }) => {
		const fields = await formFields(request);
		const answer = await addMember(env.DB, locals.viewer, fields);
		// The page reminds the admin to add the same email to the Access policy (spec Q1).
		return answer.status === 200
			? { addedMemberEmail: String(fields.email).trim().toLowerCase() }
			: answerAction(answer);
	},
	updateMember: async ({ locals, request }) =>
		answerAction(await updateMember(env.DB, locals.viewer, await formFields(request))),
	deactivateMember: async ({ locals, request }) =>
		answerAction(
			await setMemberActive(env.DB, locals.viewer, (await formFields(request)).id, false)
		),
	reactivateMember: async ({ locals, request }) =>
		answerAction(
			await setMemberActive(env.DB, locals.viewer, (await formFields(request)).id, true)
		),
	addChoreType: async ({ locals, request }) =>
		answerAction(await addChoreType(env.DB, locals.viewer, await formFields(request))),
	updateChoreType: async ({ locals, request }) =>
		answerAction(await updateChoreType(env.DB, locals.viewer, await formFields(request))),
	moveChoreTypeUp: async ({ locals, request }) =>
		answerAction(await moveChoreType(env.DB, locals.viewer, (await formFields(request)).id, 'up')),
	moveChoreTypeDown: async ({ locals, request }) =>
		answerAction(
			await moveChoreType(env.DB, locals.viewer, (await formFields(request)).id, 'down')
		),
	archiveChoreType: async ({ locals, request }) =>
		answerAction(
			await setChoreTypeArchived(env.DB, locals.viewer, (await formFields(request)).id, true)
		),
	restoreChoreType: async ({ locals, request }) =>
		answerAction(
			await setChoreTypeArchived(env.DB, locals.viewer, (await formFields(request)).id, false)
		)
};
