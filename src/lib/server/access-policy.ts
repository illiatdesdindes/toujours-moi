// The one place that decides who may do what (spec Q20 point 5). Every load and form action asks
// it; the UI only hides what it already forbids.
import type { PersonRef, UserRole } from '../domain';

const isSelf = (viewer: PersonRef, person: PersonRef) => viewer.id === person.id;
const isGrownUp = (viewer: PersonRef) => viewer.role !== 'child';

/** Spec Q8: parent → themselves + every child; admin → everyone; child → only themselves. */
export const canViewProfile = (viewer: PersonRef, profile: PersonRef) =>
	viewer.role === 'admin' ||
	isSelf(viewer, profile) ||
	(isGrownUp(viewer) && profile.role === 'child');

/** Spec Q3: children log for themselves; parents for themselves + the children; admin for everyone. */
export const canLogFor = (viewer: PersonRef, performer: PersonRef) =>
	viewer.role === 'admin' ||
	isSelf(viewer, performer) ||
	(isGrownUp(viewer) && performer.role === 'child');

/** Spec Q6: child → performed and logged by themselves; parent → their own + any child's; admin → all. */
export const canEditOrDeleteChore = (
	viewer: PersonRef,
	chore: { performer: PersonRef; authorUserId: string }
) => {
	if (viewer.role === 'admin') return true;
	if (viewer.role === 'child')
		return isSelf(viewer, chore.performer) && chore.authorUserId === viewer.id;
	return isSelf(viewer, chore.performer) || chore.performer.role === 'child';
};

/** Spec Q6: the "✎ 3" update counter on Historique rows. */
export const canSeeChoreUpdateCount = (viewer: PersonRef) => viewer.role === 'admin';

/** Spec Q10: everyone their own name and colour (Mon profil), a parent the children's (Enfants), the admin everyone's (Membres). */
// ponytail: the same people as canViewProfile today; give it its own body when the two rules part.
export const canEditPersonDetails = canViewProfile;

export const canManageUsers = (viewer: PersonRef) => viewer.role === 'admin';
export const canManageChoreTypes = (viewer: PersonRef) => viewer.role === 'admin';

/** Réglages' Enfants card, as prototype 02: parents only; the admin edits children in Membres. */
export const canSeeChildrenSettings = (viewer: PersonRef) => viewer.role === 'parent';

/** Spec Q8: the Famille profile, for parents and admin. */
export const canViewFamilyProfile = (viewer: PersonRef) => isGrownUp(viewer);

/** Spec Q10: a role change or deactivation must leave at least one active admin. */
export const keepsAnActiveAdmin = ({
	user,
	activeAdminCount,
	change
}: {
	user: PersonRef & { isActive: boolean };
	activeAdminCount: number;
	change: 'deactivate' | { role: UserRole };
}) => {
	// A deactivated admin isn't counted, so changing them can't lose an active admin.
	const losesAdmin =
		user.isActive && user.role === 'admin' && (change === 'deactivate' || change.role !== 'admin');
	return !losesAdmin || activeAdminCount > 1;
};
