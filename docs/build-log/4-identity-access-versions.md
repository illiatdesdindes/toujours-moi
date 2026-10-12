# #4 Identity, users, access policy and version log

## Acceptance criteria

- [x] Migrations `users` and `record_versions` (`migrations/0001_users_and_record_versions.sql`): UUID v7 text ids, versioned columns, Q7's `record_versions` with `record_id` as text.
- [x] `viewer-resolution.ts` copied from notakid: Access JWT → email → active `users` row → `locals.viewer = { id, role, name, colourKey }` (`src/hooks.server.ts`). Unknown or deactivated email → French "Accès refusé" page, 403.
- [x] Bootstrap: while `users` is empty, the first verified login becomes admin.
- [x] `DEV_VIEWER_EMAIL` in `.dev.vars` (dev only; ignored by the built Worker).
- [x] Per-viewer rate limit (`VIEWER_RATE_LIMIT`, 60/min, as in notakid).
- [x] `src/lib/server/access-policy.ts` with a unit-tested matrix (view profile, log for, edit/delete chore, manage members/types, Famille, last active admin).
- [x] `saveWithVersion(db, tableName, recordId, changes, changedByUserId)`: change + `update_count` + full JSON snapshot in one D1 batch.
- [x] Local seed: 4 users (Papa admin, Maman parent, Léa and Noé children), `npm run db:seed:local`.
- [x] Integration tests: bootstrap, unknown/deactivated refused (`test/viewer-access.test.ts`), exactly one version row per change (`test/record-versions.test.ts`).
- [x] `npm run lint && npm run check && npm test` green; browser pass at 390 px and 1280 px as admin, child (`lea@`) and an unknown email.

## Decisions

- **`db` is the first parameter of `saveWithVersion`**: the spec's signature leaves it out, but the module has no global binding to read, and passing it keeps the function testable against the test D1.
- **Create vs update is decided by whether `recordId` exists** (one read before the batch): missing → `INSERT … ON CONFLICT DO NOTHING`, version 0 `created`; present → `UPDATE` with `update_count + 1`, `deleted` when `changes.deleted_at` is set, else `updated`. Options were an explicit kind parameter or this; this keeps the spec's signature. #5 must check an existing chore id (same author) itself before calling it for the idempotent retry, since a second call with the same id is an update.
- **Snapshot built in SQL** (`INSERT INTO record_versions … SELECT …, json_object(<every column>) FROM <table> WHERE id = ?`), in the same batch, so it is the real row after the change (defaults included) and the version number is the row's own `update_count`. This needs each table's column list: `VERSIONED_COLUMNS` in `record-versions.ts`, which is also the whitelist for the table and column names put into SQL. #5/#9 add `chores` and `chore_types` there.
- **A create that loses to a UNIQUE constraint writes nothing and returns null** (version insert `ON CONFLICT DO NOTHING` on creates only). Updates keep a plain insert, so a missing increment fails loudly.
- **Bootstrap race**: two concurrent first logins can only be the same email (the Access policy lists only the admin at first, Q1), so the second loses on `UNIQUE(email)` and reads back the first one's row. No lock.
- **Bootstrap admin**: name = the email's local part, colour `tomato` (first of the palette); both editable in Mon profil (#9). The version's `changed_by_user_id` is the new admin.
- **Colour keys** are the prototype's English keys (`tomato`, `tangerine`, … `raspberry`) in `src/lib/domain.ts`, with a CHECK in the migration. Seed users and emails (`papa@exemple.fr`…) copied from the prototype.
- **Rate limit before the users lookup**, keyed on the verified email, so a looping client doesn't hit D1. Unauthenticated requests are refused before it.
- **"Accès refusé" is `src/error.html`**, not `+error.svelte`: SvelteKit renders the static fallback page for errors thrown in `handle`. Pop look inlined (cream card, navy border, hard shadow, Space Grotesk, the app icon). Also used for the French 429.
- **Header shows the viewer's name** on the right, as the prototype does when there's no switcher (#6 replaces it with the switcher for parents/admin). The root `+layout.server.ts` passes `locals.viewer`.
- **Access bindings**: `ACCESS_TEAM_DOMAIN` is the same team as notakid; `ACCESS_AUD` is a placeholder outside production, and production mode throws ("#12") like the D1 id, since the Access app doesn't exist yet.
- **`last-admin` rule** is in the policy now (`keepsAnActiveAdmin`), unit-tested; #9 wires it to the Membres actions.
- **Seed via `sqlite3`** on the local D1 file, as in notakid: `cf d1 query --local` answers "no local equivalent". The seed also writes each user's version 0, as `saveWithVersion` would. Re-runnable.
- **Integration helpers** in `test/access-jwt.ts` (sign as Access, stub the certs endpoint, fetch the built Worker). The JWT signer fixture is copied from notakid (`src/lib/server/access-jwt.fixtures.ts`). The rate-limit test uses its own email because the limiter's counts outlive tests. The old "has a migrated local D1" check is dropped: every test now uses the migrated tables.

## Deviations from spec

## Skipped review/QA findings
