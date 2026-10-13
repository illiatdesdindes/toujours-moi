# #7 Historique: list, edit sheet, soft delete

## Acceptance criteria

- [x] Chores performed by the profile in view, newest first, grouped by Paris day with the daily total ("Aujourd'hui · 3 h 30"), 50 per page with infinite scroll (`listHistoryPage` in `src/lib/server/chore-history.ts`, `groupChoresByParisDay` in `src/lib/history-days.ts`, `HistoryChoreRow.svelte`). Famille shows everyone with the performer's dot and name.
- [x] Tap a row → the same `ChoreEditSheet` as the home's Modifier → Enregistrer → `updateChore` form action → `saveWithVersion` (`update_count + 1`, one `updated` version). Read-only (🔒, title "Tâche", fieldset disabled, no buttons) when `canEditOrDeleteChore` says no.
- [x] Supprimer → "Supprimer cette tâche ?" → `deleteChore` form action → soft delete (`deleted_at`, `deleted_by_user_id`, a `deleted` version); the chore leaves the list. Reports (#8) must filter `deleted_at IS NULL` too; nothing to hide there yet.
- [x] "✎ n" badge, admin only: the server sends `updateCount` only when `canSeeChoreUpdateCount` (new in `access-policy.ts`), else null.
- [x] **Integration tests** (`test/chore-history.test.ts`): edit and delete matrix (child own / logged for them by a parent / another child's; parent own / a child's / the other parent's; admin on a parent's), each checking the versions written (or none); one version per save; future and invalid duration refused with nothing written; a parent may hand a chore only to someone they may log for; 404 on unknown or already deleted; the list per profile (deleted hidden, `canEdit`, update count admin only, Famille 403 for a child); paging by 50 without splitting a day; the SSR page. Unit: `history-days.test.ts`, `startOfParisDay` in `paris-time.test.ts`.
- [x] Browser pass, 390 px and 1280 px: as Papa (admin) list + infinite scroll to the last page (146 rows, 60 days, no horizontal scroll), edit → "✎ 1" badge and new day total, Supprimer cancelled keeps the sheet, confirmed removes the row + toast, DB shows versions 1–3 (`updated`, `updated`, `deleted`); as Maman on Famille: dots and names, Papa's rows 🔒 and read-only sheet, a child's row editable with "Fait par" Maman/Léa/Noé; as Léa: chores Maman logged for her 🔒 and read-only, no "Fait par", `/api/chores?profil=famille` 403; a save on a chore deleted meanwhile keeps the sheet open with "Tâche introuvable : elle a peut-être été supprimée". Home Modifier → Enregistrer and ✕ still work. `DEV_VIEWER_EMAIL` put back to Papa.
- [x] `npm run lint && npm run check && npm test` green.

## Decisions

- **Pages never split a Paris day**: a page is the 50 newest chores plus the rest of the 50th's day, and `nextCursor` is that day's Paris midnight (`startOfParisDay`). Options: a plain 50 with an `(started_at, id)` keyset, with day totals computed client-side over what's loaded (a day cut by the page boundary would show a wrong total until the next page arrives), or a separate SQL total per day (Paris days in SQL means DST maths). Days hold a handful of chores, so a page grows by a few rows at most.
- **Next pages come from `GET /api/chores?profil=&avant=`**, the same path as the spec's one JSON endpoint (POST stays the quick log's). Options: a `+server.ts` beside the page (content negotiation on the same URL, subtle) or reloading the page load with a param (replaces data instead of appending). `?avant=` is French like `?profil=`. The profile goes through the same `loadSelectedProfile` (403/404).
- **Edit and delete are form actions on `/historique`** (`?/updateChore`, `?/deleteChore`), as the spec's Routes say, sent from the sheet with `fetch` + `deserialize` (the sheet is a JS component already), then `invalidateAll()`. A refusal (`fail(400|403|404, { message })`) keeps the sheet open with the reason under the form, so nothing typed is lost; no network → "Pas de réseau : l'historique en a besoin, réessaie quand il revient" (spec: Historique needs the network).
- **After a save or delete the list goes back to its first page** (the load reruns, loaded older pages are dropped). Options: patching the row locally (a changed date moves it across days and pages, and dedupe against later pages). Edits are mostly on recent chores.
- **The read-only sheet says "Tu ne peux pas modifier cette tâche."**, not the prototype's "Notée par Maman : …": spec Q3 says the author is "never shown". Spec wins over the prototype.
- **A parent changing the performer**: allowed only to someone `canLogFor` allows (re-attributing is logging for them); keeping the performer is always fine, so the admin can edit Maman's chore although they can't log for her. The author never changes.
- **The sheet's lists include the chore's own type and performer** when they aren't offered (an archived type; the admin editing Maman's chore, whom "Fait par" doesn't offer), so the picker and the select show the real values instead of nothing.
- **Sheet API**: `ChoreEditSheet` gained `title`, `readOnly`, `onDelete`; `onSave`/`onDelete` may return a `Promise<string | null>` (the refusal), and every close now calls `onClose` (found in the browser pass: after a save the sheet couldn't reopen on the same chore, since the page kept it as "in the sheet").
- **Delete confirmation is the native `confirm()`**, as the prototype: one line, accessible, works inside the modal dialog.
- **🔒 is an SVG** (`lock-closed` in `Icon.svelte`) with a screen-reader "(lecture seule)", per AGENTS.md's interface icons rule; "✎ n" stays a text badge (`badge-secondary`, `h-auto` so it never clips).
- **Shared validation lives in `chore-validation.ts`** (moved out of `chore-logging.ts` after review): `parseChoreFields`, `endsInTheFutureForTheServer` (with the 2 min clock allowance), `findChoreTypeRefusal`, `findActivePerformer` and `choreColumnsFrom` are used by both `chore-logging.ts` and `chore-editing.ts`, so creating and editing refuse the same things with the same French messages.
- **Deactivated performers and archived types still show in the list** (joins without the active filters): their chores stay (Q2, Q10). Editing a deactivated person's chore is allowed as long as the performer stays the same (changed after review, see below); handing a chore to a deactivated person is refused ("Personne inconnue"), as creating one.
- **No migration**: the `(performer_user_id, started_at)` and `(started_at)` indexes from 0002 serve both queries.

### After code review

- **`NewChore` / `parseNewChore` renamed `ChoreFields` / `parseChoreFields`**: the type is now also the body of `?/updateChore` and the base of `HistoryChore`, so "new" was no longer true. The rename covers the outbox, the home, the edit sheet, the tests and the #5 build log.
- **`findEditableChore` → `findChoreTheViewerMayEdit`**, with its comment fixed: it never returned null, it returns the 404/403 refusal or the chore's current type and performer.
- **`findChoreTypeAndPerformer` split** into `findChoreTypeRefusal(db, choreTypeId, { archivedTypeAllowed })` (the French reason or null) and `findActivePerformer` (the performer or null). No more `string | performer` union.
- **An edit may keep its chore's archived type, never move onto another archived one** ("Type de tâche archivé", 400): spec Q2 says archived types leave the picker, and Q20.5 says the server enforces what the UI hides. Creating a chore still takes an archived type (the outbox case from #5).
- **An edit that keeps the performer doesn't re-check them**: the admin can fix the note of a deactivated person's chore (Q6 "Admin: everything"). Changing the performer still needs an active person `canLogFor` allows. Both are covered by new integration tests.
- **`HistoryChore` carries `performerRole`** (the query already selected it), so the "Fait par" option added for a performer who isn't offered has the real role instead of a made-up `'parent'`.
- **`deleteChore` takes `now = new Date()`**, as `updateChore` does.
- **`choreColumnsFrom(chore)`** replaces the column map written out in both `logChore` and `updateChore`.

## Deviations from spec

- **`GET /api/chores?profil=&avant=`** next to the spec's single `POST /api/chores` (Routes): Historique's next pages. Why: see Decisions. It shares the path and goes through the same profile check.
- **A page is 50 chores plus the rest of the 50th's Paris day**, so it can hold a few more than the spec's "50 per page" (Q6). Why: a day's total is never cut by a page boundary (see Decisions).
- **The read-only sheet says "Tu ne peux pas modifier cette tâche."** instead of the prototype's "🔒 Notée par {{ … }} : tu ne peux pas la modifier.": spec Q3 says the author is never shown, and the spec wins over the prototype.
- **A visible "Plus ancien" button** sits on the infinite-scroll sentinel: neither the spec nor the prototype has it. Kept as the keyboard / no-IntersectionObserver fallback (accessibility basics); it only shows while there is an older page.

## Skipped review/QA findings

- **Shared `PersonRef` mapping before `canEditOrDeleteChore`** (chore-editing.ts and chore-history.ts): skipped. Four lines in two places, and a helper would bring the DB column names (`performer_user_id`, `performer_role`) into the access policy, or make one server module import a row shape from another.
- **The two `refused` helpers**: skipped. They aren't the same code: `chore-logging.ts` answers an API body (`{ status, body: { message } }`, 400/409/422), `chore-editing.ts` a form-action failure (`{ status, message }`, 400/403/404).
