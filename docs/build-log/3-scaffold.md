# #3 Scaffold: SvelteKit + Pop theme + test harness + CI

## Acceptance criteria

- [x] `npm test` green with at least one unit test (`src/lib/uuid.test.ts`) and one integration test (`test/worker.test.ts`: the four pages against the built Worker, and the migrated local D1). Run locally; CI itself runs once the PR is pushed.
- [x] `npm run dev` shows the shell in the Pop theme on mobile (390 px: header + dock) and desktop (1280 px: sidebar), checked with agent-browser: navigation by dock and sidebar, active tab, Space Grotesk loaded, Pop button border + hard shadow, manifest and icons served.
- [x] SvelteKit 3 + Svelte 5 runes, Tailwind 4, daisyUI 5, `adapter-cloudflare` with no wrapper Worker, `cf` + `cloudflare.config.ts` (modes development/test/production, worker `tjm`, domain `tjm.samyv.com`, D1 binding `DB`).
- [x] Pop daisyUI theme (`src/routes/layout.css`), Google Fonts Space Grotesk + Noto Color Emoji.
- [x] App shell, `Icon.svelte`, empty French pages `/`, `/historique`, `/rapports`, `/reglages`.
- [x] Logo → favicon, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-badge-96.png`; `manifest.webmanifest` linked with `crossorigin="use-credentials"`.
- [x] `uuidV7()` + unit test.
- [x] vitest projects unit and integration, as in notakid.
- [x] CI: lint + check + tests on PRs; on `main`, D1 migrations then deploy (see Decisions: it can't succeed before #12).
- [x] AGENTS.md: cf, UI component, naming, tests and browser-pass rules.

## Decisions

- **Versions and config copied from notakid** (`package.json` devDependencies, `vite.config.ts`, `eslint.config.js`, `prettier.config.js`, `tsconfig.json`, `wrangler.config.ts`, `mise.toml`, `ci.yml`). Dropped what TJM doesn't need yet: the wrapper Worker, cron triggers, Access/VAPID/token env, rate limit and `@block65/webcrypto-web-push` arrive with #4 and #10.
- **Entrypoint = `.svelte-kit/cloudflare/_worker.js`** in `cloudflare.config.ts` and in the integration project's `main`; the test imports it with an ambient declaration (`test/sveltekit-worker.d.ts`, separate from `test/env.d.ts` because a file with imports can't declare a wildcard module). `npm run deploy` keeps notakid's `wrangler build --x-new-config … && cf deploy --prebuilt`, since `cf deploy` alone expects `@cloudflare/vite-plugin` output.
- **Production D1 ID doesn't exist yet** (#12 creates it). Options: a fake ID, a repo-variable guard on the deploy job, or failing loudly. Picked failing loudly in config plus a repo-variable guard in CI (review): `cloudflare.config.ts` throws in `production` mode with a "#12" message, and the `ci.yml` deploy job only runs when the repo variable `D1_PRODUCTION_ID` is set. So main stays green while #3–#11 merge, the deploy job is skipped until #12 sets the variable and the ID in the config, and nothing can reach a wrong database.
- **No migration in #3**: the tables belong to #4 (`users`, `record_versions`) and later tickets. `migrations/.gitkeep` keeps the directory for `readD1Migrations`; the integration test checks `d1_migrations` exists, which proves the harness applies migrations to the local D1. `npm run db:migrate:local` is in place (no seed script yet: #4 adds `db:seed:local`).
- **`.dev.vars.example`** holds only the header comment for now; #4 adds `DEV_VIEWER_EMAIL`.
- **Primary colour = neutral navy** in the theme: Q10 tints `--color-primary` with the viewed person's colour, and with no profile yet the prototype's `NEUTRAL_COLOUR` applies. The browser `theme-color` meta is the coral of the manifest.
- **Pop button border/shadow are unlayered CSS** in `layout.css`, as in the prototype: inside `@layer components` daisyUI's own `.btn` shadow won. They are the theme, not a one-off daisyUI fix, so they live with the theme rather than in a component.
- **Desktop breakpoint `md` (48 rem)** = the prototype's `@3xl` container query, applied to the viewport.
- **Dock and sidebar icons**: Heroicons outline home / clock / chart-bar / cog-6-tooth (keys `home`, `clock`, `chart-bar`, `cog`: named for the glyph, not the tab; prop `glyph`, type `IconGlyph`) (stroke 2 for the chunky look) in place of the prototype's emoji, because the spec makes interface icons inline SVGs. Dock shows icon + label like the prototype. Only the four shell icons are in `Icon.svelte`; −/+/✕ come with the screens that use them.
- **Header**: the logo (`tjm-logo.svg`, per the spec's logo files) + "TJM" on mobile, the page title as the single `h1` on desktop (screen-reader only on mobile). The viewer name / profile switcher slot is left for #4/#6.
- **Current tab matched on `page.route.id`**, not on the href: `resolve()` returns relative hrefs during SSR.
- **PNG icons rendered with headless Chrome** (`--headless=new --screenshot` of each SVG at its size, transparent background). ImageMagick's internal SVG renderer drew the logo wrong. One-off; no script committed, since the logo is final.
- **Empty pages** each show one muted French line (the prototype's empty-state copy where it has one: "Aucune tâche pour l'instant.", "Rien sur cette période.").
- `robots.txt` disallows everything (private family app, as in notakid).
- `npm install` warns that `esbuild` and `workerd` install scripts aren't approved (npm 11 `allowScripts`); build and workerd tests run fine without them, so nothing was approved.

- **No `pop-edge` utility yet** (review): deleted because nothing uses it. The first card or tile adds it back, copied from the prototype's `.pop-edge`.

## Deviations from spec

- **Light only (Q10).** Q10 says light/dark follows the system, but neither prototype defines a dark Pop (both set `color-scheme: light`), so the theme is light only. Open until someone designs a dark Pop; then add it as a second daisyUI theme with `prefersdark: true`.

## Skipped review/QA findings

- **`.btn` unlayered overrides in `layout.css`** (review, minor): kept. They are the Pop theme's button look, the same as the prototype's, and apply to every button. They are not a fix for one component. Moving them into a `Button` component would leave every raw daisyUI `.btn` (the sidebar tabs, future dialogs) off-theme.
- **Sidebar and dock loops duplicated** (review, minor): kept. The two loops render different markup (`btn` links versus `dock` items) and share only the `tab === currentTab` test, in the one layout that will ever have navigation. A component would add a file for a single use. Extract it if a second layout appears.
- **"`npm test` green in CI" not shown in the branch** (review, minor): can't be checked from a local run. The full local CI (`npm run lint && npm run check && npm test`) passes. The orchestrator checks the PR's CI run before closing #3.
