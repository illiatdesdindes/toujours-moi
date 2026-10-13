# #8 Rapports: day / week / month / year stats

## Acceptance criteria

- [x] Tabs Jour · Semaine · Mois · Année, ‹ › navigation, "Aujourd'hui", no future: `?periode=&date=` read by `readReportPeriodParams` (missing, wrong or future → this week / today); `›` is a disabled button and "Aujourd'hui" is hidden on the current period. Weeks Monday–Sunday in Europe/Paris; a chore counts in the period of its start (`started_at`), including one that crosses midnight.
- [x] Headline: total, number of chores, change against the previous period ("+1 h 15 vs la semaine précédente", `formatSignedDuration`).
- [x] Over-time bars (Semaine → 7 days, Mois → each day, Année → 12 months, none for Jour), stacked in each person's colour for Famille, the page's primary otherwise (`ReportOverTimeBars.svelte`). Per type sorted by duration with icon, label, ×count, duration, % (`ReportShareBar.svelte`). Per person for Famille only, in their colour. CSS bars, no chart library.
- [x] `src/lib/report-periods.ts` with unit tests incl. DST (`report-periods.test.ts`: 23 h and 25 h days, a week crossing the spring change, buckets with no gap/overlap, labels, params). `src/lib/server/report-stats.ts` SQL aggregates with integration tests (`test/report-stats.test.ts`: person vs Famille, previous period, start-time attribution across midnight and the week boundary, deleted chores excluded, empty period, year buckets, the SSR page, child 403 on another profile and on Famille).
- [x] Browser pass at 390 px and 1280 px: as Papa week (current, `›` disabled), Mois → ‹ to September → switcher to Famille keeps `?periode=mois&date=2026-09-01` (stacked bars, Par personne), Année on desktop, Jour "Hier"; as Léa no switcher, her colour, `?profil=famille` 403. No horizontal scroll. `DEV_VIEWER_EMAIL` put back to Papa.
- [x] `npm run lint && npm run check && npm test` green.

## Decisions

- **The period lives in the URL as `?periode=jour|semaine|mois|annee&date=YYYY-MM-DD`** (any day in the period; the links use its first day), not as the prototype's in-memory offset. Options: an offset (`?decalage=-2`, shifts meaning every day) or a date (stable, shareable, back button works). French params like `?profil=`. Default is Semaine, as the prototype. Switching tab goes back to today, as the prototype resets the offset.
- **Calendar maths on Paris dates, instants only at the boundaries**: periods and buckets are built on `YYYY-MM-DD` strings with `Date.UTC`, and each boundary becomes Paris midnight via the existing `fromParisDateAndTime`. Midnight never falls in a DST gap in Paris, so days are 23 or 25 h naturally. No new time code beyond that.
- **Buckets are aggregated in SQL by joining a `json_each(?)` of `[start, end]` pairs**: one bound parameter for up to 31 buckets (D1 caps bound parameters at 100; a VALUES list would need 93). Options: one query per bucket (31 round trips in a batch) or bucketing in SQL by Paris day (DST maths in SQLite). All four queries go in one `db.batch`.
- **Percent is rounded per row in TS** from the SQL sums, as the prototype; rows may add up to 99–101 %.
- **The comparison copy is the prototype's** ("vs la semaine précédente", "la veille", "le mois précédent", "l'année précédente"); the spec's "vs semaine dernière" is an example, and it reads wrong on a past week. Zero shows "=", as the prototype.
- **The week label drops the first month when both ends share it** ("semaine du 5 au 11 oct.", the spec's example), else names both ("semaine du 28 sept. au 4 oct."). No year in week/day labels; Mois and Année show it.
- **The profile switcher keeps the page's other query params** (`thisPageWithProfile` in `+layout.svelte`), so switching to Famille on Rapports stays on the same period. The dock/sidebar tabs still carry only `?profil=`.
- **`ReportStats` lives in `domain.ts`** so the client component can type its props without importing a `server/` module.
- **Deactivated people and archived types still count** (joins without active filters), as Historique (spec Q2, Q10); deleted chores never do.
- **Two components, not more**: `ReportShareBar` (per type and per person rows) and `ReportOverTimeBars`. The tabs, navigation and headline appear once, so they stay in the page.
- **No migration**: the `(started_at)` and `(performer_user_id, started_at)` indexes from 0002 serve every query.
- **"Par personne" shows for Famille even on an empty period**, with "Rien sur cette période.", like "Par type".

## Deviations from spec

## Skipped review/QA findings
