// Historique (spec Q6, Q7): the list, and editing / soft-deleting a chore per role.
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveWithVersion } from '../src/lib/server/record-versions';
import { uuidV7 } from '../src/lib/uuid';
import {
	ADMIN_ID,
	CHILD_ID,
	PARENT_ID,
	resetFamily,
	SECOND_CHILD_ID,
	seedFamily
} from './test-family';
import { accessHeaders, fetchPage, postFormAction, stubOutboundFetch } from './worker-requests';

const DISHES_ID = '01900000-0000-7000-a000-000000000001';
const COOKING_ID = '01900000-0000-7000-a000-000000000002';
const HOUR_MS = 3_600_000;
const EMAIL_OF = {
	[ADMIN_ID]: 'papa@exemple.fr',
	[PARENT_ID]: 'maman@exemple.fr',
	[CHILD_ID]: 'lea@exemple.fr',
	[SECOND_CHILD_ID]: 'noe@exemple.fr'
};
type FamilyMemberId = keyof typeof EMAIL_OF;

/** A chore performed by `performerId`, logged by `authorId`, `hoursAgo` hours ago. */
const seedChore = async (
	performerId: FamilyMemberId,
	authorId: FamilyMemberId = performerId,
	hoursAgo = 2
) => {
	const choreId = uuidV7();
	await saveWithVersion(
		env.DB,
		'chores',
		choreId,
		{
			chore_type_id: DISHES_ID,
			duration_minutes: 45,
			started_at: new Date(Date.now() - hoursAgo * HOUR_MS).toISOString(),
			performer_user_id: performerId,
			author_user_id: authorId,
			note: null
		},
		authorId
	);
	return choreId;
};

const editFields = async (choreId: string, overrides: Record<string, string> = {}) => {
	const chore = await env.DB.prepare('SELECT * FROM chores WHERE id = ?')
		.bind(choreId)
		.first<Record<string, string | number>>();
	return {
		id: choreId,
		choreTypeId: COOKING_ID,
		durationMinutes: '60',
		startedAt: String(chore!.started_at),
		note: 'avec Noé',
		performerUserId: String(chore!.performer_user_id),
		...overrides
	};
};

const updateChore = async (viewerId: FamilyMemberId, fields: Record<string, string>) =>
	postFormAction('/historique?/updateChore', fields, await accessHeaders(EMAIL_OF[viewerId]));
const deleteChore = async (viewerId: FamilyMemberId, choreId: string) =>
	postFormAction(
		'/historique?/deleteChore',
		{ id: choreId },
		await accessHeaders(EMAIL_OF[viewerId])
	);

const versionsOf = async (choreId: string) =>
	(
		await env.DB.prepare(
			`SELECT version_number, change_kind, changed_by_user_id, record_snapshot_json
			FROM record_versions WHERE table_name = 'chores' AND record_id = ? ORDER BY version_number`
		)
			.bind(choreId)
			.all<{
				version_number: number;
				change_kind: string;
				changed_by_user_id: string;
				record_snapshot_json: string;
			}>()
	).results.map(({ record_snapshot_json, ...version }) => ({
		...version,
		snapshot: JSON.parse(record_snapshot_json) as Record<string, unknown>
	}));

type HistoryPage = {
	chores: { id: string; canEdit: boolean; updateCount: number | null; performerName: string }[];
	nextCursor: string | null;
};
const fetchHistoryPage = async (viewerId: FamilyMemberId, query = '') => {
	const res = await fetchPage(`/api/chores${query}`, {
		...(await accessHeaders(EMAIL_OF[viewerId])),
		Accept: 'application/json'
	});
	return { status: res.status, page: res.ok ? ((await res.json()) as HistoryPage) : null };
};

describe('Historique', () => {
	beforeEach(async () => {
		stubOutboundFetch();
		await resetFamily();
		await seedFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	describe('who may edit and delete a chore (spec Q6)', () => {
		const cases: [string, FamilyMemberId, FamilyMemberId, FamilyMemberId, boolean][] = [
			// viewer, performer, author, allowed
			['a child, their own chore', CHILD_ID, CHILD_ID, CHILD_ID, true],
			['a child, their chore a parent logged for them', CHILD_ID, CHILD_ID, PARENT_ID, false],
			["a child, another child's chore", CHILD_ID, SECOND_CHILD_ID, SECOND_CHILD_ID, false],
			['a parent, their own chore', PARENT_ID, PARENT_ID, PARENT_ID, true],
			["a parent, a child's chore", PARENT_ID, CHILD_ID, CHILD_ID, true],
			["a parent, the other parent's chore", PARENT_ID, ADMIN_ID, ADMIN_ID, false],
			["the admin, a parent's chore", ADMIN_ID, PARENT_ID, PARENT_ID, true]
		];
		const label = (viewer: FamilyMemberId, performer: FamilyMemberId, author: FamilyMemberId) =>
			`${viewer} on ${performer}/${author}`;

		it.each(cases)('edit: %s', async (_, viewerId, performerId, authorId, allowed) => {
			const choreId = await seedChore(performerId, authorId);
			const answer = await updateChore(viewerId, await editFields(choreId));
			expect(answer.status, label(viewerId, performerId, authorId)).toBe(allowed ? 200 : 403);
			const versions = await versionsOf(choreId);
			if (!allowed) {
				expect(versions).toHaveLength(1);
				return;
			}
			expect(versions).toEqual([
				expect.objectContaining({ version_number: 0, change_kind: 'created' }),
				{
					version_number: 1,
					change_kind: 'updated',
					changed_by_user_id: viewerId,
					snapshot: expect.objectContaining({
						chore_type_id: COOKING_ID,
						duration_minutes: 60,
						note: 'avec Noé',
						performer_user_id: performerId,
						author_user_id: authorId,
						update_count: 1,
						deleted_at: null
					})
				}
			]);
		});

		it.each(cases)('delete: %s', async (_, viewerId, performerId, authorId, allowed) => {
			const choreId = await seedChore(performerId, authorId);
			const answer = await deleteChore(viewerId, choreId);
			expect(answer.status, label(viewerId, performerId, authorId)).toBe(allowed ? 200 : 403);
			const row = await env.DB.prepare(
				'SELECT deleted_at, deleted_by_user_id FROM chores WHERE id = ?'
			)
				.bind(choreId)
				.first<{ deleted_at: string | null; deleted_by_user_id: string | null }>();
			const versions = await versionsOf(choreId);
			if (!allowed) {
				expect(row).toEqual({ deleted_at: null, deleted_by_user_id: null });
				expect(versions).toHaveLength(1);
				return;
			}
			expect(row?.deleted_by_user_id).toBe(viewerId);
			expect(versions.at(-1)).toEqual({
				version_number: 1,
				change_kind: 'deleted',
				changed_by_user_id: viewerId,
				snapshot: expect.objectContaining({
					deleted_at: row?.deleted_at,
					deleted_by_user_id: viewerId,
					update_count: 1
				})
			});
		});
	});

	it('writes one more version per save', async () => {
		const choreId = await seedChore(ADMIN_ID);
		await updateChore(ADMIN_ID, await editFields(choreId, { durationMinutes: '30' }));
		await updateChore(ADMIN_ID, await editFields(choreId, { durationMinutes: '10' }));
		expect((await versionsOf(choreId)).map((version) => version.version_number)).toEqual([0, 1, 2]);
	});

	it('refuses an edit that ends in the future or an invalid duration, writing nothing', async () => {
		const choreId = await seedChore(ADMIN_ID);
		const future = await updateChore(
			ADMIN_ID,
			await editFields(choreId, { startedAt: new Date(Date.now() + HOUR_MS).toISOString() })
		);
		expect(future.status).toBe(400);
		expect(future.data).toContain('Pas de tâche dans le futur');
		expect(
			(await updateChore(ADMIN_ID, await editFields(choreId, { durationMinutes: '22' }))).status
		).toBe(400);
		expect(await versionsOf(choreId)).toHaveLength(1);
	});

	it('lets a parent hand a chore only to someone they may log for', async () => {
		const choreId = await seedChore(CHILD_ID);
		expect(
			(await updateChore(PARENT_ID, await editFields(choreId, { performerUserId: ADMIN_ID })))
				.status
		).toBe(403);
		expect(
			(
				await updateChore(
					PARENT_ID,
					await editFields(choreId, { performerUserId: SECOND_CHILD_ID })
				)
			).status
		).toBe(200);
	});

	it('lets the admin edit a parent’s chore without changing who did it', async () => {
		const choreId = await seedChore(PARENT_ID);
		expect((await updateChore(ADMIN_ID, await editFields(choreId))).status).toBe(200);
	});

	it('keeps a chore’s own archived type but refuses moving it onto another archived one', async () => {
		const choreId = await seedChore(ADMIN_ID);
		await env.DB.prepare(
			"UPDATE chore_types SET archived_at = '2026-10-01T00:00:00Z' WHERE id IN (?, ?)"
		)
			.bind(DISHES_ID, COOKING_ID)
			.run();
		try {
			const onAnotherArchivedType = await updateChore(ADMIN_ID, await editFields(choreId));
			expect(onAnotherArchivedType.status).toBe(400);
			expect(onAnotherArchivedType.data).toContain('Type de tâche archivé');
			expect(
				(await updateChore(ADMIN_ID, await editFields(choreId, { choreTypeId: DISHES_ID }))).status
			).toBe(200);
		} finally {
			await env.DB.prepare('UPDATE chore_types SET archived_at = NULL WHERE id IN (?, ?)')
				.bind(DISHES_ID, COOKING_ID)
				.run();
		}
	});

	it('lets the admin edit a deactivated person’s chore, but not hand a chore to them', async () => {
		const deactivatedPersonsChoreId = await seedChore(PARENT_ID);
		const adminsChoreId = await seedChore(ADMIN_ID);
		await env.DB.prepare("UPDATE users SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = ?")
			.bind(PARENT_ID)
			.run();
		expect((await updateChore(ADMIN_ID, await editFields(deactivatedPersonsChoreId))).status).toBe(
			200
		);
		expect(
			(await updateChore(ADMIN_ID, await editFields(adminsChoreId, { performerUserId: PARENT_ID })))
				.status
		).toBe(400);
	});

	it('answers 404 for an unknown or already deleted chore', async () => {
		const choreId = await seedChore(ADMIN_ID);
		expect((await deleteChore(ADMIN_ID, choreId)).status).toBe(200);
		expect((await deleteChore(ADMIN_ID, choreId)).status).toBe(404);
		expect((await updateChore(ADMIN_ID, await editFields(choreId))).status).toBe(404);
		expect((await deleteChore(ADMIN_ID, uuidV7())).status).toBe(404);
	});

	it('answers 400 to a malformed chore id, on update and delete alike', async () => {
		expect((await deleteChore(ADMIN_ID, 'x')).status).toBe(400);
		expect(
			(
				await updateChore(ADMIN_ID, {
					...(await editFields(await seedChore(ADMIN_ID))),
					id: 'nope'
				})
			).status
		).toBe(400);
	});

	describe('the list', () => {
		it("shows the profile's chores, newest first, and drops deleted ones", async () => {
			const older = await seedChore(CHILD_ID, CHILD_ID, 30);
			const newer = await seedChore(CHILD_ID, PARENT_ID, 3);
			const deleted = await seedChore(CHILD_ID, CHILD_ID, 5);
			await seedChore(SECOND_CHILD_ID);
			await deleteChore(CHILD_ID, deleted);

			const { page } = await fetchHistoryPage(CHILD_ID);
			expect(page).toEqual({
				chores: [
					expect.objectContaining({ id: newer, canEdit: false, updateCount: null }),
					expect.objectContaining({ id: older, canEdit: true, updateCount: null })
				],
				nextCursor: null
			});
		});

		it('shows Famille everyone, with who did it, and the update count to the admin only', async () => {
			const maman = await seedChore(PARENT_ID, PARENT_ID, 1);
			const lea = await seedChore(CHILD_ID, CHILD_ID, 2);
			await updateChore(PARENT_ID, await editFields(maman));

			const asAdmin = await fetchHistoryPage(ADMIN_ID, '?profil=famille');
			expect(asAdmin.page?.chores).toEqual([
				expect.objectContaining({ id: maman, performerName: 'Maman', updateCount: 1 }),
				expect.objectContaining({ id: lea, performerName: 'Léa', updateCount: 0 })
			]);
			const asParent = await fetchHistoryPage(PARENT_ID, '?profil=famille');
			expect(asParent.page?.chores).toEqual([
				expect.objectContaining({ id: maman, canEdit: true, updateCount: null }),
				expect.objectContaining({ id: lea, canEdit: true, updateCount: null })
			]);
			expect((await fetchHistoryPage(CHILD_ID, '?profil=famille')).status).toBe(403);
		});

		it('pages by 50, never splitting a day', async () => {
			// 52 chores on 15 Jan (more than a page), then 3 on each of the 2 days before.
			const startedAts = [
				...Array.from({ length: 52 }, (_, i) => Date.UTC(2026, 0, 15, 10, i * 10)),
				...[14, 13].flatMap((day) => [9, 12, 15].map((hour) => Date.UTC(2026, 0, day, hour)))
			];
			await Promise.all(
				startedAts.map((startedAt) =>
					seedChore(ADMIN_ID, ADMIN_ID, (Date.now() - startedAt) / HOUR_MS)
				)
			);
			const first = (await fetchHistoryPage(ADMIN_ID)).page!;
			expect(first.chores).toHaveLength(52);
			expect(first.nextCursor).toBe('2026-01-14T23:00:00.000Z'); // 15 Jan, 00:00 in Paris

			const rest = (
				await fetchHistoryPage(ADMIN_ID, `?avant=${encodeURIComponent(first.nextCursor!)}`)
			).page!;
			expect(rest).toEqual({ chores: expect.any(Array), nextCursor: null });
			expect(rest.chores).toHaveLength(6);
		});
	});

	it('server-renders the day groups with their totals', async () => {
		await seedChore(ADMIN_ID, ADMIN_ID, 0.75);
		const res = await fetchPage('/historique', await accessHeaders('papa@exemple.fr'));
		const html = await res.text();
		expect(html).toContain("aujourd'hui");
		expect(html).toContain('45 min');
		expect(html).toContain('🍽️');
	});
});
