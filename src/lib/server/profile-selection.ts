// The profile switcher (spec Q8): which profiles a viewer may pick, the one `?profil=` selects, and
// the `?profil=` value of a profile. Every rule comes from the access policy.
import { error } from '@sveltejs/kit';
import {
	FAMILY_PROFILE_PARAM,
	type ProfileOption,
	type SelectedProfile,
	type User,
	type Viewer
} from '../domain';
import { canViewFamilyProfile, canViewProfile } from './access-policy';
import { listActiveUsers } from './users';

/** The `?profil=` value that selects this profile (the inverse of `selectProfile`); null = the viewer. */
export const profileParamFor = (viewer: Viewer, profile: SelectedProfile) =>
	profile.kind === 'family'
		? FAMILY_PROFILE_PARAM
		: profile.person.id === viewer.id
			? null
			: profile.person.id;

/** The viewer first, then the others they may view, then Famille when they may see it. */
export const listProfileOptions = (viewer: Viewer, activeUsers: User[]): ProfileOption[] => [
	{ profileParam: null, label: `${viewer.name} (moi)`, colourKey: viewer.colourKey },
	...activeUsers
		.filter((user) => user.id !== viewer.id && canViewProfile(viewer, user))
		.map((user) => ({
			profileParam: profileParamFor(viewer, { kind: 'person', person: user }),
			label: user.name,
			colourKey: user.colourKey
		})),
	...(canViewFamilyProfile(viewer)
		? [
				{
					profileParam: profileParamFor(viewer, { kind: 'family' }),
					label: '👪 Famille',
					colourKey: null
				}
			]
		: [])
];

/** The profile `?profil=` selects; leaving it out means the viewer. */
export const selectProfile = (
	viewer: Viewer,
	activeUsers: User[],
	profileParam: string | null
): SelectedProfile | 'forbidden' | 'unknown' => {
	if (profileParam === FAMILY_PROFILE_PARAM)
		return canViewFamilyProfile(viewer) ? { kind: 'family' } : 'forbidden';
	const person = profileParam ? activeUsers.find((user) => user.id === profileParam) : viewer;
	if (!person) return 'unknown';
	return canViewProfile(viewer, person) ? { kind: 'person', person } : 'forbidden';
};

/**
 * The selected profile and the header's switcher data for Accueil / Historique / Rapports. A profile
 * the viewer may not see is a 403 (spec Q8: a child sees only themselves, a parent not the other parent).
 */
export const loadSelectedProfile = async (db: D1Database, viewer: Viewer, url: URL) => {
	const activeUsers = await listActiveUsers(db);
	const selectedProfile = selectProfile(viewer, activeUsers, url.searchParams.get('profil'));
	if (selectedProfile === 'unknown') error(404, 'Profil introuvable');
	if (selectedProfile === 'forbidden') error(403, 'Tu ne peux pas voir ce profil');
	return {
		activeUsers,
		/** What the layout's header and tab links read from `page.data` (`App.PageData`). */
		profileHeader: {
			selectedProfile,
			selectedProfileParam: profileParamFor(viewer, selectedProfile),
			profileOptions: listProfileOptions(viewer, activeUsers)
		}
	};
};
