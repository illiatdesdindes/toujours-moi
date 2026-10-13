// "Fait par" (spec Q3, Q8): whom the home logs for by default, and whom the viewer may pick.
import type { SelectedProfile, User, Viewer } from '../domain';
import { canLogFor } from './access-policy';

/**
 * Who the home logs for unless "Fait par" says otherwise: the profile on screen, if the viewer may
 * log for them (Q3 wins over Q8: the admin viewing Maman logs as the admin), else the viewer.
 */
export const defaultPerformerFor = (viewer: Viewer, selectedProfile: SelectedProfile) =>
	selectedProfile.kind === 'person' && canLogFor(viewer, selectedProfile.person)
		? selectedProfile.person.id
		: viewer.id;

/** The "Fait par" choices: the users the viewer may log for (spec Q3). */
export const listPerformerOptions = (viewer: Viewer, activeUsers: User[]) =>
	activeUsers.filter((user) => canLogFor(viewer, user));
