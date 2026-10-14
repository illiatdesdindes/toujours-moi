# Glossary

The words the code, the docs and the issues use. Code is in English; the French UI word follows in
brackets when there is one.

## People and access

- **User**: a family member with a row in `users`. Has a role, a name and a colour. Deactivated =
  `deleted_at` is set (soft delete); a deactivated user can't get in. Code type `User`
  (`domain.ts`), read through `src/lib/server/users.ts`; not "member".
- **User account**: a user as Membres lists it, deactivated ones too, with email and status
  (`UserAccount`, `listAllUsers()`). Written by `user-settings.ts` (spec Q10).
- **Personal colour** [couleur]: one of the 8 palette colours a user wears (`colour_key`, picked
  with `PersonalColourPicker.svelte`); it tints the app when their view is on screen.
- **Role**: `admin`, `parent` or `child` [admin, parent, enfant]. Spec Q8.
- **Admin**: the role that manages users and chore types. There is always at least one **active
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
  the admin (spec Q8). Code says `{ kind: 'family' }` (a `SelectedProfile`) and
  `FAMILY_PROFILE_PARAM` (its `?profil=` value, `famille`); "family" alone means this profile.

## Chores

- **Chore** [tâche]: one thing someone did, for a duration (multiple of 5 min, 5 min to 24 h),
  from a start time (`started_at`, UTC). Never in the future (spec Q3).
- **Chore type** [type de tâche]: a catalog entry (icon emoji, short and full label). Archived types
  drop out of the picker; past chores keep them (spec Q2). The **chore type catalog** is every
  non-deleted type, archived ones too, as Réglages' Types de tâches lists it
  (`listChoreTypeCatalog()`).
- **Réglages** [Réglages]: Mon profil (everyone), Enfants (parents), Membres and Types de tâches
  (the admin); every write is a form action of `/reglages` (spec Q10).
- **Performer** [fait par]: who did the chore (`performer_user_id`). **Author**: who logged it
  (`author_user_id`), set by the server, never shown. A chore "logged for" someone has a performer
  who isn't its author.
- **Quick log**: the home's two taps (duration, then type) that log a chore (spec Q4).
- **Pending chore**: a quick-logged chore during its 5 s countdown, before it's committed; Annuler
  drops it, Modifier takes it to the edit sheet (`pending-chore.ts`).
- **Historique** [Historique]: the list of chores performed by the selected profile, newest first,
  by Paris day with its total (spec Q6; `chore-history.ts`, `history-days.ts`). Pages of 50 that
  never split a day, fetched by `?avant=<nextCursor>` on `GET /api/chores`.
- **Rapports** [Rapports]: the selected profile's totals for one **report period** (spec Q9;
  `report-periods.ts`, `report-stats.ts`). A report period is a Paris day, a Monday-to-Sunday
  week, a month or a year, picked by `?periode=jour|semaine|mois|annee&date=YYYY-MM-DD` (no future);
  its **buckets** are the sub-periods of the "Dans le temps" bars (days, or months for a year). A
  chore counts in the period of its start.
- **Edit sheet**: the form that changes a chore, opened by the home's Modifier (pending chore) and
  by a Historique row (saved chore, with Supprimer; read-only 🔒 when the access policy forbids
  it). `ChoreEditSheet.svelte`.
- **Chore outbox**: the `localStorage` queue of committed chores the server doesn't have yet,
  retried until it does (`chore-outbox.ts`, spec Q20 point 1).

## Version log

- **Versioned table**: a table whose every change goes through `saveWithVersion()` and leaves one
  row in `record_versions` (spec Q7): `users`, `chores` and `chore_types`.
- **Version**: one `record_versions` row: the full row after a change (`record_snapshot_json`),
  numbered by the row's `update_count`.
- **Change kind**: `created`, `updated` or `deleted` (the soft delete that sets `deleted_at`).
- **Soft delete** [Supprimer]: setting `deleted_at` and `deleted_by_user_id` through
  `saveWithVersion()`; the row stays, and leaves Historique and the reports. No undelete in v1.
- **Update count**: a row's `update_count`, its number of versions after the first; shown on
  Historique rows as "✎ n" to the admin only (`canSeeChoreUpdateCount`).

## App

- **Install screen** [Installe Toujours Moi!]: the blocking screen a phone tab that isn't installed gets
  instead of the app (spec Q12; `InstallScreen.svelte`). Who sees it is the `install-gate` CSS
  variant (`layout.css`): coarse pointer, narrower than `md`, not `display-mode: standalone`.
  Desktop is exempt. Its "Installer Toujours Moi!" button shows Chrome's **install prompt**
  (`beforeinstallprompt`, `install-prompt.ts`) when Chrome offers one.
- **App shell**: the built JS/CSS and `static/`, cached by the service worker per deploy
  (`src/service-worker/index.ts`), with the last copy of each page for offline.

## Notifications

- **Push subscription**: one browser's Web Push subscription (`push_subscriptions`, one row per
  device), made by Réglages' "Notifications sur cet appareil" toggle (`DeviceNotificationsToggle.svelte`,
  `push-subscriptions.ts`). It belongs to whoever subscribed the device last; a 404/410 from the
  push service deletes it.
- **Chore notification**: the push a new chore sends to its **recipients** (spec Q11): never its
  author, every grown-up, a child when it was logged for them or done by another child
  (`chore-notifications.ts`). Sent once, on creation, after the commit (`chore-notification-sending.ts`);
  edits and deletes send nothing. One `tag` per performer.
