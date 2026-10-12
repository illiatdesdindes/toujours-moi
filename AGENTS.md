## Agent skills

### Issue tracker

Issues live in GitHub Issues for `illiatdesdindes/toujours-moi` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Stacked PRs

When working with stacked PRs, use the `/gh-stack` skill.

## Language

Code, identifiers and docs are in English; the whole UI (labels, text, inputs, errors) is in French. Routes are French URLs (`/historique`), the code behind them English.

## Naming

Name files, functions, types and variables for what happens inside them, in `GLOSSARY.md` terms: `saveWithVersion()`, `report-periods.ts`. When behaviour changes, rename in the same change so the name stays true; renames are cheap.

## UI components

When a piece of UI is a domain thing (the chore type picker, the pending card…), make it a Svelte component in `src/lib/components/` (`ChoreTypePicker.svelte`) and use it everywhere, rather than repeating raw daisyUI/Tailwind classes in routes. Build it from daisyUI classes and the Pop theme tokens (`src/routes/layout.css`), matching `prototypes/02-screens.html`. Fixes to daisyUI's defaults, such as the fixed `btn`/`badge` height that breaks wrapped labels on narrow screens, live inside the component, not in global CSS overrides or one-off patches. Interface icons are inline SVGs in `Icon.svelte`; chore type icons are emoji.

## Tests

`npm run lint && npm run check && npm test` is the local CI. Unit tests (`src/**/*.test.ts`, node, TZ=UTC) cover pure modules in `src/lib/`; integration tests (`test/**/*.test.ts`, workerd + local D1 with every migration) run against the built Worker, so `npm test` builds first. Every change ships with its tests; a bug fix starts with a failing test.

## Browser pass

Before calling UI/UX work done, or any change to forms, navigation or `$app/*` usage, drive the affected screens with `agent-browser` against `npm run dev`, on phone and desktop widths: `npm run db:migrate:local` (and `npm run db:seed:local` once it exists) first, and a `.dev.vars` from `.dev.vars.example`. Server-side integration tests don't run the page's JavaScript.

## Cloudflare CLI - cf - v20260928

`cf` is Cloudflare's current CLI and covers the whole Cloudflare platform. Prefer it over Wrangler: develop with `cf dev`, deploy with `cf deploy`, and manage account resources with `cf <product> …` (for example `cf d1 list`).

`cf` commands differ from Wrangler's; check `cf --help` or `cf cli search <what you want to do>` instead of guessing. If a `cf` command fails, don't fall back to Wrangler (including `npx wrangler`) without offering to report it.

**Ask the user for permission before any `cf` command that creates, updates or deletes something remotely** (deploys, secrets, remote D1 writes or migrations, DNS, Access…). Read-only commands (`list`, `get`, `--help`, `cli search`, `--dry-run`) and `--local` D1 commands are fine. This is production: one wrong command can delete the database.

In this repo: run it as `npx cf …`; config lives in `cloudflare.config.ts`, which refuses to load without a mode: pass `--mode development|test|production` to `cf` (`--env` to wrangler); only `production` points at real resources; D1 commands take the database ID from it, not the binding name. There is no wrapper Worker: the entrypoint is the adapter output `.svelte-kit/cloudflare/_worker.js`, so build first. Wrangler stays only as the bundler behind `npm run preview` and `npm run deploy` (`cf deploy` alone expects `@cloudflare/vite-plugin` output); don't call it directly.
