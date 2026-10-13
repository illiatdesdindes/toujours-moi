import { describe, expect, it } from 'vitest';
import type { PersonRef } from '../domain';
import {
	canEditOrDeleteChore,
	canEditPersonDetails,
	canLogFor,
	canManageChoreTypes,
	canManageUsers,
	canSeeChildrenSettings,
	canViewFamilyProfile,
	canViewProfile,
	keepsAnActiveAdmin
} from './access-policy';

const admin: PersonRef = { id: 'admin', role: 'admin' };
const parent: PersonRef = { id: 'parent', role: 'parent' };
const otherParent: PersonRef = { id: 'other-parent', role: 'parent' };
const child: PersonRef = { id: 'child', role: 'child' };
const otherChild: PersonRef = { id: 'other-child', role: 'child' };
const everyone = [admin, parent, otherParent, child, otherChild];
const label = (person: PersonRef) => person.id;

/** The persons in `everyone` a predicate allows, by id. */
const allowed = (predicate: (person: PersonRef) => boolean) =>
	everyone.filter(predicate).map(label);

describe('access policy', () => {
	// Spec Q8: parent → themselves + every child; admin → everyone; child → only themselves.
	it.each([
		[admin, ['admin', 'parent', 'other-parent', 'child', 'other-child']],
		[parent, ['parent', 'child', 'other-child']],
		[child, ['child']]
	])('lets %o view the profiles %o', (viewer, expected) => {
		expect(allowed((profile) => canViewProfile(viewer, profile))).toEqual(expected);
	});

	// Spec Q3: children log for themselves; parents for themselves + the children; admin for everyone.
	it.each([
		[admin, ['admin', 'parent', 'other-parent', 'child', 'other-child']],
		[parent, ['parent', 'child', 'other-child']],
		[child, ['child']]
	])('lets %o log for %o', (viewer, expected) => {
		expect(allowed((performer) => canLogFor(viewer, performer))).toEqual(expected);
	});

	// Spec Q6. A chore is (performer, author); every pair of the family is checked.
	it.each([
		[admin, everyone.length ** 2],
		// Their own chores (any author) + every child's chore (any author).
		[parent, 3 * everyone.length],
		// Only performed and logged by themselves.
		[child, 1]
	])('lets %o edit or delete %i of the 25 chores', (viewer, expected) => {
		const chores = everyone.flatMap((performer) =>
			everyone.map((author) => ({ performer, authorUserId: author.id }))
		);
		expect(chores.filter((chore) => canEditOrDeleteChore(viewer, chore))).toHaveLength(expected);
	});

	it('keeps a chore a parent logged for a child read-only to the child', () => {
		expect(canEditOrDeleteChore(child, { performer: child, authorUserId: 'parent' })).toBe(false);
		expect(canEditOrDeleteChore(child, { performer: child, authorUserId: 'child' })).toBe(true);
	});

	it("keeps the other parent's chores, even ones logged by this parent, out of reach", () => {
		expect(canEditOrDeleteChore(parent, { performer: otherParent, authorUserId: 'parent' })).toBe(
			false
		);
		expect(canEditOrDeleteChore(parent, { performer: admin, authorUserId: 'admin' })).toBe(false);
		expect(canEditOrDeleteChore(parent, { performer: parent, authorUserId: 'admin' })).toBe(true);
	});

	// Spec Q10: Mon profil, Enfants (parents), Membres (admin).
	it.each([
		[admin, ['admin', 'parent', 'other-parent', 'child', 'other-child']],
		[parent, ['parent', 'child', 'other-child']],
		[child, ['child']]
	])('lets %o edit the name and colour of %o', (viewer, expected) => {
		expect(allowed((person) => canEditPersonDetails(viewer, person))).toEqual(expected);
	});

	it.each([
		[admin, true],
		[parent, false],
		[child, false]
	])('lets %o manage users and chore types: %s', (viewer, expected) => {
		expect(canManageUsers(viewer)).toBe(expected);
		expect(canManageChoreTypes(viewer)).toBe(expected);
	});

	it.each([
		[admin, false],
		[parent, true],
		[child, false]
	])('shows %o the Enfants card of Réglages: %s', (viewer, expected) => {
		expect(canSeeChildrenSettings(viewer)).toBe(expected);
	});

	it.each([
		[admin, true],
		[parent, true],
		[child, false]
	])('lets %o see the family profile (Famille): %s', (viewer, expected) => {
		expect(canViewFamilyProfile(viewer)).toBe(expected);
	});

	// Spec Q10: at least one active admin at all times.
	it('refuses to demote or deactivate the last active admin', () => {
		const activeAdmin = { ...admin, isActive: true };
		const keeps = (
			user: PersonRef & { isActive: boolean },
			activeAdminCount: number,
			change: 'deactivate' | { role: 'admin' | 'parent' }
		) => keepsAnActiveAdmin({ user, activeAdminCount, change });
		expect(keeps(activeAdmin, 1, 'deactivate')).toBe(false);
		expect(keeps(activeAdmin, 1, { role: 'parent' })).toBe(false);
		expect(keeps(activeAdmin, 1, { role: 'admin' })).toBe(true);
		expect(keeps(activeAdmin, 2, 'deactivate')).toBe(true);
		expect(keeps({ ...parent, isActive: true }, 1, 'deactivate')).toBe(true);
		// A deactivated admin isn't one of the active admins: demoting them changes nothing.
		expect(keeps({ ...admin, isActive: false }, 1, { role: 'parent' })).toBe(true);
	});
});
