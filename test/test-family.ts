// The family the integration tests write to the test D1: ids, the seed, and a clean slate.
import { env } from 'cloudflare:workers';
import { saveWithVersion } from '../src/lib/server/record-versions';

export const ADMIN_ID = '01900000-0000-7000-8000-000000000001';
export const PARENT_ID = '01900000-0000-7000-8000-000000000002';
export const CHILD_ID = '01900000-0000-7000-8000-000000000003';
export const SECOND_CHILD_ID = '01900000-0000-7000-8000-000000000004';
export const papaAdmin = {
	email: 'papa@exemple.fr',
	name: 'Papa',
	role: 'admin',
	colour_key: 'cornflower'
};

/** Empties `users`, their chores and every version. Chore types stay: the migration seeds them. */
export const resetFamily = () =>
	env.DB.batch([
		env.DB.prepare('DELETE FROM record_versions'),
		env.DB.prepare('DELETE FROM chores'),
		env.DB.prepare('DELETE FROM users')
	]);

/** Writes Papa the admin through saveWithVersion, as the app would. */
export const seedAdmin = () => saveWithVersion(env.DB, 'users', ADMIN_ID, papaAdmin, ADMIN_ID);

const otherMembers = [
	[
		PARENT_ID,
		{ email: 'maman@exemple.fr', name: 'Maman', role: 'parent', colour_key: 'raspberry' }
	],
	[CHILD_ID, { email: 'lea@exemple.fr', name: 'Léa', role: 'child', colour_key: 'turquoise' }],
	[SECOND_CHILD_ID, { email: 'noe@exemple.fr', name: 'Noé', role: 'child', colour_key: 'mustard' }]
] as const;

/** Papa (admin), Maman (parent), Léa and Noé (children), as in prototype 02. */
export const seedFamily = async () => {
	await seedAdmin();
	for (const [userId, member] of otherMembers)
		await saveWithVersion(env.DB, 'users', userId, member, ADMIN_ID);
};
