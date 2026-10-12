// The family the integration tests write to the test D1: ids, Papa the admin, and a clean slate.
import { env } from 'cloudflare:workers';
import { saveWithVersion } from '../src/lib/server/record-versions';

export const ADMIN_ID = '01900000-0000-7000-8000-000000000001';
export const CHILD_ID = '01900000-0000-7000-8000-000000000003';
export const papaAdmin = {
	email: 'papa@exemple.fr',
	name: 'Papa',
	role: 'admin',
	colour_key: 'cornflower'
};

/** Empties `users` and its versions. */
export const resetUsers = () =>
	env.DB.batch([
		env.DB.prepare('DELETE FROM record_versions'),
		env.DB.prepare('DELETE FROM users')
	]);

/** Writes Papa the admin through saveWithVersion, as the app would. */
export const seedAdmin = () => saveWithVersion(env.DB, 'users', ADMIN_ID, papaAdmin, ADMIN_ID);
