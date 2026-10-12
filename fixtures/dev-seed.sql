-- The family of prototypes/02-screens.html for `npm run dev` (`npm run db:seed:local`). Local
-- database only; re-runnable (fixed ids, ON CONFLICT DO NOTHING). Switch between them with
-- DEV_VIEWER_EMAIL in .dev.vars. Then ~2 months of their chores.
INSERT INTO users (id, email, name, role, colour_key, created_at, updated_at) VALUES
	('01900000-0000-7000-8000-000000000001', 'papa@exemple.fr', 'Papa', 'admin', 'cornflower',
		strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('01900000-0000-7000-8000-000000000002', 'maman@exemple.fr', 'Maman', 'parent', 'raspberry',
		strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('01900000-0000-7000-8000-000000000003', 'lea@exemple.fr', 'Léa', 'child', 'turquoise',
		strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('01900000-0000-7000-8000-000000000004', 'noe@exemple.fr', 'Noé', 'child', 'mustard',
		strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT DO NOTHING;

-- Their version 0, as saveWithVersion() would have written it (created by the admin).
INSERT INTO record_versions (id, table_name, record_id, version_number, change_kind,
	changed_by_user_id, changed_at, record_snapshot_json)
SELECT '01900000-0000-7000-9000-00000000000' || substr(id, -1), 'users', id, 0, 'created',
	'01900000-0000-7000-8000-000000000001', created_at,
	json_object('id', id, 'email', email, 'name', name, 'role', role, 'colour_key', colour_key,
		'last_duration_minutes', last_duration_minutes, 'update_count', update_count,
		'created_at', created_at, 'updated_at', updated_at, 'deleted_at', deleted_at,
		'deleted_by_user_id', deleted_by_user_id)
FROM users WHERE id LIKE '01900000-0000-7000-8000-00000000000_'
ON CONFLICT DO NOTHING;

-- ~2 months of chores (spec Q20 point 7), deterministic: up to 3 a day for a grown-up, 2 for a
-- child, a third of the children's logged by Maman. Ids encode day, person and rank, so a re-run
-- adds nothing (the dates stay those of the first run).
WITH RECURSIVE
	days(day) AS (SELECT 0 UNION ALL SELECT day + 1 FROM days WHERE day < 60),
	ranks(rank) AS (VALUES (0), (1), (2)),
	family(person, user_id, is_child) AS (
		SELECT CAST(substr(id, -1) AS INTEGER), id, role = 'child' FROM users
		WHERE id LIKE '01900000-0000-7000-8000-00000000000_'
	),
	drafts AS (
		SELECT printf('%04d%02d%02d0000', day, person, rank) AS id_suffix, user_id, is_child,
			15 * (1 + (day * 3 + person * 5 + rank) % (CASE WHEN is_child THEN 3 ELSE 6 END)) AS minutes,
			printf('01900000-0000-7000-a000-%012d', 1 + (day * 5 + person * 3 + rank * 7) % 15) AS chore_type_id,
			strftime('%Y-%m-%dT%H:%M:00.000Z', 'now', 'start of day', '-' || day || ' days',
				'+' || (7 * 60 + ((day * 37 + person * 11 + rank * 53) % 52) * 15) || ' minutes') AS started_at,
			CASE WHEN is_child AND (day + rank) % 3 = 0 THEN '01900000-0000-7000-8000-000000000002'
				ELSE user_id END AS author_user_id,
			CASE WHEN (day + person + rank) % 7 = 0 THEN 'avec la musique 🎶' END AS note
		FROM days, ranks, family
		WHERE (day * 7 + person * 13 + rank * 29) % 10 < 6 AND (rank < 2 OR NOT is_child)
	)
INSERT INTO chores (id, chore_type_id, duration_minutes, started_at, performer_user_id,
	author_user_id, note, created_at, updated_at)
SELECT '01900000-0000-7000-b000-' || id_suffix, chore_type_id, minutes, started_at, user_id,
	author_user_id, note, started_at, started_at
FROM drafts
WHERE julianday(started_at) + minutes / 1440.0 <= julianday('now') -- no future chores (Q3)
ON CONFLICT DO NOTHING;

INSERT INTO record_versions (id, table_name, record_id, version_number, change_kind,
	changed_by_user_id, changed_at, record_snapshot_json)
SELECT '01900000-0000-7000-c000-' || substr(id, -12), 'chores', id, 0, 'created', author_user_id,
	created_at,
	json_object('id', id, 'chore_type_id', chore_type_id, 'duration_minutes', duration_minutes,
		'started_at', started_at, 'performer_user_id', performer_user_id,
		'author_user_id', author_user_id, 'note', note, 'update_count', update_count,
		'created_at', created_at, 'updated_at', updated_at, 'deleted_at', deleted_at,
		'deleted_by_user_id', deleted_by_user_id)
FROM chores WHERE id LIKE '01900000-0000-7000-b000-%'
ON CONFLICT DO NOTHING;
