-- The family of prototypes/02-screens.html for `npm run dev` (`npm run db:seed:local`). Local
-- database only; re-runnable (fixed ids, ON CONFLICT DO NOTHING). Switch between them with
-- DEV_VIEWER_EMAIL in .dev.vars. #5 adds ~2 months of chores.
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
