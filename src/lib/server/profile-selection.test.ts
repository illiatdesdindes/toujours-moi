import { describe, expect, it } from 'vitest';
import { listProfileOptions, profileParamFor, selectProfile } from './profile-selection';
import { allUsers, lea, maman, papa } from './test-users.fixtures';

describe('profile switcher options (spec Q8)', () => {
	it('gives the admin themselves, everyone, then Famille', () => {
		expect(listProfileOptions(papa, allUsers)).toEqual([
			{ profileParam: null, label: 'Papa (moi)', colourKey: 'cornflower' },
			{ profileParam: 'maman', label: 'Maman', colourKey: 'raspberry' },
			{ profileParam: 'lea', label: 'Léa', colourKey: 'turquoise' },
			{ profileParam: 'noe', label: 'Noé', colourKey: 'mustard' },
			{ profileParam: 'famille', label: '👪 Famille', colourKey: null }
		]);
	});

	it('gives a parent themselves, the children and Famille, not the other parent', () => {
		expect(listProfileOptions(maman, allUsers).map((option) => option.profileParam)).toEqual([
			null,
			'lea',
			'noe',
			'famille'
		]);
	});

	it('gives a child only themselves: no switcher', () => {
		expect(listProfileOptions(lea, allUsers)).toHaveLength(1);
	});
});

describe('selectProfile', () => {
	it('is the viewer without ?profil=, or with their own id', () => {
		expect(selectProfile(maman, allUsers, null)).toEqual({ kind: 'person', person: maman });
		expect(selectProfile(maman, allUsers, 'maman')).toEqual({ kind: 'person', person: maman });
	});

	it('is a profile the viewer may see, or Famille for parents and admin', () => {
		expect(selectProfile(maman, allUsers, 'lea')).toEqual({ kind: 'person', person: lea });
		expect(selectProfile(papa, allUsers, 'maman')).toEqual({ kind: 'person', person: maman });
		expect(selectProfile(maman, allUsers, 'famille')).toEqual({ kind: 'family' });
	});

	it('refuses another profile to a child, and the other parent to a parent', () => {
		expect(selectProfile(lea, allUsers, 'noe')).toBe('forbidden');
		expect(selectProfile(lea, allUsers, 'famille')).toBe('forbidden');
		expect(selectProfile(maman, allUsers, 'papa')).toBe('forbidden');
	});

	it('knows no inactive or unknown user', () => {
		expect(selectProfile(papa, allUsers, 'ghost')).toBe('unknown');
	});
});

describe('profileParamFor', () => {
	it('is the inverse of selectProfile', () => {
		expect(profileParamFor(maman, { kind: 'person', person: maman })).toBeNull();
		expect(profileParamFor(maman, { kind: 'person', person: lea })).toBe('lea');
		expect(profileParamFor(maman, { kind: 'family' })).toBe('famille');
	});
});
