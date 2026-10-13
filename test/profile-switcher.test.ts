import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ADMIN_ID,
	CHILD_ID,
	PARENT_ID,
	resetFamily,
	SECOND_CHILD_ID,
	seedFamily
} from './test-family';
import { accessHeaders, fetchPage, stubAccessCerts } from './worker-requests';

const PROFILE_PAGES = ['/', '/historique', '/rapports'];

/** Each profile page's status for `?profil=<profileParam>`, as `email`. */
const statusesFor = async (email: string, profileParam: string) => {
	const headers = await accessHeaders(email);
	return Promise.all(
		PROFILE_PAGES.map(
			async (path) => (await fetchPage(`${path}?profil=${profileParam}`, headers)).status
		)
	);
};

describe('profile switcher (spec Q8)', () => {
	beforeEach(async () => {
		stubAccessCerts();
		await resetFamily();
		await seedFamily();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('never shows a child another profile, nor Famille', async () => {
		for (const profileParam of [SECOND_CHILD_ID, PARENT_ID, ADMIN_ID, 'famille'])
			expect(await statusesFor('lea@exemple.fr', profileParam)).toEqual([403, 403, 403]);
		expect(await statusesFor('lea@exemple.fr', CHILD_ID)).toEqual([200, 200, 200]);
	});

	it('never shows a parent the other parent, except through Famille', async () => {
		expect(await statusesFor('maman@exemple.fr', ADMIN_ID)).toEqual([403, 403, 403]);
		expect(await statusesFor('maman@exemple.fr', 'famille')).toEqual([200, 200, 200]);
		expect(await statusesFor('maman@exemple.fr', CHILD_ID)).toEqual([200, 200, 200]);
	});

	it('shows the admin everyone and Famille', async () => {
		for (const profileParam of [PARENT_ID, CHILD_ID, 'famille'])
			expect(await statusesFor('papa@exemple.fr', profileParam)).toEqual([200, 200, 200]);
	});

	it('answers 404 for a profile that is no active user', async () => {
		expect(await statusesFor('papa@exemple.fr', 'nobody')).toEqual([404, 404, 404]);
	});

	it('lets the tabs of a refused profile lead back out, not to the same 403', async () => {
		const refused = await fetchPage(
			`/?profil=${ADMIN_ID}`,
			await accessHeaders('maman@exemple.fr')
		);
		expect(refused.status).toBe(403);
		expect(await refused.text()).not.toContain(`profil=${ADMIN_ID}`);
	});

	it('keeps an allowed ?profil= on the tabs', async () => {
		const page = await fetchPage(`/?profil=${CHILD_ID}`, await accessHeaders('maman@exemple.fr'));
		expect(await page.text()).toContain(`historique?profil=${CHILD_ID}`);
	});

	it("wears the selected person's colour and offers the switcher to grown-ups only", async () => {
		const asMaman = await fetchPage(
			`/?profil=${CHILD_ID}`,
			await accessHeaders('maman@exemple.fr')
		);
		const html = await asMaman.text();
		expect(html).toContain('--color-primary: #1aa39a'); // Léa's turquoise
		expect(html).toContain('Profil affiché');

		const asLea = await fetchPage('/', await accessHeaders('lea@exemple.fr'));
		expect(await asLea.text()).not.toContain('Profil affiché');
	});
});
