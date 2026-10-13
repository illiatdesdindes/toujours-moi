# #6 Profile switcher and logging for someone else

## Acceptance criteria

- [x] Header dropdown on Accueil / Historique / Rapports (`ProfileSwitcher.svelte`): parent → themselves + every child + Famille; admin → everyone + Famille; children get their name, no dropdown. Options come from `listProfileOptions` (`src/lib/server/profile-selection.ts`), built on `canViewProfile` / `canViewFamilyProfile`.
- [x] `?profil=<user_id|famille>` kept across the three pages: the dock and sidebar links carry it; Réglages doesn't (no profile there); leaving it out means yourself.
- [x] The page wears the selected person's colour (`--color-primary` / `--color-primary-content` on the layout's root, from `PERSONAL_COLOURS` in `domain.ts`); Famille stays neutral (the theme's navy).
- [x] Home: the selected person is the default performer; "Fait par" (`PerformerField.svelte`) in the details line and the edit sheet for parents and admin, offering whom `canLogFor` allows. Children always log for themselves: no field, and the server still refuses (422, existing test).
- [x] **Integration tests** (`test/profile-switcher.test.ts`): a child gets 403 on another child, a parent, the admin and Famille on all three pages, 200 on themselves; a parent gets 403 on the other parent, 200 on Famille and a child; the admin sees everyone; unknown id → 404; the SSR page carries the selected colour and only grown-ups get the switcher. "A child can't log for someone else" was already covered in `test/chore-logging.test.ts` (422).
- [x] Unit tests (`src/lib/server/profile-selection.test.ts`): options per role, `selectProfile`, default performer, performer options.
- [x] Browser pass, 390 px and 1280 px: as Papa (switcher, Léa → teal page, details "· Léa", pending card "Vaisselle · 45 min · Léa", a `chores` row performed by Léa authored by Papa; Maman → page in raspberry but default performer Papa; Famille → navy; sheet "Fait par" Noé saved as Noé); as Maman (options Maman/Léa/Noé/Famille, Papa → "Tu ne peux pas voir ce profil", Famille OK); as Léa (no switcher, no "Fait par", teal, other profiles and Famille 403). `DEV_VIEWER_EMAIL` put back to Papa.
- [x] `npm run lint && npm run check && npm test` green.

## Decisions

- **A profile the viewer may not see is a 403** ("Tu ne peux pas voir ce profil"), an unknown or deactivated id a 404 ("Profil introuvable"), both through the error page. Options weighed: silently falling back to yourself (hides a wrong link, harder to test). The UI never offers such a link, so only a hand-typed or stale URL lands there.
- **Admin viewing Maman logs as the admin by default**: the spec makes the selected person the default performer, but `canLogFor` (Q3) lets the admin log only for themselves and the children. `defaultPerformerFor` takes the selected person only when the viewer may log for them, else the viewer. Famille → yourself (Q8).
- **The admin's "Fait par" offers themselves + the children**, not everyone as prototype 02's `performerOptions` did: Q3 and the access policy win over the prototype.
- **Switcher = daisyUI dropdown on the native popover API** (`popovertarget`, CSS anchor positioning), each option a link carrying `?profil=`, instead of the prototype's `<select>`: Q8 asks for the coloured dot, which a `<select>` can't show; links navigate without JS; the popover gives light dismiss and Échap. It closes on a pick (`hidePopover()`), since the layout persists across navigations. A browser without anchor positioning shows the list at the popover's default place, still usable.
- **Selected profile resolved by each profile page's load** (`loadSelectedProfile`), not the root layout: Réglages and the error page have no profile, and #7/#8 need `selectedProfile` in their loads anyway. The layout reads it from `page.data` (typed in `App.PageData`).
- **Off the profile pages (Réglages, errors) the app wears the viewer's own colour** (Q10: their colour tints the app when their view is on screen).
- **Self in the switcher is "Papa (moi)"** and selecting it drops `?profil=`; `?profil=<own id>` is accepted and shown as self.
- **Options order**: the viewer, then the others by id (UUID v7 = creation order), then Famille, as the prototype.
- **"Fait par" on the home has a "<name> (par défaut)" first option** (empty override), as the prototype, so the default follows the profile on screen; an explicit pick stays until the chore is committed.
- **The chore label names the performer when it isn't the viewer** ("Vaisselle · 45 min · Léa"), in the pending card (prototype) and so also in the commit toast and the outbox label.
- **`ChoreWhenAndNoteFields` takes a `children` snippet** rendered between Début and Note, so "Fait par" sits where the prototype puts it in both the home and the sheet; the field itself is one `PerformerField` component.
- **`PERSONAL_COLOURS` in `domain.ts`** (hex pairs from prototype 02, Tomate darkened); `PersonColourDot.svelte` for the dot, reusable by #7/#8's Famille rows and charts.
- **Hrefs with a query use `resolve('/historique?profil=…')`**: SvelteKit's `resolve` takes a search string, which keeps `svelte/no-navigation-without-resolve` happy without disabling it.

## Deviations from spec

- None.

## Skipped review/QA findings

- None yet.
