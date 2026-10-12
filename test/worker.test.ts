import { env } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveWithVersion } from '../src/lib/server/record-versions';
import { accessHeaders, fetchPage, stubAccessCerts } from './access-jwt';

const ADMIN_ID = '01900000-0000-7000-8000-000000000001';

describe('worker', () => {
	let headers: Record<string, string>;
	beforeAll(async () => {
		await env.DB.batch([
			env.DB.prepare('DELETE FROM record_versions'),
			env.DB.prepare('DELETE FROM users')
		]);
		await saveWithVersion(
			env.DB,
			'users',
			ADMIN_ID,
			{ email: 'papa@exemple.fr', name: 'Papa', role: 'admin', colour_key: 'cornflower' },
			ADMIN_ID
		);
		headers = await accessHeaders('papa@exemple.fr');
	});
	beforeEach(stubAccessCerts);
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		['/', 'Accueil'],
		['/historique', 'Historique'],
		['/rapports', 'Rapports'],
		['/reglages', 'Réglages']
	])('serves %s as a French page in the Pop theme', async (path, title) => {
		const res = await fetchPage(path, headers);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<html lang="fr" data-theme="pop"');
		expect(html).toContain(`<title>${title} · TJM</title>`);
		expect(html).toContain('crossorigin="use-credentials"');
		expect(html).toContain('Papa');
	});

	it('answers an unknown URL with a French 404 page', async () => {
		const res = await fetchPage('/nope', headers);
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain('<title>Page introuvable · TJM</title>');
		expect(html).toContain("Cette page n'existe pas.");
	});
});
