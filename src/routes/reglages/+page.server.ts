import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import {
	canManageChoreTypes,
	canManageUsers,
	canSeeChildrenSettings,
	keepsAnActiveAdmin
} from '#lib/server/access-policy.js';
import {
	addChoreType,
	listChoreTypeCatalog,
	moveChoreType,
	setChoreTypeArchived,
	updateChoreType
} from '#lib/server/chore-types.js';
import type { SettingsAnswer } from '#lib/server/settings-fields.js';
import {
	addUser,
	setUserActive,
	updateUserAsAdmin,
	updatePersonDetails
} from '#lib/server/user-settings.js';
import { listAllUsers } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

// Spec Q10: Mon profil for everyone, Enfants for parents, Membres and Types de tâches for the admin.
export const load: PageServerLoad = async ({ locals: { viewer } }) => {
	const userAccounts = await listAllUsers(env.DB);
	const activeAdminCount = userAccounts.filter(
		(userAccount) => userAccount.isActive && userAccount.role === 'admin'
	).length;
	return {
		children: canSeeChildrenSettings(viewer)
			? userAccounts.filter((userAccount) => userAccount.isActive && userAccount.role === 'child')
			: null,
		userAccounts: canManageUsers(viewer)
			? userAccounts.map((userAccount) => ({
					...userAccount,
					// The page greys out the role and Désactiver; the actions refuse them anyway.
					isLastActiveAdmin: !keepsAnActiveAdmin({
						user: userAccount,
						activeAdminCount,
						change: 'deactivate'
					})
				}))
			: null,
		choreTypeCatalog: canManageChoreTypes(viewer) ? await listChoreTypeCatalog(env.DB) : null,
		// Mon profil's notifications toggle subscribes this device with it (not a secret).
		vapidPublicKey: env.VAPID_PUBLIC_KEY
	};
};

const answerAction = (answer: SettingsAnswer) =>
	answer.status === 200 ? { saved: true } : fail(answer.status, { message: answer.message });
const formFields = async (request: Request) => Object.fromEntries(await request.formData());

export const actions: Actions = {
	updatePersonDetails: async ({ locals, request }) =>
		answerAction(await updatePersonDetails(env.DB, locals.viewer, await formFields(request))),
	addUser: async ({ locals, request }) => {
		const answer = await addUser(env.DB, locals.viewer, await formFields(request));
		// The page reminds the admin to add the same email to the Access policy (spec Q1).
		return answer.status === 200 ? { addedUserEmail: answer.addedUserEmail } : answerAction(answer);
	},
	updateUserAsAdmin: async ({ locals, request }) =>
		answerAction(await updateUserAsAdmin(env.DB, locals.viewer, await formFields(request))),
	deactivateUser: async ({ locals, request }) =>
		answerAction(await setUserActive(env.DB, locals.viewer, (await formFields(request)).id, false)),
	reactivateUser: async ({ locals, request }) =>
		answerAction(await setUserActive(env.DB, locals.viewer, (await formFields(request)).id, true)),
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
