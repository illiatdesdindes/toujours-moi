# TJM (Toujours Moi) — spec

Family chore tracker. Living document written during the grilling session: **Decided** is settled, **Open** is still to grill. Safe to resume from here after a compaction.

## Context

- PWA, SvelteKit + Tailwind + daisyUI, on Cloudflare Workers + D1, at `tjm.samyv.com`, behind Cloudflare Access.
- Architecture copies notakid (`~/work/notakid`): Access JWT check in one module (`viewer-resolution.ts`), `cf` CLI + `cloudflare.config.ts` with modes, Web Push with VAPID (`@block65/webcrypto-web-push`), service worker, a second Access app that bypasses login for the service worker, manifest and icons, deployed by CI on push to `main`. Only the differences are written down here.
- Code, identifiers and docs are in English; the whole UI (labels, text, inputs, errors) is in French.
- Responsive for mobile and desktop. On mobile, installing the PWA is forced (details: Open).

## Process

1. Prototype the theme → the screens → the SVG logo, as **single HTML files using standalone Vue** (CDN build, pinned version), so the prototypes carry the business logic without manual DOM wiring.
2. Prototypes show **variations side by side** where a design choice is open (e.g. the home pending card, icon-only vs icon + label types).
3. Then the technical spec where it differs from notakid, then implementation.

## Decided

### Access & users (Q1)

- **The Access policy is a manual email list** (as in notakid). The admin creates the profile in Configuration (email, name, role), then adds the same email to the Access policy by hand.
- **The app checks too**: a verified Access email that isn't an active row in `users` → French "Accès refusé" page.
- **Bootstrap**: while `users` is empty, the first verified login becomes admin. Safe because the policy starts out listing only the admin's email.
- Roles: `admin`, `parent`, `child`. Parent vs child for now: a parent may log a chore for a child.

### Chore types (Q2)

- A `chore_types` table, seeded by a migration. The admin can add, rename, change the icon of, reorder and **archive** types in Configuration (never hard-deleted). Archived types drop out of the picker; past chores and reports keep them. Parents and children can't edit the catalog.
- Seed (key · short label · full label · icon):

| key | short | full | icon |
|---|---|---|---|
| `dishes` | Vaisselle | Vaisselle | 🍽️ |
| `cooking` | Repas | Cuisine / repas | 🍳 |
| `table` | Table | Mettre / débarrasser la table | 🥄 |
| `bathroom` | Salle de bain | Salle de bain | 🛁 |
| `toilets` | WC | Toilettes | 🚽 |
| `vacuuming` | Aspirateur | Aspirateur / balai | 🧹 |
| `mopping` | Serpillière | Serpillière | 🪣 |
| `laundry` | Lessive | Lessive (lancer, étendre, plier) | 🧺 |
| `ironing` | Repassage | Repassage | 👕 |
| `groceries` | Courses | Courses | 🛒 |
| `trash` | Poubelles | Poubelles / tri | 🗑️ |
| `tidying` | Rangement | Rangement | 📦 |
| `bed_linen` | Lits | Lits / draps | 🛏️ |
| `garden` | Jardin | Jardin | 🌱 |
| `pets` | Animaux | Animaux | 🐾 |
| `other` | Autre | Autre | ✨ |

### Chore record (Q3)

Chores performed by one person and logged by another are called "logged for" below.

- `chore_type_id` (required), `duration_minutes` (required, multiple of 15, 15 to 1440 = 24 h), `started_at` (UTC instant), `performer_user_id` (who did it), `author_user_id` (who logged it, set by the server, never shown), `note` (optional, one line).
- Days, weeks, months and years are computed in **Europe/Paris**.
- No future chores: `started_at + duration` can't be after now.
- Children always log for themselves. A parent or admin picks the performer from themselves + the children (default: themselves, or the child whose view they've switched to).

### Home: quick log (Q4, Q5)

- **Rule: logging a chore must be as frictionless as possible.** Duration is the hardest field to remember, so it comes first. Every other field is derived and can be edited later.
- Layout, top to bottom: **duration** (big −/+ stepper by 15 min, chips 15 / 30 / 45 min / 1 h / 1 h 30 / 2 h / 3 h, up to 24 h) → **type grid** → a collapsed line "Aujourd'hui, 14:15 · Moi" that opens date / time / performer / note.
- Duration pre-fills with the user's last-used duration (overall, not per type).
- Start time = moment of the tap − duration, rounded down to the quarter hour (rounding up would make the chore end after the tap, which Q3 refuses). The user can edit date and time.
- **Tapping a type saves, through a client-side pending state**: a pending card ("🍽️ Vaisselle · 45 min · aujourd'hui 14:15") with a 5 s progress bar, **Modifier** and **Annuler**.
  - Countdown ends → sent to the server: the row is created and notifications go out.
  - Modifier → stops the countdown and opens the edit sheet, which saves with an explicit "Enregistrer".
  - Annuler → dropped. No row, no soft delete, no version, no notification.
  - `pagehide` / `visibilitychange` (hidden) during the countdown → sent immediately.
- Types show the **icon + short label** (4 columns on mobile, 6 on desktop); the full label goes in `title` / `aria-label`. Confirmed: icon + label reads better than icon only.
- **One `ChoreTypePicker` component** (icon + label tiles) is used both on the home and in the edit sheet.
- Pending card: **variant A** (bottom card + progress bar) chosen in prototype 02.
- The family is happy with the Pop look and feel of prototype 02.
- **Chore type icons = emoji** stored as text in `chore_types.icon`, rendered with the **Noto Color Emoji** font (Google Fonts) so they look the same on every platform; the admin adds a type by typing an emoji. **Interface icons** (dock, −/+, ✕…) = a few inline SVGs in `Icon.svelte`, as in notakid.

### Chores list, "Historique" (Q6)

- Shows the chores **performed by** the profile in view (yourself by default; the switcher changes it). A child sees only their own.
- Newest first, **grouped by day** with a daily total in the header ("Lundi 12 oct. · 2 h 15"). Row: icon, short label, duration, start time, note. Infinite scroll, 50 per page.
- Tap a row → the same edit sheet as the home's Modifier → "Enregistrer". Each save: `update_count + 1` and a version row.
- Delete: in the edit sheet, with a confirmation ("Supprimer cette tâche ?"). Soft delete (`deleted_at`, `deleted_by_user_id`); deleted chores leave the list and the reports.
- **Who may edit or delete a chore:**
  - Child: only chores they both performed **and** logged themselves (a chore a parent logged for them is read-only to them).
  - Parent: chores they performed + chores performed by any child.
  - Admin: everything.
- Update counter: a small "✎ 3" badge on the row, **admin only**.

### Version log & soft delete (Q7)

```sql
CREATE TABLE record_versions (
  id                   INTEGER PRIMARY KEY,
  table_name           TEXT    NOT NULL,          -- 'chores', 'users', 'chore_types'
  record_id            INTEGER NOT NULL,
  version_number       INTEGER NOT NULL,          -- 0 = created
  change_kind          TEXT    NOT NULL CHECK (change_kind IN ('created','updated','deleted')),
  changed_by_user_id   INTEGER NOT NULL REFERENCES users(id),
  changed_at           TEXT    NOT NULL,          -- ISO UTC
  record_snapshot_json TEXT    NOT NULL CHECK (json_valid(record_snapshot_json)),
  UNIQUE (table_name, record_id, version_number)
);
```

- Snapshot = the full row **after** the change, as JSON. Never a diff; compare with the previous version when reading.
- Versioned tables: **`chores`, `users`, `chore_types`**. Each has `update_count` (default 0), `created_at`, `updated_at`, `deleted_at`, `deleted_by_user_id`.
- One server function writes every versioned change: `saveWithVersion(tableName, recordId, changes, changedByUserId)`. It sends the INSERT/UPDATE, increments `update_count`, and inserts the version in **one D1 batch**. `version_number` = `update_count` after the change.
- Soft delete = a write setting `deleted_at` with `change_kind = 'deleted'`.
- No UI and no undelete in v1; the log is queryable by hand with `json_extract`. The update counter is shown (admin only) on chores only.

### Profile switcher (Q8)

- A dropdown in the header of **Accueil, Historique and Rapports**, showing the person's coloured dot and name. Children don't get it.
- Options: parent → themselves + every child + **Famille**; admin → everyone + **Famille**.
- Kept in a `?profil=<user_id>` (or `?profil=famille`) query param across the three pages; leaving it out means yourself.
- The page wears the selected person's colour; Famille stays neutral.
- Home: the selected person is the default performer (we'll see if that causes wrong attributions). Famille on home → yourself.
- Historique with Famille: everyone's chores, each row showing who did it; the edit rights of Q6 still apply (a parent can't edit the other parent's chores).
- Rapports with Famille: household totals with a per-person breakdown.

### Rapports (Q9)

- Tabs: Jour · Semaine · Mois · Année. Navigation `‹ Semaine du 5 au 11 oct. ›` plus an "Aujourd'hui" button; `›` disabled on the current period.
- Weeks run Monday to Sunday, Europe/Paris. A chore counts in the period of its **start time** (one crossing midnight belongs to its start day).
- Content:
  1. Headline: total duration + number of chores + change against the previous period ("+1 h 15 vs semaine dernière").
  2. Over time: bars per sub-period (Semaine → 7 days, Mois → each day, Année → 12 months; none for Jour). With Famille, stacked in each person's colour.
  3. Per type: horizontal bars sorted by duration (icon, label, duration, %, count).
  4. Famille only, per person: one bar per person, in their colour.
- No chart library: CSS/flex bars + daisyUI.
- A child sees their own; parents and admin see the profile in the switcher.

### Réglages (Q10)

- **Mon profil** (everyone): prénom; **couleur** (fixed palette of 8 with readable contrast). It's one setting: it tints the app (`--color-primary`) when that person's view is on screen and colours them in the Famille charts. **Notifications on/off per device** (one push subscription per browser) + **Tester**. Light/dark follows the system, with no setting.
- **Enfants** (parents): every child's card; a parent may edit a child's name and colour, not their notifications.
- **Membres** (admin): everyone with role and status. Ajouter (email, prénom, rôle, couleur) → reminder to also add the email to the Access policy. Edit name / colour / role. **Désactiver** = soft delete: refused even if still in Access; their chores stay in the reports.
- At least one active admin at all times: others can be promoted; the last admin can't demote or deactivate themselves.
- **Types de tâches** (admin): the catalog (Q2).
- No other app-level settings in v1 (timezone Europe/Paris and the 5 s pending delay are constants).

### Notifications (Q11)

A chore logged by A, performed by P. **A is never notified.**

| Recipient | Notified when |
|---|---|
| Admin | any chore |
| Parent | any chore |
| Child | they're P and someone else logged it, **or** P is another child |
| Child | not when P is a parent or the admin |

- **Only on creation** (after the pending window). Edits and deletes send nothing.
- Text: title "Léa · Vaisselle", body "45 min · aujourd'hui 14:15"; logged for the recipient: "Papa a noté pour toi : Vaisselle · 45 min". Tap → Historique on P's profile.
- Per-device opt-in (Réglages); no per-rule settings.
- No grouping or quiet hours; one `tag` per performer, so the pushes replace one another in the tray.

### Forced install & platforms (Q12)

- **Supported: Android (Chrome) and desktop browsers. iPhone isn't supported** (as in notakid).
- Mobile = `(pointer: coarse)` + narrow screen; installed = `(display-mode: standalone)`. A mobile tab that isn't installed → **blocking install screen**: an "Installer TJM" button from `beforeinstallprompt`, falling back to the text "Menu ⋮ → Installer l'application". No escape hatch. Desktop is exempt.
- Login: Access **One-Time PIN** (a code by email, typed inside the app), session **1 month**.
- From notakid: the manifest with `crossorigin="use-credentials"`, a bypass Access app for `/service-worker.js`, `/manifest.webmanifest`, `/icon-*`.

### Prototype directions (Q13)

- Tone: warm, slightly humorous ("c'est toujours moi qui fais tout"), not childish.
- Themes to compare: **Chaleureux** (cream base, terracotta neutral), **Frais** (light base, deep teal neutral), **Pop** (off-white base, navy neutral, chunky borders + hard shadow).
- 8 personal colours, contrast checked: tomate, mandarine, moutarde, sauge, turquoise, bleuet, lavande, framboise.
- Logo (SVG, also the PWA icon: must read at 48 px and survive a maskable crop), 4 directions: raised hand "Moi !" bubble · sighing sponge with sweat drop · "TJM" monogram with a broom J · finger pointing at itself.
- Prototypes live in `prototypes/` (single HTML files, standalone Vue).

### Prototype status

- [x] `prototypes/01-theme.html` → **Pop** chosen (off-white base `#fdfbf6`, navy `#1d2440` content/neutral, 2px borders + 3px hard shadow, Space Grotesk). Tomate darkened to `#c43a26` for contrast.
- [x] `prototypes/02-screens.html`: every screen, working, with a toolbar for role (admin/parent/child), mobile/desktop, the pending variant (A bottom card · B the tile fills · C top banner) and a simulated notifications log. Desktop: left sidebar instead of the dock; the edit sheet becomes a centred modal.
- [x] `prototypes/03-logo.html` → **monogram T🧹M** chosen: 4 directions (raised hand, sighing sponge, broom monogram, pointing finger) at 192/96/48/24 px, maskable circle crop (art scaled 0.82 into the safe zone), Android home screen, app header, browser tab.
- [x] `prototypes/04-logo-monogram.html` → **G1** chosen: coral `#ff6b6b` background, cream T and M with a hard navy shadow (12 px offset), the **tilted broom as the J, all yellow** `#ffd23f` with a navy outline, two sparkles bottom-left. Letters are shapes, not text, so no font is needed.

### Logo files (`design/logo/`)

- `tjm-logo.svg`: rounded square (rx 112/512), for the header, the desktop sidebar, the install screen and the README.
- `tjm-logo-maskable.svg`: full bleed, art scaled 0.82 into the safe zone → PNG 192/512 `purpose: maskable`.
- `tjm-favicon.svg`: the tilted broom alone on coral, for ≤ 24 px (browser tab).
- `tjm-notification-badge.svg`: white broom silhouette on transparent → PNG 96 for the Web Push `badge`.
- PNG exports (192, 512, maskable 512, badge 96) are generated at implementation time.

### Technical deltas from notakid (Q20)

1. **Every id is a UUID v7** (`TEXT PRIMARY KEY`, time-ordered, so good index locality and natural sorting); a ~10-line `uuidV7()` in `src/lib/uuid.ts` (`crypto.randomUUID()` is only v4). **A chore's id is generated by the browser** when the pending card starts: the server does `INSERT … ON CONFLICT (id) DO NOTHING`, so a retry is idempotent without a separate `client_request_id`. The server checks the format and that an existing id belongs to the same author.
   - **Chore outbox (v1's only local-first piece)**: a chore whose submission fails (network) goes into a `localStorage` outbox, retried on `online`, on the app reopening and on the next quick log. Historique / Rapports / Réglages need the network. A truly local-first app (sync engine) may come later, with proper tooling.
2. **No cron, no wrapper worker** (notakid's ADR 0003 doesn't apply): plain `adapter-cloudflare` output.
3. **Notifications sent during the request** via `platform.context.waitUntil` after the chore commit; no `pending_notifications` table. Failure → logged, not retried (push services keep a push for an offline phone, TTL 24 h). 404/410 → subscription deleted. `push_subscriptions`: one row per device (`id`, `user_id`, `endpoint` UNIQUE, keys, `created_at`).
4. **Identity**: `viewer-resolution.ts` copied from notakid (Access JWT → email) → active `users` row → `locals.viewer = { id, role, name, colourKey }`. Bootstrap (Q1) lives there too. Local dev: `DEV_VIEWER_EMAIL` in `.dev.vars` picks any seeded user (to test the 3 roles).
5. **One central policy module**, `src/lib/server/access-policy.ts`: can view profile, can log for, can edit/delete chore, can manage members/types, Famille visibility. Every load and form action asks it; the UI only hides what it already forbids.
6. Time: UTC ISO strings in D1; Europe/Paris boundaries via `Intl` in `report-periods.ts`; aggregates in SQL in `report-stats.ts`.
7. Kept from notakid: `cf` CLI + `cloudflare.config.ts` with modes, per-viewer rate limit, numbered D1 migrations (always additive), local seed (4 users, ~2 months of chores), CI → deploy on `main`, a manifest with `crossorigin="use-credentials"`, a 1-month Access session, and the **bypass Access app**: a second Access application on `/service-worker.js`, `/manifest.webmanifest` and `/icon-*` with an "Allow everyone" (Bypass) policy, because browsers refuse to register a service worker whose script answers with Access's login redirect. These files hold no data.
8. **Testing from the start**, same layout as notakid:
   - **Unit** (`vitest --project unit`, node, TZ=UTC, `src/**/*.test.ts`): access policy matrix, notification recipients, quarter rounding and derived start, Paris period boundaries (incl. DST changes), duration formatting, `uuidV7`, the pending-chore state machine (fake timers: commit after 5 s, cancel, edit, flush on hide), the outbox retry.
   - **Integration** (`@cloudflare/vitest-plugin`, workerd + local D1 with migrations, `test/**/*.test.ts`, against the built Worker): JWT → viewer (unknown, deactivated, bootstrap), creating a chore (idempotent retry, future refused, 24 h cap, logging for someone), edit/delete per role, `saveWithVersion` writes exactly one version per change in the same batch, report aggregates, member admin guards (last admin), push sending with a fake push endpoint.
   - CI runs lint + check + both projects before deploy. Each change ships with its tests; a bug fix starts with a failing test.
   - Plus the manual browser pass with `agent-browser` (notakid's AGENTS.md rule).

### Data model (D1)

All ids `TEXT` UUID v7; timestamps ISO UTC `TEXT`. Versioned tables (Q7) also have `update_count`, `created_at`, `updated_at`, `deleted_at`, `deleted_by_user_id`.

- `users`: `id`, `email` (UNIQUE, lowercase), `name`, `role` CHECK in (`admin`,`parent`,`child`), `colour_key`, `last_duration_minutes` (home default), + versioned columns. Deactivated = `deleted_at` set.
- `chore_types`: `id`, `type_key` (UNIQUE, English slug), `short_label`, `full_label`, `icon` (emoji), `sort_order`, `archived_at`, + versioned columns.
- `chores`: `id` (client-generated), `chore_type_id`, `duration_minutes` CHECK (multiple of 15, 15–1440), `started_at`, `performer_user_id`, `author_user_id`, `note`, + versioned columns. Index `(performer_user_id, started_at)` and `(started_at)`.
- `record_versions`: see Q7 (its `id` is a UUID too, `record_id` TEXT).
- `push_subscriptions`: see point 3.

### Routes (French URLs, English code)

- `/` Accueil · `/historique` · `/rapports` · `/reglages`; `?profil=<user_id|famille>` on the first three.
- Form actions on the pages (SvelteKit); one JSON endpoint `POST /api/chores` for the pending card and the outbox (sent from JS, idempotent by id).

## Open (to grill, roughly in order)

None. Grilling done; next: split into GitHub issues (`ready-for-agent`).
