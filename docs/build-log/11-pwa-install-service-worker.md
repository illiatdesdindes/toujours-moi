# #11 Forced PWA install on mobile + service worker

## Acceptance criteria

The ticket has no "Done when" list; its "What" items are the criteria.

- [x] Service worker (app shell cache, like notakid's): `src/service-worker/index.ts`, notakid's file minus push. SvelteKit builds and registers it (`/service-worker.js`); checked in the browser: registered, activated, `shell-<version>` cache filled, and `/` reloads offline from the pages cache.
- [x] Mobile (`pointer: coarse` + narrow) and not `display-mode: standalone` → the blocking install screen of prototype 02 ("Installe TJM", same copy), with "Installer TJM" from `beforeinstallprompt` and the fallback "Pas de bouton ? Menu ⋮ du navigateur → Installer l'application". No escape hatch. Desktop exempt.
- [x] Tests: unit `install-prompt.test.ts` (prompt kept and default prevented, unavailable without one, accepted / dismissed once then gone, `appinstalled` drops it, stop listening); integration `test/pwa-install.test.ts` (every page registers the service worker and has the install screen, the app behind the same gate).
- [x] Browser pass (`npm run dev`): 390 px without touch → the app; 390 px and 360 px with touch emulation (CDP `Emulation.setTouchEmulationEnabled`) → only the install screen; a synthetic `beforeinstallprompt` shows the button, a tap prompts once and the button goes, no horizontal scroll; 800 px with touch (tablet) and 1280 px desktop → the app. `DEV_VIEWER_EMAIL` unchanged (Papa).
- [x] `npm run lint && npm run check && npm test` green.

## Decisions

- **The gate is CSS, not JS**: one `@custom-variant install-gate` in `layout.css` (`(pointer: coarse) and ((width < 48rem) or (height < 48rem)) and (not (display-mode: standalone))`); the install screen is `hidden install-gate:flex`, the app `install-gate:hidden`. Options were a `matchMedia` store in the layout (flashes the app before hydration, needs change listeners) or CSS (right from the first paint, no code). The JS is only the button.
- **"Narrow" = a short side below `md` (48rem)**, where the dock gives way to the sidebar: a touch tablet (both sides `md` and up) gets the desktop layout, so it's exempt like desktop. Testing the short side (width or height), not the width alone, keeps a phone turned to landscape (Pixel 7: 915 × 412) gated (review finding). Known limit: Chrome's "Site pour ordinateur" in portrait widens the viewport to about 980 px and stretches its height with it, so neither side is under 48rem and the gate lets it through. Options were device-width queries (deprecated), `(hover: none)` alone (gates tablets too, against "narrow screen"), or JS on `screen.width` (back to the flash-before-hydration problem). Kept CSS: it's a deliberate user action, and the spec's "no escape hatch" is about the app offering none.
- **The install screen sits outside the app wrapper**, in its own `contents` wrapper that sets the viewer's colour (QA finding: prototype 02 puts the viewer's colour on the frame, and in navy the Pop button's navy edge and shadow vanish). The viewer's, not the selected profile's: the gate shows on any URL and Famille would fall back to navy. The whole app, dock and toast included, is hidden behind the gate (`display: none` also takes it out of the accessibility tree).
- **Logo, not the prototype's "TJM" box**: spec "Logo files" says `tjm-logo.svg` is for the install screen (`#lib/assets/logo.svg`, with `pop-edge`).
- **After the prompt** (accepted or dismissed) the button goes, since Chrome shows a prompt once, and the fallback text remains until Chrome fires a new `beforeinstallprompt`. The first version replaced the button with a "C'est installé !" line; review flagged it as UI copy that isn't in the prototype or spec, so it was removed: the screen is prototype 02's, and Chrome itself confirms the install with its own "Ouvrir" notice.
- **The listener starts in `onMount`**, not an inline script in `app.html`: Chrome fires `beforeinstallprompt` only once the service worker is registered, which SvelteKit does on `load`, after hydration. If it ever came earlier, the fallback text covers it.
- **The pages cache is kept from notakid** (network first, last 200 copy offline, navigations and `__data.json`): it's what lets the home open offline so the chore outbox (spec Q20 point 1) is usable. Historique / Rapports / Réglages may show a stale copy offline; their writes already say "Pas de réseau".
- **Push and `notificationclick` are left to #10** (notifications); the file says so.
- **Service worker typing as notakid**: its own `tsconfig.json` (`$app/tsconfig/service-worker`), excluded from the root one, checked by `tsc -p src/service-worker --noEmit` added to `npm run check`.
- **No test that `/service-worker.js` is served without an Access JWT**: in the test Worker `ASSETS` is unbound (static files are Cloudflare's asset layer, before our hooks), and the bypass Access app is #12's. The integration test checks the page registers it; the build emits it.
- **Touch emulation for the browser pass via CDP** (a small script against `agent-browser get cdp-url`): `agent-browser set device` doesn't make `pointer: coarse` match.

## Deviations from spec

None.

## Review findings applied

- `InstallScreen.svelte`: callback argument `prompt` → `canPromptNow` (it read as the deferred prompt event and shadowed `window.prompt`).
- `service-worker/index.ts`: `SHELL` / `PAGES` → `SHELL_CACHE_NAME` / `PAGES_CACHE_NAME`. This moves away from notakid's word-for-word file; the naming rule wins over sameness with the source, and the logic is unchanged.
- `install-prompt.ts`: shared `InstallPromptChoice` (`'accepted' | 'dismissed'`), with `InstallPromptOutcome = InstallPromptChoice | 'unavailable'`, used by the event type and the test helper.
- `install-prompt.ts`: `keepPrompt` / `dropPrompt` → `keepDeferredInstallPrompt` / `dropDeferredInstallPrompt`.
- `layout.css`: the gate tests the short side, so a landscape phone stays gated (see Decisions; "Site pour ordinateur" recorded as a known limit).
- `InstallScreen.svelte`: the "C'est installé !" line removed (see Decisions).

## QA findings applied

- Major: the "Installer TJM" button was navy (theme primary) with an invisible Pop edge. `+layout.svelte` now wraps `<InstallScreen />` in a `display: contents` div carrying the viewer's `--color-primary` / `--color-primary-content` (see Decisions).

## Skipped review/QA findings

None.
