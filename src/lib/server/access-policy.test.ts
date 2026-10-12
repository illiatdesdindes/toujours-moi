import { describe, expect, it } from 'vitest';
import type { PersonRef } from '../domain';
import {
	canEditOrDeleteChore,
	canLogFor,
	canManageChoreTypes,
	canManageMembers,
	canViewFamille,
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

	// Spec Q3: children log for themselves; parents and admin for themselves + the children.
	it.each([
		[admin, ['admin', 'child', 'other-child']],
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

	it.each([
		[admin, true],
		[parent, false],
		[child, false]
	])('lets %o manage members and chore types: %s', (viewer, expected) => {
		expect(canManageMembers(viewer)).toBe(expected);
		expect(canManageChoreTypes(viewer)).toBe(expected);
	});

	it.each([
		[admin, true],
		[parent, true],
		[child, false]
	])('lets %o see Famille: %s', (viewer, expected) => {
		expect(canViewFamille(viewer)).toBe(expected);
	});

	// Spec Q10: at least one active admin at all times.
	it('refuses to demote or deactivate the last active admin', () => {
		expect(keepsAnActiveAdmin({ member: admin, activeAdminCount: 1, change: 'deactivate' })).toBe(
			false
		);
		expect(
			keepsAnActiveAdmin({ member: admin, activeAdminCount: 1, change: { role: 'parent' } })
		).toBe(false);
		expect(
			keepsAnActiveAdmin({ member: admin, activeAdminCount: 1, change: { role: 'admin' } })
		).toBe(true);
		expect(keepsAnActiveAdmin({ member: admin, activeAdminCount: 2, change: 'deactivate' })).toBe(
			true
		);
		expect(keepsAnActiveAdmin({ member: parent, activeAdminCount: 1, change: 'deactivate' })).toBe(
			true
		);
	});
});
