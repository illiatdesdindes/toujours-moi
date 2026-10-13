// Réglages (spec Q10, Q2): Mon profil, Enfants, Membres and Types de tâches, per role, through the
// page's form actions and saveWithVersion().
import { env } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listPickableChoreTypes } from '../src/lib/server/chore-types';
import {
	ADMIN_ID,
	CHILD_ID,
	PARENT_ID,
	resetFamily,
	SECOND_CHILD_ID,
	seedFamily
} from './test-family';
import { accessHeaders, fetchPage, postFormAction, stubAccessCerts } from './worker-requests';

const PAPA = 'papa@exemple.fr';
const MAMAN = 'maman@exemple.fr';
const LEA = 'lea@exemple.fr';
const DISHES_ID = '01900000-0000-7000-a000-000000000001';
const COOKING_ID = '01900000-0000-7000-a000-000000000002';

const act = async (email: string, action: string, fields: Record<string, string>) =>
	postFormAction(`/reglages?/${action}`, fields, await accessHeaders(email));

const userRow = (userId: string) =>
	env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<Record<string, unknown>>();

const versionsOf = async (tableName: string, recordId: string) =>
	(
		await env.DB.prepare(
			`SELECT version_number, change_kind, changed_by_user_id FROM record_versions
			WHERE table_name = ? AND record_id = ? ORDER BY version_number`
		)
			.bind(tableName, recordId)
			.all()
	).results;

const pageHtml = async (email: string) => {
	const res = await fetchPage('/reglages', await accessHeaders(email));
	expect(res.status).toBe(200);
	return res.text();
};

const expectRefused = (
	answer: Awaited<ReturnType<typeof postFormAction>>,
	status: number,
	message: string
) => {
	expect(answer).toMatchObject({ type: 'failure', status });
	expect(answer.data).toContain(message);
};

/** The migration's chore types, put back before each test: these tests edit the catalog. */
let seededChoreTypes: Record<string, unknown>[] = [];
const restoreSeededChoreTypes = () =>
	env.DB.batch([
		env.DB.prepare('DELETE FROM chore_types'),
		...seededChoreTypes.map((row) =>
			env.DB.prepare(
				`INSERT INTO chore_types (${Object.keys(row)}) VALUES (${Object.keys(row).map(() => '?')})`
			).bind(...Object.values(row))
		)
	]);

describe('Réglages', () => {
	beforeAll(async () => {
		seededChoreTypes = (await env.DB.prepare('SELECT * FROM chore_types').all()).results;
	});
	beforeEach(async () => {
		stubAccessCerts();
		await resetFamily();
		await restoreSeededChoreTypes();
		await seedFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('shows each role its sections', async () => {
		const childPage = await pageHtml(LEA);
		expect(childPage).toContain('Mon profil');
		expect(childPage).not.toContain('Enfants');
		expect(childPage).not.toContain('Membres');
		expect(childPage).not.toContain('Types de tâches');

		const parentPage = await pageHtml(MAMAN);
		expect(parentPage).toContain('Enfants');
		expect(parentPage).toContain('value="Noé"');
		expect(parentPage).not.toContain('Membres');

		const adminPage = await pageHtml(PAPA);
		expect(adminPage).toContain('Membres');
		expect(adminPage).toContain('maman@exemple.fr');
		expect(adminPage).toContain('Types de tâches');
		expect(adminPage).not.toContain('>Enfants<');
	});

	describe('Mon profil and Enfants', () => {
		it("saves the viewer's name and colour, with a version", async () => {
			expect(
				await act(LEA, 'updatePersonDetails', { id: CHILD_ID, name: ' Léa B. ', colourKey: 'sage' })
			).toMatchObject({ type: 'success' });
			expect(await userRow(CHILD_ID)).toMatchObject({ name: 'Léa B.', colour_key: 'sage' });
			expect(await versionsOf('users', CHILD_ID)).toEqual([
				{ version_number: 0, change_kind: 'created', changed_by_user_id: ADMIN_ID },
				{ version_number: 1, change_kind: 'updated', changed_by_user_id: CHILD_ID }
			]);
		});

		it('lets a parent edit a child, not the other parent; a child only themselves', async () => {
			expect(
				await act(MAMAN, 'updatePersonDetails', {
					id: SECOND_CHILD_ID,
					name: 'Noé',
					colourKey: 'tomato'
				})
			).toMatchObject({ type: 'success' });
			expectRefused(
				await act(MAMAN, 'updatePersonDetails', { id: ADMIN_ID, name: 'Chef', colourKey: 'sage' }),
				403,
				'Tu ne peux pas modifier cette personne'
			);
			expectRefused(
				await act(LEA, 'updatePersonDetails', {
					id: SECOND_CHILD_ID,
					name: 'Nono',
					colourKey: 'sage'
				}),
				403,
				'Tu ne peux pas modifier cette personne'
			);
			expect(await userRow(ADMIN_ID)).toMatchObject({ name: 'Papa', update_count: 0 });
		});

		it('refuses a colour outside the palette and an empty name', async () => {
			expectRefused(
				await act(LEA, 'updatePersonDetails', { id: CHILD_ID, name: 'Léa', colourKey: 'pink' }),
				400,
				'Couleur inconnue'
			);
			expectRefused(
				await act(LEA, 'updatePersonDetails', { id: CHILD_ID, name: ' ', colourKey: 'sage' }),
				400,
				'Prénom manquant'
			);
			expect(await versionsOf('users', CHILD_ID)).toHaveLength(1);
		});
	});

	describe('Membres', () => {
		it('adds a member who can then get in, and reminds the admin of the Access policy', async () => {
			const answer = await act(PAPA, 'addUser', {
				email: ' Mamie@Exemple.fr ',
				name: 'Mamie',
				role: 'parent',
				colourKey: 'lavender'
			});
			expect(answer).toMatchObject({ type: 'success' });
			expect(answer.data).toContain('mamie@exemple.fr');
			const added = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
				.bind('mamie@exemple.fr')
				.first<Record<string, unknown>>();
			expect(added).toMatchObject({ name: 'Mamie', role: 'parent', colour_key: 'lavender' });
			expect(await versionsOf('users', String(added!.id))).toEqual([
				{ version_number: 0, change_kind: 'created', changed_by_user_id: ADMIN_ID }
			]);
			expect((await fetchPage('/', await accessHeaders('mamie@exemple.fr'))).status).toBe(200);

			expectRefused(
				await act(PAPA, 'addUser', {
					email: 'MAMIE@exemple.fr',
					name: 'Mamie 2',
					role: 'parent',
					colourKey: 'sage'
				}),
				400,
				'Cette adresse e-mail a déjà un profil'
			);
		});

		it('is for the admin only', async () => {
			const fields = { email: 'x@exemple.fr', name: 'X', role: 'admin', colourKey: 'sage' };
			expectRefused(await act(MAMAN, 'addUser', fields), 403, 'Réservé à l’admin');
			expectRefused(
				await act(MAMAN, 'updateUserAsAdmin', { id: PARENT_ID, ...fields }),
				403,
				'Réservé à l’admin'
			);
			expectRefused(await act(LEA, 'deactivateUser', { id: CHILD_ID }), 403, 'Réservé');
			expect(await userRow(PARENT_ID)).toMatchObject({ role: 'parent', update_count: 0 });
		});

		it('edits name, colour and role', async () => {
			expect(
				await act(PAPA, 'updateUserAsAdmin', {
					id: PARENT_ID,
					name: 'Maman',
					colourKey: 'tomato',
					role: 'admin'
				})
			).toMatchObject({ type: 'success' });
			expect(await userRow(PARENT_ID)).toMatchObject({ role: 'admin', colour_key: 'tomato' });
			// Now two admins: Papa may step down.
			expect(
				await act(PAPA, 'updateUserAsAdmin', {
					id: ADMIN_ID,
					name: 'Papa',
					colourKey: 'cornflower',
					role: 'parent'
				})
			).toMatchObject({ type: 'success' });
			expect(await userRow(ADMIN_ID)).toMatchObject({ role: 'parent' });
		});

		it("doesn't let the last active admin demote or deactivate themselves", async () => {
			const demote = { id: ADMIN_ID, name: 'Papa', colourKey: 'cornflower', role: 'parent' };
			expectRefused(
				await act(PAPA, 'updateUserAsAdmin', demote),
				400,
				'Il faut toujours au moins un admin actif'
			);
			expectRefused(
				await act(PAPA, 'deactivateUser', { id: ADMIN_ID }),
				400,
				'Il faut toujours au moins un admin actif'
			);
			expect(await userRow(ADMIN_ID)).toMatchObject({
				role: 'admin',
				deleted_at: null,
				update_count: 0
			});
		});

		it('deactivates (refused at login, chores kept) and reactivates', async () => {
			expect(await act(PAPA, 'deactivateUser', { id: CHILD_ID })).toMatchObject({
				type: 'success'
			});
			expect(await userRow(CHILD_ID)).toMatchObject({
				deleted_at: expect.any(String),
				deleted_by_user_id: ADMIN_ID
			});
			expect((await fetchPage('/', await accessHeaders(LEA))).status).toBe(403);
			expect(await pageHtml(PAPA)).toContain('Réactiver');

			expect(await act(PAPA, 'reactivateUser', { id: CHILD_ID })).toMatchObject({
				type: 'success'
			});
			expect(await userRow(CHILD_ID)).toMatchObject({ deleted_at: null, deleted_by_user_id: null });
			expect((await fetchPage('/', await accessHeaders(LEA))).status).toBe(200);
			expect((await versionsOf('users', CHILD_ID)).map((version) => version.change_kind)).toEqual([
				'created',
				'deleted',
				'updated'
			]);
		});
	});

	describe('Types de tâches', () => {
		const pickableIds = async () =>
			(await listPickableChoreTypes(env.DB)).map((choreType) => choreType.id);

		it('adds a type last in the picker', async () => {
			expect(
				await act(PAPA, 'addChoreType', { icon: '🧽', shortLabel: 'Éponge', fullLabel: '' })
			).toMatchObject({ type: 'success' });
			const picker = await listPickableChoreTypes(env.DB);
			expect(picker).toHaveLength(17);
			expect(picker.at(-1)).toMatchObject({
				icon: '🧽',
				shortLabel: 'Éponge',
				fullLabel: 'Éponge'
			});
			expect(await versionsOf('chore_types', picker.at(-1)!.id)).toEqual([
				{ version_number: 0, change_kind: 'created', changed_by_user_id: ADMIN_ID }
			]);
			expectRefused(
				await act(PAPA, 'addChoreType', { icon: 'x', shortLabel: 'Éponge' }),
				400,
				'Icône invalide'
			);
		});

		it('renames and changes the icon', async () => {
			expect(
				await act(PAPA, 'updateChoreType', {
					id: DISHES_ID,
					icon: '🧼',
					shortLabel: 'Plonge',
					fullLabel: 'La plonge'
				})
			).toMatchObject({ type: 'success' });
			expect((await listPickableChoreTypes(env.DB))[0]).toEqual({
				id: DISHES_ID,
				icon: '🧼',
				shortLabel: 'Plonge',
				fullLabel: 'La plonge'
			});
		});

		it('reorders', async () => {
			expect(await act(PAPA, 'moveChoreTypeDown', { id: DISHES_ID })).toMatchObject({
				type: 'success'
			});
			expect((await pickableIds()).slice(0, 2)).toEqual([COOKING_ID, DISHES_ID]);
			await act(PAPA, 'moveChoreTypeUp', { id: DISHES_ID });
			// At the top already: nothing moves.
			await act(PAPA, 'moveChoreTypeUp', { id: DISHES_ID });
			expect((await pickableIds()).slice(0, 2)).toEqual([DISHES_ID, COOKING_ID]);
			expect(await versionsOf('chore_types', DISHES_ID)).toHaveLength(2);
		});

		it('archives out of the picker and restores', async () => {
			await act(PAPA, 'archiveChoreType', { id: DISHES_ID });
			expect(await pickableIds()).not.toContain(DISHES_ID);
			expect(await pageHtml(PAPA)).toContain('Restaurer');
			await act(PAPA, 'restoreChoreType', { id: DISHES_ID });
			expect(await pickableIds()).toContain(DISHES_ID);
			expect(await versionsOf('chore_types', DISHES_ID)).toHaveLength(2);
		});

		it('is for the admin only', async () => {
			expectRefused(
				await act(MAMAN, 'addChoreType', { icon: '🧽', shortLabel: 'Éponge' }),
				403,
				'Réservé à l’admin'
			);
			expectRefused(await act(LEA, 'archiveChoreType', { id: DISHES_ID }), 403, 'Réservé');
			expectRefused(await act(MAMAN, 'moveChoreTypeDown', { id: DISHES_ID }), 403, 'Réservé');
			expect(await pickableIds()).toHaveLength(16);
		});
	});
});
