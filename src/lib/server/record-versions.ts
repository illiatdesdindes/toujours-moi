// The version log (spec Q7): every change to a versioned table goes through saveWithVersion().
import { uuidV7 } from '../uuid';

/**
 * Each versioned table's columns, in snapshot order. Also the whitelist for the table and column
 * names saveWithVersion() puts into SQL.
 */
const VERSIONED_COLUMNS = {
	users: [
		'id',
		'email',
		'name',
		'role',
		'colour_key',
		'last_duration_minutes',
		'update_count',
		'created_at',
		'updated_at',
		'deleted_at',
		'deleted_by_user_id'
	],
	chore_types: [
		'id',
		'type_key',
		'short_label',
		'full_label',
		'icon',
		'sort_order',
		'archived_at',
		'update_count',
		'created_at',
		'updated_at',
		'deleted_at',
		'deleted_by_user_id'
	],
	chores: [
		'id',
		'chore_type_id',
		'duration_minutes',
		'started_at',
		'performer_user_id',
		'author_user_id',
		'note',
		'update_count',
		'created_at',
		'updated_at',
		'deleted_at',
		'deleted_by_user_id'
	]
} as const;

export type VersionedTable = keyof typeof VERSIONED_COLUMNS;
type ColumnValue = string | number | null;
/** Set by saveWithVersion() itself, never by a caller. */
const BOOKKEEPING_COLUMNS = ['id', 'update_count', 'created_at', 'updated_at'] as const;
/** The columns a caller may set on `tableName`: a typo fails the type check. */
type WritableColumn<TableName extends VersionedTable> = Exclude<
	(typeof VERSIONED_COLUMNS)[TableName][number],
	(typeof BOOKKEEPING_COLUMNS)[number]
>;

/**
 * Writes `changes` to the row `recordId` of `tableName` and its version, in one D1 batch: a new
 * row if `recordId` doesn't exist yet (version 0, `created`), else an update that bumps
 * `update_count` (`deleted` when it sets `deleted_at`, the soft delete). The version holds the full
 * row after the change, read back in SQL. Returns null when nothing was written: a create that lost
 * to a UNIQUE constraint (same id or same email).
 */
export const saveWithVersion = async <TableName extends VersionedTable>(
	db: D1Database,
	tableName: TableName,
	recordId: string,
	changes: Partial<Record<WritableColumn<TableName>, ColumnValue>>,
	changedByUserId: string
): Promise<{ changeKind: ChangeKind; versionNumber: number } | null> => {
	const columns: readonly string[] = VERSIONED_COLUMNS[tableName];
	const bookkeepingColumns: readonly string[] = BOOKKEEPING_COLUMNS;
	const changedColumns = Object.keys(changes);
	// Also checked at runtime: the column names go into SQL, and a cast can get past the type.
	const refused = changedColumns.filter(
		(column) => !columns.includes(column) || bookkeepingColumns.includes(column)
	);
	if (refused.length) throw new Error(`saveWithVersion(${tableName}): can't set ${refused}`);

	const changedAt = new Date().toISOString();
	const exists = await db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ?`).bind(recordId).first();
	const changeKind: ChangeKind = !exists
		? 'created'
		: 'deleted_at' in changes && changes.deleted_at
			? 'deleted'
			: 'updated';
	const values = Object.values(changes);
	const write = exists
		? db
				.prepare(
					`UPDATE ${tableName} SET ${changedColumns.map((column) => `${column} = ?`).join(', ')},
					update_count = update_count + 1, updated_at = ? WHERE id = ?`
				)
				.bind(...values, changedAt, recordId)
		: db
				.prepare(
					`INSERT INTO ${tableName} (${['id', ...changedColumns, 'created_at', 'updated_at']})
					VALUES (${Array(changedColumns.length + 3).fill('?')}) ON CONFLICT DO NOTHING`
				)
				.bind(recordId, ...values, changedAt, changedAt);
	const snapshot = `json_object(${columns.map((column) => `'${column}', ${column}`)})`;
	const version = db
		.prepare(
			`INSERT INTO record_versions (id, table_name, record_id, version_number, change_kind,
				changed_by_user_id, changed_at, record_snapshot_json)
			SELECT ?, ?, id, update_count, ?, ?, ?, ${snapshot} FROM ${tableName} WHERE id = ?
			${exists ? '' : 'ON CONFLICT (table_name, record_id, version_number) DO NOTHING'}
			RETURNING version_number`
		)
		.bind(uuidV7(), tableName, changeKind, changedByUserId, changedAt, recordId);
	const [, versionResult] = await db.batch<{ version_number: number }>([write, version]);
	const versionNumber = versionResult?.results[0]?.version_number;
	return versionNumber === undefined ? null : { changeKind, versionNumber };
};

type ChangeKind = 'created' | 'updated' | 'deleted';
