// Réglages' people (spec Q10): Mon profil, Enfants and Membres, every write through
// saveWithVersion() and every decision from the access policy.
import type { UserRole, Viewer } from '../domain';
import { isUuidV7, uuidV7 } from '../uuid';
import { canEditPersonDetails, canManageMembers, keepsAnActiveAdmin } from './access-policy';
import { saveWithVersion } from './record-versions';
import { parseNewUser, parsePersonDetails, parseRole } from './settings-fields';

export type SettingsAnswer = { status: 200 } | { status: 400 | 403 | 404; message: string };

const refused = (status: 400 | 403 | 404, message: string) => ({ status, message }) as const;
const SAVED = { status: 200 } as const;
const NOT_FOUND = refused(404, 'Personne introuvable');
const ADMINS_ONLY = refused(403, 'Réservé à l’admin');
const LAST_ADMIN = refused(400, 'Il faut toujours au moins un admin actif');

type FormFields = Record<string, unknown>;
type UserStatusRow = { id: string; role: UserRole; deleted_at: string | null };

const findUser = (db: D1Database, userId: unknown) =>
	isUuidV7(userId)
		? db
				.prepare('SELECT id, role, deleted_at FROM users WHERE id = ?')
				.bind(userId)
				.first<UserStatusRow>()
		: null;

const countActiveAdmins = async (db: D1Database) =>
	(await db
		.prepare("SELECT count(*) AS n FROM users WHERE role = 'admin' AND deleted_at IS NULL")
		.first<number>('n')) ?? 0;

// ponytail: the count and the write are two requests, so two admins demoting each other at the same
// instant could both pass; a conditional UPDATE in saveWithVersion if the family ever has that many admins.
const keepsAnActiveAdminAfter = async (
	db: D1Database,
	user: UserStatusRow,
	change: 'deactivate' | { role: UserRole }
) =>
	keepsAnActiveAdmin({
		member: { ...user, isActive: !user.deleted_at },
		activeAdminCount: await countActiveAdmins(db),
		change
	});

/** Mon profil (`id` = the viewer) and Enfants: the name and colour of an active person. */
export const updatePersonDetails = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	const person = await findUser(db, fields.id);
	if (!person || person.deleted_at) return NOT_FOUND;
	if (!canEditPersonDetails(viewer, person))
		return refused(403, 'Tu ne peux pas modifier cette personne');
	const details = parsePersonDetails(fields);
	if (typeof details === 'string') return refused(400, details);
	await saveWithVersion(
		db,
		'users',
		person.id,
		{ name: details.name, colour_key: details.colourKey },
		viewer.id
	);
	return SAVED;
};

/** Membres' Ajouter. The admin then adds the same email to the Access policy (spec Q1). */
export const addUser = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const newUser = parseNewUser(fields);
	if (typeof newUser === 'string') return refused(400, newUser);
	const saved = await saveWithVersion(
		db,
		'users',
		uuidV7(),
		{ email: newUser.email, name: newUser.name, role: newUser.role, colour_key: newUser.colourKey },
		viewer.id
	);
	// The only UNIQUE a new id can lose to is the email, a deactivated user’s included.
	return saved ? SAVED : refused(400, 'Cette adresse e-mail a déjà un profil');
};

/** Membres' edit: name, colour and role, of anyone; the last active admin stays admin. */
export const updateUserAsAdmin = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const user = await findUser(db, fields.id);
	if (!user) return NOT_FOUND;
	const details = parsePersonDetails(fields);
	if (typeof details === 'string') return refused(400, details);
	const role = parseRole(fields.role);
	if (!role) return refused(400, 'Rôle inconnu');
	if (!(await keepsAnActiveAdminAfter(db, user, { role }))) return LAST_ADMIN;
	await saveWithVersion(
		db,
		'users',
		user.id,
		{ name: details.name, colour_key: details.colourKey, role },
		viewer.id
	);
	return SAVED;
};

/**
 * Désactiver (the soft delete: refused at login even if still in Access, their chores stay in the
 * reports) and Réactiver. The last active admin can't be deactivated.
 */
export const setUserActive = async (
	db: D1Database,
	viewer: Viewer,
	userId: unknown,
	isActive: boolean,
	now = new Date()
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const user = await findUser(db, userId);
	if (!user) return NOT_FOUND;
	if (isActive === !user.deleted_at) return SAVED;
	if (!isActive && !(await keepsAnActiveAdminAfter(db, user, 'deactivate'))) return LAST_ADMIN;
	await saveWithVersion(
		db,
		'users',
		user.id,
		isActive
			? { deleted_at: null, deleted_by_user_id: null }
			: { deleted_at: now.toISOString(), deleted_by_user_id: viewer.id },
		viewer.id
	);
	return SAVED;
};
