// The profile switcher (spec Q8): which profiles a viewer may pick, the one `?profil=` selects, and
// the home's default performer. Every rule comes from the access policy.
import { error } from '@sveltejs/kit';
import {
	FAMILY_PROFILE_PARAM,
	type ColourKey,
	type FamilyMember,
	type ProfileOption,
	type SelectedProfile,
	type UserRole,
	type Viewer
} from '../domain';
import { canLogFor, canViewFamilyProfile, canViewProfile } from './access-policy';

/** The viewer first, then the others they may view, then Famille when they may see it. */
export const listProfileOptions = (
	viewer: FamilyMember,
	activeMembers: FamilyMember[]
): ProfileOption[] => [
	{ profileParam: null, label: `${viewer.name} (moi)`, colourKey: viewer.colourKey },
	...activeMembers
		.filter((member) => member.id !== viewer.id && canViewProfile(viewer, member))
		.map((member) => ({
			profileParam: member.id,
			label: member.name,
			colourKey: member.colourKey
		})),
	...(canViewFamilyProfile(viewer)
		? [{ profileParam: FAMILY_PROFILE_PARAM, label: '👪 Famille', colourKey: null }]
		: [])
];

/** The profile `?profil=` selects; leaving it out means the viewer. */
export const selectProfile = (
	viewer: FamilyMember,
	activeMembers: FamilyMember[],
	profileParam: string | null
): SelectedProfile | 'forbidden' | 'unknown' => {
	if (profileParam === FAMILY_PROFILE_PARAM)
		return canViewFamilyProfile(viewer) ? { kind: 'family' } : 'forbidden';
	const person = profileParam ? activeMembers.find((member) => member.id === profileParam) : viewer;
	if (!person) return 'unknown';
	return canViewProfile(viewer, person) ? { kind: 'person', person } : 'forbidden';
};

/** Who the home logs for unless "Fait par" says otherwise: the profile on screen, if allowed. */
export const defaultPerformerFor = (viewer: Viewer, selectedProfile: SelectedProfile) =>
	selectedProfile.kind === 'person' && canLogFor(viewer, selectedProfile.person)
		? selectedProfile.person.id
		: viewer.id;

/** The "Fait par" choices: the members the viewer may log for (spec Q3). */
export const listPerformerOptions = (viewer: Viewer, activeMembers: FamilyMember[]) =>
	activeMembers.filter((member) => canLogFor(viewer, member));

/** Every active user, oldest first (UUID v7 ids sort by creation). */
export const listActiveMembers = async (db: D1Database): Promise<FamilyMember[]> => {
	const { results } = await db
		.prepare('SELECT id, role, name, colour_key FROM users WHERE deleted_at IS NULL ORDER BY id')
		.all<{ id: string; role: UserRole; name: string; colour_key: ColourKey }>();
	return results.map((row) => ({
		id: row.id,
		role: row.role,
		name: row.name,
		colourKey: row.colour_key
	}));
};

/**
 * The selected profile and the switcher's options for Accueil / Historique / Rapports. A profile the
 * viewer may not see is a 403 (spec Q8: a child sees only themselves, a parent not the other parent).
 */
export const loadSelectedProfile = async (db: D1Database, viewer: Viewer, url: URL) => {
	const activeMembers = await listActiveMembers(db);
	const selectedProfile = selectProfile(viewer, activeMembers, url.searchParams.get('profil'));
	if (selectedProfile === 'unknown') error(404, 'Profil introuvable');
	if (selectedProfile === 'forbidden') error(403, 'Tu ne peux pas voir ce profil');
	return {
		activeMembers,
		selectedProfile,
		profileOptions: listProfileOptions(viewer, activeMembers)
	};
};
