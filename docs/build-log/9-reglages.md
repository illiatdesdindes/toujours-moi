# #9 Réglages: profile, children, members, chore types

## Acceptance criteria

The ticket has no "Done when" list; its "What" items are the criteria.

- [x] Mon profil: prénom and colour (8-colour palette, `PersonalColourPicker.svelte`), saved through `?/updatePersonDetails`; the app re-tints at once (layout reload). The notifications toggle is #10's, as the ticket says.
- [x] Enfants (parents): every active child's name and colour, same action; the access policy's new `canEditPersonDetails` (self; parent → children; admin → everyone).
- [x] Membres (admin): Ajouter (email, prénom, rôle, couleur) → the Access-policy reminder ("Ajoute aussi … à la politique Cloudflare Access"); edit name / colour / role; Désactiver / Réactiver (soft delete; a deactivated user gets 403 at login). The last active admin can't demote or deactivate themselves: `keepsAnActiveAdmin` on the server, role select and Désactiver greyed on the page.
- [x] Types de tâches (admin): add (emoji + short label + optional full label), rename, change icon, reorder (↑ ↓), archive / restore. Archived types leave the picker.
- [x] Every write goes through `saveWithVersion` (one version each) and the access policy (`canManageMembers`, `canManageChoreTypes`, `canEditPersonDetails`).
- [x] Tests: unit `settings-fields.test.ts` (names, palette, email, role, single emoji, labels) and the policy matrix; integration `test/settings.test.ts` (sections per role, each action per role, versions, last-admin guard, deactivated login refused then reactivated, catalog add / rename / reorder / archive / restore).
- [x] Browser pass at 390 px and 1280 px as Papa (colour change re-tints, add / move / archive / restore a type, invalid emoji toast, add a member + reminder, deactivate / reactivate), Maman (Mon profil + Enfants, child colour saved) and Léa (Mon profil only, empty name blocked). No horizontal scroll. `DEV_VIEWER_EMAIL` put back to Papa; the test rows removed from the local D1.
- [x] `npm run lint && npm run check && npm test` green.

## Decisions

- **Form actions with `use:enhance`, one per change** (`updatePersonDetails`, `addUser`, `updateUserAsAdmin`, `deactivateUser` / `reactivateUser`, `addChoreType`, `updateChoreType`, `moveChoreTypeUp` / `Down`, `archiveChoreType` / `restoreChoreType`), not Historique's hand-made `fetch` + `deserialize`: here the forms are plain page forms, which is what `enhance` is for (notakid's Réglages does the same). Outcome in the shared toast; the reminder renders from `form.addedUserEmail`.
- **One Enregistrer per form; Désactiver, ↑ ↓ and Archiver post a separate hidden form** (`form=` + `formaction=`), so Entrée in a text field always means Enregistrer (the implicit submit uses the form's first submit button). Each such button carries its own `data-success-message`, read before the reload re-renders it.
- **Colour is a radio group inside each form** (`PersonalColourPicker`), not notakid's submit-on-tap swatches: Ajouter needs the colour with the other fields, and one component serves the four places.
- **Membres edits name, colour and role, not the email** (spec Q10 lists exactly those). Changing an email means changing the Access policy too; deactivate + add covers it.
- **A duplicate email (deactivated users included) is refused** with "Cette adresse e-mail a déjà un profil": `users.email` is UNIQUE; Réactiver is the way back.
- **The admin may deactivate themselves while another active admin exists** (spec: only the last admin is guarded). The prototype's rule.
- **The Enfants card is for parents only**, as the prototype (`viewer.role === 'parent'`); the admin edits children in Membres. The policy still lets the admin edit anyone's details.
- **Validation limits**: prénom 1–30 chars, short label 1–20, full label ≤ 60 (blank → the short label), icon = one grapheme that is an emoji (`Intl.Segmenter` + `\p{Extended_Pictographic}` / regional indicators / keycap), email shape check only (Access proves it). French messages in `settings-fields.ts`.
- **New types get `type_key = custom_<id>`** (the column is UNIQUE and English-slug; nothing reads it for admin types), as the prototype's `custom_…`; `sort_order` = max + 1 (last in the picker).
- **Reorder renumbers the catalog by position** (archived types count, as listed) and writes only the rows whose `sort_order` changes, one `saveWithVersion` each: a swap is two versions. Not one batch for both (saveWithVersion owns its batch); a failure halfway leaves a tie that the next move fixes (`ponytail:` note in `chore-types.ts`).
- **Last-admin guard is a count then a write**, two requests: two admins demoting each other at the same instant could both pass. Accepted for a family app (`ponytail:` note in `user-settings.ts`).
- **`canEditPersonDetails` is `canViewProfile`** (same people today), aliased with a note to split when the rules part.
- **Names**: the glossary says a family member is a "user", not a "member", so the code says `UserAccount` (user + email + status), `listAllUsers`, `user-settings.ts`, `addUser`, `updateUserAsAdmin`, `setUserActive`; "Membres" stays the UI word. `listPickableChoreTypes` and the new `listChoreTypeCatalog` share one query (`ORDER BY sort_order, id`).
- **No migration**: every column existed (`archived_at`, `sort_order`, `deleted_at`).
- **`npm run db:migrate:local` hung in the sandbox** (the `cf` CLI, nothing to apply); the local D1 already had both migrations and the seed, checked with `sqlite3`.

## Deviations from spec

## Skipped review/QA findings
