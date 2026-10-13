// The chore type catalog (spec Q2): the picker's list, and the admin's edits in Réglages, every
// write through saveWithVersion(). Types are archived, never deleted.
import type { ChoreTypeCatalogEntry, ChoreTypeOption, Viewer } from '../domain';
import { isUuidV7, uuidV7 } from '../uuid';
import { canManageChoreTypes } from './access-policy';
import type { SettingsAnswer } from './user-settings';
import { saveWithVersion } from './record-versions';
import { parseChoreTypeLabels } from './settings-fields';

type ChoreTypeRow = {
	id: string;
	short_label: string;
	full_label: string;
	icon: string;
	sort_order: number;
	archived_at: string | null;
};
const toChoreTypeOption = (row: ChoreTypeRow): ChoreTypeOption => ({
	id: row.id,
	shortLabel: row.short_label,
	fullLabel: row.full_label,
	icon: row.icon
});

/** Every type that isn't deleted, archived ones too, in picker order (ties: oldest first). */
const listCatalogRows = async (db: D1Database) =>
	(
		await db
			.prepare(
				`SELECT id, short_label, full_label, icon, sort_order, archived_at FROM chore_types
				WHERE deleted_at IS NULL ORDER BY sort_order, id`
			)
			.all<ChoreTypeRow>()
	).results;

/** The types the picker offers: archived ones drop out, past chores keep them. */
export const listPickableChoreTypes = async (db: D1Database): Promise<ChoreTypeOption[]> =>
	(await listCatalogRows(db)).filter((row) => !row.archived_at).map(toChoreTypeOption);

/** Types de tâches: the whole catalog, archived ones too. */
export const listChoreTypeCatalog = async (db: D1Database): Promise<ChoreTypeCatalogEntry[]> =>
	(await listCatalogRows(db)).map((row) => ({
		...toChoreTypeOption(row),
		isArchived: Boolean(row.archived_at)
	}));

const refused = (status: 400 | 403 | 404, message: string) => ({ status, message }) as const;
const SAVED = { status: 200 } as const;
const ADMINS_ONLY = refused(403, 'Réservé à l’admin');
const NOT_FOUND = refused(404, 'Type de tâche introuvable');

type FormFields = Record<string, unknown>;

const findCatalogRow = async (db: D1Database, choreTypeId: unknown) =>
	isUuidV7(choreTypeId)
		? (await listCatalogRows(db)).find((row) => row.id === choreTypeId)
		: undefined;

/** Ajouter un type: last in the picker. */
export const addChoreType = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageChoreTypes(viewer)) return ADMINS_ONLY;
	const labels = parseChoreTypeLabels(fields);
	if (typeof labels === 'string') return refused(400, labels);
	const rows = await listCatalogRows(db);
	const choreTypeId = uuidV7();
	await saveWithVersion(
		db,
		'chore_types',
		choreTypeId,
		{
			// The seed's keys are English slugs; the admin's types only need a unique one.
			type_key: `custom_${choreTypeId}`,
			short_label: labels.shortLabel,
			full_label: labels.fullLabel,
			icon: labels.icon,
			sort_order: Math.max(0, ...rows.map((row) => row.sort_order)) + 1
		},
		viewer.id
	);
	return SAVED;
};

/** Rename and change the icon; past chores show the new labels. */
export const updateChoreType = async (
	db: D1Database,
	viewer: Viewer,
	fields: FormFields
): Promise<SettingsAnswer> => {
	if (!canManageChoreTypes(viewer)) return ADMINS_ONLY;
	const row = await findCatalogRow(db, fields.id);
	if (!row) return NOT_FOUND;
	const labels = parseChoreTypeLabels(fields);
	if (typeof labels === 'string') return refused(400, labels);
	await saveWithVersion(
		db,
		'chore_types',
		row.id,
		{ short_label: labels.shortLabel, full_label: labels.fullLabel, icon: labels.icon },
		viewer.id
	);
	return SAVED;
};

/** ↑ / ↓: swaps places with the neighbour in the catalog (archived ones count, as listed). */
export const moveChoreType = async (
	db: D1Database,
	viewer: Viewer,
	choreTypeId: unknown,
	direction: 'up' | 'down'
): Promise<SettingsAnswer> => {
	if (!canManageChoreTypes(viewer)) return ADMINS_ONLY;
	const rows = await listCatalogRows(db);
	const index = rows.findIndex((row) => row.id === choreTypeId);
	if (index === -1) return NOT_FOUND;
	const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
	if (!rows[neighbourIndex]) return SAVED;
	[rows[index], rows[neighbourIndex]] = [rows[neighbourIndex]!, rows[index]!];
	// Renumbered by position, not by swapping the stored numbers: those may tie after a failed move.
	// ponytail: one saveWithVersion batch per changed type, not one for all; a failure halfway leaves a
	// tie, which the next move renumbers.
	for (const [position, row] of rows.entries())
		if (row.sort_order !== position + 1)
			await saveWithVersion(db, 'chore_types', row.id, { sort_order: position + 1 }, viewer.id);
	return SAVED;
};

/** Archiver (out of the picker; past chores and reports keep it) and Restaurer. */
export const setChoreTypeArchived = async (
	db: D1Database,
	viewer: Viewer,
	choreTypeId: unknown,
	isArchived: boolean,
	now = new Date()
): Promise<SettingsAnswer> => {
	if (!canManageChoreTypes(viewer)) return ADMINS_ONLY;
	const row = await findCatalogRow(db, choreTypeId);
	if (!row) return NOT_FOUND;
	if (isArchived === Boolean(row.archived_at)) return SAVED;
	await saveWithVersion(
		db,
		'chore_types',
		row.id,
		{ archived_at: isArchived ? now.toISOString() : null },
		viewer.id
	);
	return SAVED;
};
