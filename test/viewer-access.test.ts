import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveWithVersion } from '../src/lib/server/record-versions';
import { ADMIN_ID, CHILD_ID, resetFamily, seedFamily } from './test-family';
import { accessHeaders, fetchPage, stubOutboundFetch } from './worker-requests';

const expectAccessDenied = async (res: Response) => {
	expect(res.status).toBe(403);
	const html = await res.text();
	expect(html).toContain('<html lang="fr">');
	expect(html).toContain('<h1>Accès refusé</h1>');
};

describe('viewer access', () => {
	beforeEach(async () => {
		stubOutboundFetch();
		await resetFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('makes the first verified login the admin while users is empty, and only that one', async () => {
		const res = await fetchPage('/', await accessHeaders('Papa@Exemple.fr'));
		expect(res.status).toBe(200);
		const { results: users } = await env.DB.prepare('SELECT id, email, role FROM users').all();
		expect(users).toEqual([{ id: expect.any(String), email: 'papa@exemple.fr', role: 'admin' }]);
		const { results: versions } = await env.DB.prepare(
			'SELECT table_name, record_id, version_number, change_kind, changed_by_user_id FROM record_versions'
		).all();
		const adminId = users[0]!.id;
		expect(versions).toEqual([
			{
				table_name: 'users',
				record_id: adminId,
				version_number: 0,
				change_kind: 'created',
				changed_by_user_id: adminId
			}
		]);

		await expectAccessDenied(await fetchPage('/', await accessHeaders('maman@exemple.fr')));
		expect(await env.DB.prepare('SELECT count(*) AS n FROM users').first('n')).toBe(1);
	});

	it('serves an active user', async () => {
		await seedFamily();
		const res = await fetchPage('/historique', await accessHeaders('lea@exemple.fr'));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('Léa');
	});

	it('refuses an unknown email, even one Access verified', async () => {
		await seedFamily();
		await expectAccessDenied(await fetchPage('/', await accessHeaders('voisin@exemple.fr')));
	});

	it('refuses a deactivated user', async () => {
		await seedFamily();
		const deactivatedAt = new Date().toISOString();
		await saveWithVersion(
			env.DB,
			'users',
			CHILD_ID,
			{ deleted_at: deactivatedAt, deleted_by_user_id: ADMIN_ID },
			ADMIN_ID
		);
		await expectAccessDenied(await fetchPage('/', await accessHeaders('lea@exemple.fr')));
	});

	it('refuses a request that did not come through Access, even with no users yet', async () => {
		await expectAccessDenied(await fetchPage('/'));
		expect(await env.DB.prepare('SELECT count(*) AS n FROM users').first('n')).toBe(0);
	});

	it('turns away a viewer who goes over 60 requests a minute', async () => {
		// Its own email: the limiter's counts outlive the tests (bootstraps as admin).
		const headers = await accessHeaders('boucle@exemple.fr');
		const statuses = [];
		let lastResponse: Response | undefined;
		for (let i = 0; i < 61; i++) {
			lastResponse = await fetchPage('/', headers);
			statuses.push(lastResponse.status);
		}
		expect(statuses.slice(0, 60)).toEqual(Array(60).fill(200));
		expect(statuses[60]).toBe(429);
		const html = await lastResponse!.text();
		expect(html).toContain('<h1>Trop de requêtes</h1>');
		expect(html).toContain('data-status="429"');
	});
});
