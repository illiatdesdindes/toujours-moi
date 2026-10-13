import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidV7 } from '../src/lib/uuid';
import { ADMIN_ID, CHILD_ID, PARENT_ID, resetFamily, seedFamily } from './test-family';
import { accessHeaders, fetchPage, postJson, stubOutboundFetch } from './worker-requests';

const DISHES_ID = '01900000-0000-7000-a000-000000000001';
const HOUR_MS = 3_600_000;

const newChore = (overrides: Record<string, unknown> = {}) => ({
	id: uuidV7(),
	choreTypeId: DISHES_ID,
	durationMinutes: 45,
	startedAt: new Date(Date.now() - 2 * HOUR_MS).toISOString(),
	note: null,
	performerUserId: ADMIN_ID,
	...overrides
});

const logChore = async (chore: Record<string, unknown>, email = 'papa@exemple.fr') =>
	postJson('/api/chores', chore, await accessHeaders(email));

const choreRows = () =>
	env.DB.prepare('SELECT * FROM chores')
		.all()
		.then(({ results }) => results);
const choreVersions = () =>
	env.DB.prepare(
		"SELECT record_id, version_number, change_kind, changed_by_user_id FROM record_versions WHERE table_name = 'chores'"
	)
		.all()
		.then(({ results }) => results);

describe('POST /api/chores', () => {
	beforeEach(async () => {
		stubOutboundFetch();
		await resetFamily();
		await seedFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('creates the chore with its version 0, the viewer as author', async () => {
		const chore = newChore({ note: '  avec la musique  ' });
		const res = await logChore(chore);
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ id: chore.id });
		expect(await choreRows()).toEqual([
			expect.objectContaining({
				id: chore.id,
				chore_type_id: DISHES_ID,
				duration_minutes: 45,
				started_at: chore.startedAt,
				performer_user_id: ADMIN_ID,
				author_user_id: ADMIN_ID,
				note: 'avec la musique',
				update_count: 0,
				deleted_at: null
			})
		]);
		expect(await choreVersions()).toEqual([
			{
				record_id: chore.id,
				version_number: 0,
				change_kind: 'created',
				changed_by_user_id: ADMIN_ID
			}
		]);
	});

	it("doesn't duplicate a retried POST", async () => {
		const chore = newChore();
		expect((await logChore(chore)).status).toBe(201);
		const retry = await logChore(chore);
		expect(retry.status).toBe(200);
		expect(await retry.json()).toEqual({ id: chore.id });
		expect(await choreRows()).toHaveLength(1);
		expect(await choreVersions()).toHaveLength(1);
	});

	it("refuses an id that is another author's chore, and leaves it alone", async () => {
		const chore = newChore();
		await logChore(chore);
		const res = await logChore(
			{ ...chore, performerUserId: PARENT_ID, durationMinutes: 15 },
			'maman@exemple.fr'
		);
		expect(res.status).toBe(409);
		expect(await choreRows()).toEqual([
			expect.objectContaining({ author_user_id: ADMIN_ID, duration_minutes: 45 })
		]);
	});

	it.each([
		['a future chore', { startedAt: new Date(Date.now() - 10 * 60_000).toISOString() }],
		['more than 24 h', { durationMinutes: 1455 }],
		['a duration off the quarter hour', { durationMinutes: 20 }],
		['no duration', { durationMinutes: undefined }],
		['a v4 id', { id: crypto.randomUUID() }],
		['an unknown type', { choreTypeId: uuidV7() }],
		['a bad date', { startedAt: 'hier' }],
		['a note over 200 characters', { note: 'x'.repeat(201) }],
		['an unknown performer', { performerUserId: uuidV7() }]
	])('refuses %s', async (_case, overrides) => {
		const res = await logChore(newChore(overrides));
		expect(res.status).toBe(400);
		expect((await res.json()) as { message: string }).toEqual({ message: expect.any(String) });
		expect(await choreRows()).toEqual([]);
	});

	it('refuses a body that is not JSON', async () => {
		const res = await postJson('/api/chores', undefined, await accessHeaders('papa@exemple.fr'));
		expect(res.status).toBe(400);
	});

	it('lets a parent log for a child, and never a child for someone else', async () => {
		const forLea = newChore({ performerUserId: CHILD_ID });
		expect((await logChore(forLea, 'maman@exemple.fr')).status).toBe(201);
		const leaForMaman = newChore({ performerUserId: PARENT_ID });
		expect((await logChore(leaForMaman, 'lea@exemple.fr')).status).toBe(422);
		expect(await choreRows()).toEqual([
			expect.objectContaining({ performer_user_id: CHILD_ID, author_user_id: PARENT_ID })
		]);
	});

	it('still takes a chore of an archived type (one queued in the outbox before the archiving)', async () => {
		await env.DB.prepare("UPDATE chore_types SET archived_at = '2026-10-01T00:00:00Z' WHERE id = ?")
			.bind(DISHES_ID)
			.run();
		try {
			expect((await logChore(newChore())).status).toBe(201);
		} finally {
			await env.DB.prepare('UPDATE chore_types SET archived_at = NULL WHERE id = ?')
				.bind(DISHES_ID)
				.run();
		}
	});

	it("makes the chore's duration the viewer's next default on the home", async () => {
		await logChore(newChore({ durationMinutes: 90 }));
		expect(
			await env.DB.prepare('SELECT last_duration_minutes FROM users WHERE id = ?')
				.bind(ADMIN_ID)
				.first('last_duration_minutes')
		).toBe(90);
		const html = await (await fetchPage('/', await accessHeaders('papa@exemple.fr'))).text();
		expect(html).toContain('>1 h 30</output>');
		// Maman hasn't logged anything: the first default.
		const mamanHtml = await (await fetchPage('/', await accessHeaders('maman@exemple.fr'))).text();
		expect(mamanHtml).toContain('>45 min</output>');
	});
});

describe('Accueil', () => {
	beforeEach(async () => {
		stubOutboundFetch();
		await resetFamily();
		await seedFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('shows the 16 seeded chore types, icon and short label, full label for screen readers', async () => {
		const html = await (await fetchPage('/', await accessHeaders('lea@exemple.fr'))).text();
		expect(html.match(/data-chore-type-id=/g)).toHaveLength(16);
		expect(html).toContain('aria-label="Mettre / débarrasser la table"');
		expect(html).toContain('🧺');
		expect(html).toContain('Serpillière');
	});

	it('leaves archived types out of the picker', async () => {
		await env.DB.prepare(
			"UPDATE chore_types SET archived_at = '2026-10-01T00:00:00Z' WHERE type_key = 'pets'"
		).run();
		try {
			const html = await (await fetchPage('/', await accessHeaders('lea@exemple.fr'))).text();
			expect(html.match(/data-chore-type-id=/g)).toHaveLength(15);
			expect(html).not.toContain('🐾');
		} finally {
			await env.DB.prepare(
				"UPDATE chore_types SET archived_at = NULL WHERE type_key = 'pets'"
			).run();
		}
	});
});
