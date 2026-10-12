import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveWithVersion } from '../src/lib/server/record-versions';
import { ADMIN_ID, CHILD_ID, papaAdmin as admin, resetFamily } from './test-family';

const versionsOf = async (recordId: string) =>
	(
		await env.DB.prepare(
			`SELECT version_number, change_kind, changed_by_user_id, record_snapshot_json
			FROM record_versions WHERE table_name = 'users' AND record_id = ? ORDER BY version_number`
		)
			.bind(recordId)
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

const rowOf = (recordId: string) =>
	env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(recordId).first();

describe('saveWithVersion', () => {
	beforeEach(resetFamily);

	it('creates a row with version 0 holding the full row', async () => {
		expect(await saveWithVersion(env.DB, 'users', ADMIN_ID, admin, ADMIN_ID)).toEqual({
			changeKind: 'created',
			versionNumber: 0
		});
		const row = await rowOf(ADMIN_ID);
		expect(row).toMatchObject({ ...admin, update_count: 0, deleted_at: null });
		expect(await versionsOf(ADMIN_ID)).toEqual([
			{ version_number: 0, change_kind: 'created', changed_by_user_id: ADMIN_ID, snapshot: row }
		]);
	});

	it('writes exactly one version per change, numbered by update_count', async () => {
		await saveWithVersion(env.DB, 'users', ADMIN_ID, admin, ADMIN_ID);
		await saveWithVersion(
			env.DB,
			'users',
			CHILD_ID,
			{ email: 'lea@exemple.fr', name: 'Léa', role: 'child', colour_key: 'turquoise' },
			ADMIN_ID
		);
		expect(await saveWithVersion(env.DB, 'users', CHILD_ID, { name: 'Léa B.' }, CHILD_ID)).toEqual({
			changeKind: 'updated',
			versionNumber: 1
		});
		const deletedAt = '2026-10-13T10:00:00.000Z';
		expect(
			await saveWithVersion(
				env.DB,
				'users',
				CHILD_ID,
				{ deleted_at: deletedAt, deleted_by_user_id: ADMIN_ID },
				ADMIN_ID
			)
		).toEqual({ changeKind: 'deleted', versionNumber: 2 });

		const row = await rowOf(CHILD_ID);
		expect(row).toMatchObject({ name: 'Léa B.', update_count: 2, deleted_at: deletedAt });
		const versions = await versionsOf(CHILD_ID);
		expect(versions.map((version) => [version.version_number, version.change_kind])).toEqual([
			[0, 'created'],
			[1, 'updated'],
			[2, 'deleted']
		]);
		expect(versions[1]!.snapshot).toMatchObject({
			name: 'Léa B.',
			update_count: 1,
			deleted_at: null
		});
		expect(versions[1]!.changed_by_user_id).toBe(CHILD_ID);
		expect(versions[2]!.snapshot).toEqual(row);
		expect(await versionsOf(ADMIN_ID)).toHaveLength(1);
	});

	it('writes neither the change nor a version when the change is refused', async () => {
		await saveWithVersion(env.DB, 'users', ADMIN_ID, admin, ADMIN_ID);
		await expect(
			saveWithVersion(env.DB, 'users', ADMIN_ID, { role: 'boss' }, ADMIN_ID)
		).rejects.toThrow(/CHECK constraint failed/);
		expect(await rowOf(ADMIN_ID)).toMatchObject({ role: 'admin', update_count: 0 });
		expect(await versionsOf(ADMIN_ID)).toHaveLength(1);
	});

	it('writes nothing for a create that loses to a UNIQUE constraint', async () => {
		await saveWithVersion(env.DB, 'users', ADMIN_ID, admin, ADMIN_ID);
		expect(await saveWithVersion(env.DB, 'users', CHILD_ID, admin, ADMIN_ID)).toBeNull();
		expect(await rowOf(CHILD_ID)).toBeNull();
		expect(await versionsOf(CHILD_ID)).toEqual([]);
	});

	it('refuses unknown and bookkeeping columns', async () => {
		await expect(
			// @ts-expect-error: not a users column
			saveWithVersion(env.DB, 'users', ADMIN_ID, { ...admin, password: 'x' }, ADMIN_ID)
		).rejects.toThrow("can't set password");
		await expect(
			// @ts-expect-error: a bookkeeping column
			saveWithVersion(env.DB, 'users', ADMIN_ID, { ...admin, update_count: 9 }, ADMIN_ID)
		).rejects.toThrow("can't set update_count");
	});
});
