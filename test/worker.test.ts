import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../.svelte-kit/cloudflare/_worker.js';

const fetchPage = async (path: string) => {
	const ctx = createExecutionContext();
	const res = await worker.fetch(new Request(`http://example.com${path}`), env, ctx);
	await waitOnExecutionContext(ctx);
	return res;
};

describe('worker', () => {
	it.each([
		['/', 'Accueil'],
		['/historique', 'Historique'],
		['/rapports', 'Rapports'],
		['/reglages', 'Réglages']
	])('serves %s as a French page in the Pop theme', async (path, title) => {
		const res = await fetchPage(path);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<html lang="fr" data-theme="pop"');
		expect(html).toContain(`<title>${title} · TJM</title>`);
		expect(html).toContain('crossorigin="use-credentials"');
	});

	it('answers an unknown URL with a French 404 page', async () => {
		const res = await fetchPage('/nope');
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain('<title>Page introuvable · TJM</title>');
		expect(html).toContain("Cette page n'existe pas.");
	});

	it('has a migrated local D1 database', async () => {
		const { results } = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'"
		).all();
		expect(results).toEqual([{ name: 'd1_migrations' }]);
	});
});
