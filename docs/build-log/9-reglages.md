# #9 Réglages: profile, children, members, chore types

## Acceptance criteria

The ticket has no "Done when" list; its "What" items are the criteria.

- [x] Mon profil: prénom and colour (8-colour palette, `PersonalColourPicker.svelte`), saved through `?/updatePersonDetails`; the app re-tints at once (layout reload). The notifications toggle is #10's, as the ticket says.
- [x] Enfants (parents): every active child's name and colour, same action; the access policy's new `canEditPersonDetails` (self; parent → children; admin → everyone).
- [x] Membres (admin): Ajouter (email, prénom, rôle, couleur) → the Access-policy reminder ("Ajoute aussi … à la politique Cloudflare Access"); edit name / colour / role; Désactiver / Réactiver (soft delete; a deactivated user gets 403 at login). The last active admin can't demote or deactivate themselves: `keepsAnActiveAdmin` on the server, role select and Désactiver greyed on the page.
- [x] Types de tâches (admin): add (emoji + short label + optional full label), rename, change icon, reorder (↑ ↓), archive / restore. Archived types leave the picker.
- [x] Every write goes through `saveWithVersion` (one version each) and the access policy (`canManageUsers`, `canManageChoreTypes`, `canEditPersonDetails`, `canSeeChildrenSettings`).
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
- **The Enfants card is for parents only**, as the prototype; the admin edits children in Membres. The policy still lets the admin edit anyone's details. Decided by `canSeeChildrenSettings` in the access policy (review fix: the load had a raw role check).
- **Validation limits**: prénom 1–30 chars, short label 1–20, full label ≤ 60 (blank → the short label), icon = one grapheme that is an emoji (`Intl.Segmenter` + `\p{Extended_Pictographic}` / regional indicators / keycap), email shape check only (Access proves it). French messages in `settings-fields.ts`.
- **New types get `type_key = custom_<id>`** (the column is UNIQUE and English-slug; nothing reads it for admin types), as the prototype's `custom_…`; `sort_order` = max + 1 (last in the picker).
- **Reorder renumbers the catalog by position** (archived types count, as listed) and writes only the rows whose `sort_order` changes, one `saveWithVersion` each: a swap is two versions. Not one batch for both (saveWithVersion owns its batch); a failure halfway leaves a tie that the next move fixes (`ponytail:` note in `chore-types.ts`).
- **Last-admin guard is a count then a write**, two requests: two admins demoting each other at the same instant could both pass. Accepted for a family app (`ponytail:` note in `user-settings.ts`).
- **`canEditPersonDetails` is `canViewProfile`** (same people today), aliased with a note to split when the rules part.
- **Names**: the glossary says a family member is a "user", not a "member", so the code says `UserAccount` (user + email + status), `listAllUsers`, `user-settings.ts`, `addUser`, `updateUserAsAdmin`, `setUserActive`; "Membres" stays the UI word. `listPickableChoreTypes` and the new `listChoreTypeCatalog` share one query (`ORDER BY sort_order, id`).
- **No migration**: every column existed (`archived_at`, `sort_order`, `deleted_at`).
- **`npm run db:migrate:local` hung in the sandbox** (the `cf` CLI, nothing to apply); the local D1 already had both migrations and the seed, checked with `sqlite3`.

### Review fixes

- **Last-active-admin flag from the policy**: the load adds `isLastActiveAdmin` to each Membres row from `keepsAnActiveAdmin(…, change: 'deactivate')`; the page no longer re-derives the rule. 'deactivate' stands for demotion too: for an active admin both lose an admin, so one flag greys out both the role select and Désactiver.
- **One answer module**: `SettingsAnswer`, `refused`, `SAVED`, `ADMINS_ONLY` and `FormFields` live in `settings-fields.ts` (already "Réglages' form fields"), not a new file; `chore-types.ts` no longer imports from `user-settings.ts`. `SettingsAnswer<Saved>` lets `addUser` answer `{ status: 200, addedUserEmail }`, the email as stored, so the reminder can't show another spelling.
- **Components**: `PersonNameInput.svelte` (prénom input, attributes pass through), `UserRoleSelect.svelte` (loops `USER_ROLES`, owns the French role labels) and `ChoreTypeFields.svelte` (icon + short + full label, with snippets for the buttons each row ends with). Not one "person details" component with the colour picker inside: Membres puts the role, badge and email between the name and the colour, so the shared part is the name input; the picker was already a component.
- **Limits in `domain.ts`** (`MAX_PERSON_NAME_LENGTH`, `MAX_CHORE_TYPE_SHORT_LABEL_LENGTH`, `MAX_CHORE_TYPE_FULL_LABEL_LENGTH`), next to `MAX_CHORE_NOTE_LENGTH`: pages can't import `$lib/server`.
- **Renames**: `canManageMembers` → `canManageUsers`, `keepsAnActiveAdmin({ member })` → `{ user }`, `parseChoreTypeLabels` → `parseChoreTypeDetails`, test-family's `otherMembers` → `otherUsers`, glossary "manages members" → "manages users". "Membres" stays the UI word; "family member" stays as the glossary's plain-English definition of a user, and #7's test alias `FamilyMemberId` in `chore-history.test.ts` is left to that ticket's file.
- **`moveChoreType` checks `isUuidV7` first**, as its siblings; it keeps its own `findIndex` because it needs the whole catalog to renumber.
- **Ajouter un membre starts on the first palette colour nobody wears yet** (deactivated users count), as prototype 02's `addMember`; tomato when all 8 are taken.

## Deviations from spec

Departures from prototype 02 (the spec allows each; recorded so they're visible here):

- An explicit Enregistrer button per form, where the prototype edits live (see Decisions: one Enregistrer per form).
- Colours are a radio group inside each form, not tap-to-save swatches (Decisions: colour is a radio group).
- Types de tâches has a full-label field; the prototype shows icon + short label only. Spec Q2 has the full label.
- Membres rows edit the name; the prototype shows it read-only. Spec Q10: "Edit name / colour / role".

## Skipped review/QA findings

- None skipped. Finding 10's "fixed default colour for new members" is no longer a deviation: it now follows the prototype.
