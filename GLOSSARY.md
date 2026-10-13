# Glossary

The words the code, the docs and the issues use. Code is in English; the French UI word follows in
brackets when there is one.

## People and access

- **User**: a family member with a row in `users`. Has a role, a name and a colour. Deactivated =
  `deleted_at` is set (soft delete); a deactivated user can't get in.
- **Role**: `admin`, `parent` or `child` [admin, parent, enfant]. Spec Q8.
- **Admin**: the role that manages members and chore types. There is always at least one **active
  admin** (spec Q10); a deactivated admin doesn't count.
- **Bootstrap admin**: while `users` is empty, the first email Cloudflare Access verifies becomes
  the admin (spec Q1).
- **Viewer**: the active user behind the current request, resolved from the Access JWT
  (`locals.viewer`). Not "current user", not "session".
- **PersonRef**: the minimum the access policy needs about a person: `{ id, role }`.
- **Access policy**: `src/lib/server/access-policy.ts`, the one place that decides who may do what.
  "Access" alone means Cloudflare Access, the login in front of the app.
- **Profile switcher**: the header dropdown of Accueil / Historique / Rapports that picks whose view
  is on screen, kept in `?profil=<user_id|famille>` (spec Q8; `ProfileSwitcher.svelte`,
  `profile-selection.ts`). Children don't get it.
- **Selected profile**: the person (or Famille) the profile switcher shows; no `?profil=` means the
  viewer. The page wears their colour (`--color-primary`), Famille stays neutral.
- **Family profile** [Famille]: the profile option that shows the whole household, for parents and
  the admin (spec Q8). Code says `familyProfile`, not `famille`.

## Chores

- **Chore** [tâche]: one thing someone did, for a duration (multiple of 15 min, 15 min to 24 h),
  from a start time (`started_at`, UTC). Never in the future (spec Q3).
- **Chore type** [type de tâche]: a catalog entry (icon emoji, short and full label). Archived types
  drop out of the picker; past chores keep them (spec Q2).
- **Performer** [fait par]: who did the chore (`performer_user_id`). **Author**: who logged it
  (`author_user_id`), set by the server, never shown. A chore "logged for" someone has a performer
  who isn't its author.
- **Quick log**: the home's two taps (duration, then type) that log a chore (spec Q4).
- **Pending chore**: a quick-logged chore during its 5 s countdown, before it's committed; Annuler
  drops it, Modifier takes it to the edit sheet (`pending-chore.ts`).
- **Chore outbox**: the `localStorage` queue of committed chores the server doesn't have yet,
  retried until it does (`chore-outbox.ts`, spec Q20 point 1).

## Version log

- **Versioned table**: a table whose every change goes through `saveWithVersion()` and leaves one
  row in `record_versions` (spec Q7): `users`, `chores` and `chore_types`.
- **Version**: one `record_versions` row: the full row after a change (`record_snapshot_json`),
  numbered by the row's `update_count`.
- **Change kind**: `created`, `updated` or `deleted` (the soft delete that sets `deleted_at`).
