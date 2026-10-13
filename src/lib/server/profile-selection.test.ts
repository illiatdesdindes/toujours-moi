import { describe, expect, it } from 'vitest';
import type { FamilyMember } from '../domain';
import {
	defaultPerformerFor,
	listPerformerOptions,
	listProfileOptions,
	selectProfile
} from './profile-selection';

const papa: FamilyMember = { id: 'papa', role: 'admin', name: 'Papa', colourKey: 'cornflower' };
const maman: FamilyMember = { id: 'maman', role: 'parent', name: 'Maman', colourKey: 'raspberry' };
const lea: FamilyMember = { id: 'lea', role: 'child', name: 'Léa', colourKey: 'turquoise' };
const noe: FamilyMember = { id: 'noe', role: 'child', name: 'Noé', colourKey: 'mustard' };
const family = [papa, maman, lea, noe];

describe('profile switcher options (spec Q8)', () => {
	it('gives the admin themselves, everyone, then Famille', () => {
		expect(listProfileOptions(papa, family)).toEqual([
			{ profileParam: null, label: 'Papa (moi)', colourKey: 'cornflower' },
			{ profileParam: 'maman', label: 'Maman', colourKey: 'raspberry' },
			{ profileParam: 'lea', label: 'Léa', colourKey: 'turquoise' },
			{ profileParam: 'noe', label: 'Noé', colourKey: 'mustard' },
			{ profileParam: 'famille', label: '👪 Famille', colourKey: null }
		]);
	});

	it('gives a parent themselves, the children and Famille, not the other parent', () => {
		expect(listProfileOptions(maman, family).map((option) => option.profileParam)).toEqual([
			null,
			'lea',
			'noe',
			'famille'
		]);
	});

	it('gives a child only themselves: no switcher', () => {
		expect(listProfileOptions(lea, family)).toHaveLength(1);
	});
});

describe('selectProfile', () => {
	it('is the viewer without ?profil=, or with their own id', () => {
		expect(selectProfile(maman, family, null)).toEqual({ kind: 'person', person: maman });
		expect(selectProfile(maman, family, 'maman')).toEqual({ kind: 'person', person: maman });
	});

	it('is a profile the viewer may see, or Famille for parents and admin', () => {
		expect(selectProfile(maman, family, 'lea')).toEqual({ kind: 'person', person: lea });
		expect(selectProfile(papa, family, 'maman')).toEqual({ kind: 'person', person: maman });
		expect(selectProfile(maman, family, 'famille')).toEqual({ kind: 'family' });
	});

	it('refuses another profile to a child, and the other parent to a parent', () => {
		expect(selectProfile(lea, family, 'noe')).toBe('forbidden');
		expect(selectProfile(lea, family, 'famille')).toBe('forbidden');
		expect(selectProfile(maman, family, 'papa')).toBe('forbidden');
	});

	it('knows no inactive or unknown user', () => {
		expect(selectProfile(papa, family, 'ghost')).toBe('unknown');
	});
});

describe('the home performer (spec Q3, Q8)', () => {
	it('is the selected person when the viewer may log for them, else the viewer', () => {
		expect(defaultPerformerFor(maman, { kind: 'person', person: lea })).toBe('lea');
		expect(defaultPerformerFor(maman, { kind: 'family' })).toBe('maman');
		// The admin may view Maman but not log for her.
		expect(defaultPerformerFor(papa, { kind: 'person', person: maman })).toBe('papa');
	});

	it('is picked among those the viewer may log for', () => {
		expect(listPerformerOptions(papa, family).map((member) => member.id)).toEqual([
			'papa',
			'lea',
			'noe'
		]);
		expect(listPerformerOptions(lea, family).map((member) => member.id)).toEqual(['lea']);
	});
});
