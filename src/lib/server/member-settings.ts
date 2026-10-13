// Réglages' people (spec Q10): Mon profil, Enfants and Membres, every write through
// saveWithVersion() and every decision from the access policy.
import type { UserRole, Viewer } from '../domain';
import { isUuidV7, uuidV7 } from '../uuid';
import { canEditPersonDetails, canManageMembers, keepsAnActiveAdmin } from './access-policy';
import { saveWithVersion } from './record-versions';
import { parseNewMember, parsePersonDetails, parseRole } from './settings-fields';

export type SettingsAnswer = { status: 200 } | { status: 400 | 403 | 404; message: string };

const refused = (status: 400 | 403 | 404, message: string) => ({ status, message }) as const;
const SAVED = { status: 200 } as const;
const NOT_FOUND = refused(404, 'Personne introuvable');
const ADMINS_ONLY = refused(403, 'Réservé à l’admin');
const LAST_ADMIN = refused(400, 'Il faut toujours au moins un admin actif');

type FormFields = Record<string, unknown>;
type MemberRow = { id: string; role: UserRole; deleted_at: string | null };

const findMember = (db: D1Database, memberId: unknown) =>
	isUuidV7(memberId)
		? db
				.prepare('SELECT id, role, deleted_at FROM users WHERE id = ?')
				.bind(memberId)
				.first<MemberRow>()
		: null;

const countActiveAdmins = async (db: D1Database) =>
	(await db
		.prepare("SELECT count(*) AS n FROM users WHERE role = 'admin' AND deleted_at IS NULL")
		.first<number>('n')) ?? 0;

// ponytail: the count and the write are two requests, so two admins demoting each other at the same
// instant could both pass; a conditional UPDATE in saveWithVersion if the family ever has that many admins.
const keepsAnActiveAdminAfter = async (
	db: D1Database,
	member: MemberRow,
	change: 'deactivate' | { role: UserRole }
) =>
	keepsAnActiveAdmin({
		member: { ...member, isActive: !member.deleted_at },
		activeAdminCount: await countActiveAdmins(db),
		change
	});

/** Mon profil (`id` = the viewer) and Enfants: the name and colour of an active person. */
export const updatePersonDetails = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	const person = await findMember(db, fields.id);
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
export const addMember = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const member = parseNewMember(fields);
	if (typeof member === 'string') return refused(400, member);
	const saved = await saveWithVersion(
		db,
		'users',
		uuidV7(),
		{ email: member.email, name: member.name, role: member.role, colour_key: member.colourKey },
		viewer.id
	);
	// The only UNIQUE a new id can lose to is the email, a deactivated member's included.
	return saved ? SAVED : refused(400, 'Cette adresse e-mail a déjà un profil');
};

/** Membres' edit: name, colour and role, of anyone; the last active admin stays admin. */
export const updateMember = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const member = await findMember(db, fields.id);
	if (!member) return NOT_FOUND;
	const details = parsePersonDetails(fields);
	if (typeof details === 'string') return refused(400, details);
	const role = parseRole(fields.role);
	if (!role) return refused(400, 'Rôle inconnu');
	if (!(await keepsAnActiveAdminAfter(db, member, { role }))) return LAST_ADMIN;
	await saveWithVersion(
		db,
		'users',
		member.id,
		{ name: details.name, colour_key: details.colourKey, role },
		viewer.id
	);
	return SAVED;
};

/**
 * Désactiver (the soft delete: refused at login even if still in Access, their chores stay in the
 * reports) and Réactiver. The last active admin can't be deactivated.
 */
export const setMemberActive = async (
	db: D1Database,
	viewer: Viewer,
	memberId: unknown,
	isActive: boolean,
	now = new Date()
): Promise<SettingsAnswer> => {
	if (!canManageMembers(viewer)) return ADMINS_ONLY;
	const member = await findMember(db, memberId);
	if (!member) return NOT_FOUND;
	if (isActive === !member.deleted_at) return SAVED;
	if (!isActive && !(await keepsAnActiveAdminAfter(db, member, 'deactivate'))) return LAST_ADMIN;
	await saveWithVersion(
		db,
		'users',
		member.id,
		isActive
			? { deleted_at: null, deleted_by_user_id: null }
			: { deleted_at: now.toISOString(), deleted_by_user_id: viewer.id },
		viewer.id
	);
	return SAVED;
};
