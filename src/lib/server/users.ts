// Reading active `users` rows (deactivated = `deleted_at` set), one row shape for every caller.
import type { ColourKey, User, UserRole } from '../domain';

const ACTIVE_USER_COLUMNS = 'SELECT id, role, name, colour_key FROM users WHERE deleted_at IS NULL';
type UserRow = { id: string; role: UserRole; name: string; colour_key: ColourKey };
const toUser = (row: UserRow): User => ({
	id: row.id,
	role: row.role,
	name: row.name,
	colourKey: row.colour_key
});

/** Every active user, oldest first (UUID v7 ids sort by creation). */
export const listActiveUsers = async (db: D1Database): Promise<User[]> => {
	const { results } = await db.prepare(`${ACTIVE_USER_COLUMNS} ORDER BY id`).all<UserRow>();
	return results.map(toUser);
};

/** The active user with this (lowercased) email; null for an unknown or deactivated one. */
export const findActiveUserByEmail = async (db: D1Database, email: string) => {
	const row = await db.prepare(`${ACTIVE_USER_COLUMNS} AND email = ?`).bind(email).first<UserRow>();
	return row && toUser(row);
};
