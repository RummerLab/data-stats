# AGENTS.md — Physioshark Data Stats

> **Living document.** Future AI agents (and humans) should read this before changing the repo, and **update it** when they learn something new, correct a mistake, or retire outdated guidance. Prefer short, actionable notes over essays. Remove stale info rather than commenting it out.

Web app for **http://data.physioshark.org/**: thirteen seasons (2013-14 → 2025-26) of Mo'orea shark-nursery surveys from the [Physioshark project](https://physioshark.org/) (Dr Jodie Rummer, RummerLab / JCU, with CRIOBE), joined with weather, ocean, tide, climate and sun/moon data to surface interesting, quirky, fun and informative findings.

---

## Golden rules

1. **Never edit the data spreadsheets.** The `.xlsx` workbooks in `data/` are the source of truth. The app only reads them (`readFileSync`, never a write handle). Problems in the sheets go on the Data quality page (`IssueLog`) and into GitHub issues for the lab to fix at the source. Don't "fix" a sheet, don't write a cleaned copy back, don't add helper columns.
2. **Never commit or bake the spreadsheets into the image.** This repo is **public** and the data is unpublished. `data/`, `*.xlsx` (except `samples/fixture/`), `cache/` and `*.sqlite` are gitignored and dockerignored. The container mounts the folder read-only at `/data`. Never paste real records into issues, tests or fixtures; use `scripts/make-fixture.mjs` (synthetic values only).
3. **The SQLite database is a disposable cache.** It is rebuilt whenever the fingerprint of `DATA_DIR` + `external/` + bundled schema SQL + `IMPORTER_VERSION` changes. There is no migration path to protect: edit `src/lib/server/db/schema.ts`, run `pnpm db:generate`, and the next start rebuilds. **Bump `IMPORTER_VERSION` in `src/lib/server/import/index.ts` whenever import logic changes** so deployed caches rebuild.
4. **Show everything** (owner decision, 2026-11): crew names and free-text field notes are public on the site.
5. **Correlation ≠ cause.** Analyses are exploratory. Page copy must not assert a finding the data doesn't show; check the numbers before writing a claim (several first-draft claims were wrong: wind direction, tide state of sets). Findings are computed live (`analytics/findings.ts`), never hard-coded numbers.

## Stack & tooling

| Piece           | Choice                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------- |
| App             | SvelteKit 3 + Svelte 5 runes (`$props`, `$state`, `$derived`), adapter-node                    |
| CSS             | Theme tokens in `src/app.css` (light/dark), Tailwind 4 available; Inter (bundled)              |
| DB              | SQLite (better-sqlite3) + Drizzle ORM; schema → `drizzle/*.sql` bundled via `import.meta.glob` |
| xlsx            | Own reader (`src/lib/server/import/xlsx.ts`, fflate unzip). No SheetJS/exceljs.                |
| Charts          | Own SSR SVG components (`src/lib/components/charts/`), no chart library                        |
| Package manager | **pnpm** pinned via `package.json#packageManager` (config in `pnpm-workspace.yaml`)            |
| Node            | 26 (CI, Docker, `.nvmrc`, `engines`)                                                           |
| Deploy          | Docker multi-arch → `ghcr.io/rummerlab/data-stats`, distroless non-root runner                 |

Import alias: `#lib/...` → `src/lib/...`. The footer shows `__APP_VERSION__` (package.json version, injected by `define` in `vite.config.ts`); release workflows bump it before tagging, so it matches the GitHub release. Env vars are declared in `src/env.ts`; server code reads `process.env` (Docker/runtime).

## Repository map

```
src/lib/server/import/   xlsx.ts (reader) · normalize.ts (cell parsers) · columns.ts (header aliases)
                         logs.ts (shark + set logs) · extras.ts (lab, WQ, HOBO, blood, mouth, prey…)
                         reference.ts (GPS, pressure ranking, adult datasheet) · sites.ts · crew.ts
                         external.ts (CSV snapshots) · issues.ts (data-quality log)
                         loggers.ts (HOBO/EnvLogger CSVs, register) · insitu.ts (site, hourly/daily/diel)
                         index.ts (orchestrator: link sets, individuals, env joins, write DB)
src/lib/server/db/       schema.ts (Drizzle) · index.ts (fingerprint, rebuild, atomic swap)
src/lib/server/data.ts   loads the whole dataset into memory per import; memo() caches analyses
src/lib/server/analytics common.ts (CPUE, Fulton's K, recapture pairs…) · env.ts (per-set variables)
                         findings.ts (live findings) · insitu.ts (logger temperature summaries)
                         population.ts (Schnabel abundance, von Bertalanffy growth)
src/lib/server/astro.ts  sunset/twilight/moon (local formulas) · tides.ts (extrema, interpolation)
src/lib/server/holidays.ts French Polynesia public holidays (Easter-based too) + festive window
src/lib/stats.ts         regression, Spearman, Welch, Wilson, binomial, histograms, box stats
src/lib/components/      ChartCard, StatTile, DataTable, FindingCard, MooreaMap (SSR SVG),
                         InteractiveMap (Leaflet, lazy; MooreaMap is its fallback), charts/*
src/routes/              one folder per page (+page.server.ts computes, +page.svelte renders)
scripts/                 fetch-external.mjs · make-fixture.mjs · server.mjs · nightlyRelease.mjs
external/                public environmental snapshots (committed)
samples/fixture/         synthetic workbooks for tests/CI (committed)
```

## Importer notes (learned the hard way)

- Sheet layouts differ every season. Columns are matched by **normalised header aliases** (`headerKey`), never position. Add aliases rather than special-casing a season.
- **Units:** lengths are stored in mm. 2013-15 logs are cm despite "mm" headers; 2021-22 `Cm Log`/`Na Log` are cm; adults are cm. `harmoniseUnits()` decides per sheet from medians and logs every conversion.
- **Dates** a year outside their season (e.g. `2014-01-11` in 2014-15) are corrected by `fixSeasonYear` and logged. Seasons run Aug–Jul.
- 2013-14 `Shark log physioshark` / `Set Log physioshark` duplicate `Catch data` / `Set Log` and are skipped (#9). 2013-14 recaptures are grouped in its `Recaptures` sheet; 2014-15 `Recaptures` holds extra catches; 2015-16 stores recaptures as horizontal column blocks (`1st Recap Site`…).
- 2016-17 `Shark Log` has a date _value_ as its date header; 2021-22 `Set Log` has a garbled date header (`16(`). Both are handled.
- Species codes: `Cm` blacktip, `Na` sicklefin lemon, `Nf` tawny nurse shark. 2024-25 writes the nurse shark as `GF` / `Gf1` (`GF Log Juv`), probably from _Ginglymostoma_, the Atlantic nurse shark genus; it is read as `Nf` (confirmed by Jodie Rummer, #12).
- Individuals: union-find over tags (PIT 15-digit, `COFA 12345`, re-tags) plus recapture groups. Conflicting sex/species/shrinking length is logged, not fixed.
- Captures link to sets by season + set number (±1 day), then date + site, then a unique set that date.
- CPUE = max(set-log count, linked captures) / net-hours. 2013-14 has no set times (no CPUE).
- Sites → `sites.ts` regexes (review in #13). Crew → `crew.ts` aliases plus accent/case merging in the orchestrator (#14).
- Moorea is **UTC−10, no DST**. Times are minutes after local midnight; captures before 06:00 belong to the previous evening.
- On Windows the DB swap can fail while another handle has the file open; `db/index.ts` then serves the freshly built file and retries later. The connection lives on `globalThis` so dev hot-reloads close it.

### Temperature loggers (#10)

- Any `.csv` under `DATA_DIR` is a candidate logger export (they are in the fingerprint too). HOBO exports come in English and French, comma or tab, UTF-8 or Mac Roman; dates are always month-first. EnvLogger exports carry serial, custom name, time zone (UTC-1000 early, UTC+0000 later) and the phone's GPS at download (early files drop the minus signs). EnvLogger app logs (`time, action…`) and empty downloads are skipped.
- HOBO clocks are Moorea local time even when the header says GMT+10:00 (their daily cycle lines up with the other loggers), so the label is ignored. Don't judge clocks by the light channel: shading moves its peak (HOBO 7 and 11 peak at 17:00 and 07:00 with correct clocks).
- Every download is cross-checked hour by hour against the loggers at the _other_ nurseries (`compareSeries`; not its own site, where one bad logger would drag down its partner). r < 0.5 → left out (`logger_files.excluded`, e.g. a logger out of the water); best alignment shifted ≥ 3 h → clock warning. Shifts of 1–2 h are normal between nurseries.
- Site: EnvLogger by download GPS (≤ 400 m from a nursery), then custom name, file-name prefix (`PIAENA_2_…`), then the register workbook (detected by its `Serial number` + `Custom name` header, checked before the `/gps|location/` file-name rule). HOBO by the file-name suffix (`…_Intercontinental`), then the season workbooks' HOBO log (logger number + date overlap). A name/GPS disagreement is a warning on the Data quality page.
- Cleaning: trim 2 h at the start of each file and 2 h (EnvLogger) or 24 h (HOBO, read out back at the station) at the end; drop readings outside 15–40 °C; merge repeated downloads of one logger by timestamp. Days need ≥ 18 site-hours. Tables: `logger_files`, `logger_daily`, `logger_diel`, plus `sets.insitu_temp`.
- Comparisons between nurseries only use those logged ≥ 1 year with both seasons covered (a summer-only logger looks hottest).

### Adding a new season

Drop the workbook in `data/` named like `Physioshark_Shark Log 2026-2027.xlsx` (the `YYYY-YYYY` in the file name sets the season). Check the Data quality page for unknown sites, unmatched headers ("Sheet not imported") and unit warnings, and extend aliases if needed. Never rename columns in the workbook to make the importer happy.

## Charts & design

- Follow the dataviz method: categorical slots in fixed order (`--series-1…8`, validated light and dark), sequential = one hue (`--seq-*`), diverging = blue ↔ red with a neutral midpoint, one y-axis only (never dual axes), legends for ≥ 2 series, text in ink tokens (never the series colour), 4 px rounded bar ends, 2 px lines, hover tooltips, data tables via `ChartCard table`.
- Every chart registers its data with the enclosing `ChartCard` (`registerCsv` in `charts/csv.ts`), which shows **Download CSV**. A new chart component must call `registerCsv` too. An explicit `ChartCard table` takes precedence.
- Species colours come from `src/lib/species.ts` (blacktip = slot 1, sicklefin lemon = slot 2).
- Charts measure their width (`bind:clientWidth`) and carry a `viewBox` so pre-hydration renders scale down instead of overflowing.
- Interactive marks (links) inside an SVG → the SVG gets `role="group"`, not `img` (axe `nested-interactive`). Only put `aria-label` on elements that are links.
- Style guide: `docs/dev/BRANDING.md`.

## Docker / release

- `docker-compose.yml` (local build) and `docker-compose.ghcr.yml` (published image). Both mount `${DATA_PATH:-./data}:/data:ro` and a `cache` volume at `/cache`.
- `docker-release.yml`: builds linux/amd64 + arm64 and pushes on `v*` tag pushes, manual dispatch or `workflow_call`. Image name is lower-cased from the repo (`rummerlab/data-stats`).
- `nightly-minor-deps-release.yml`: `npm-check-updates --target semver --cooldown 3`, full suite, then a patch release + image **only when a package that reaches the image moved** (tooling list in `scripts/nightlyRelease.mjs`; add new lint/test devDependencies there). It pushes to `main`, so branch protection needs a bypass for Actions.
- `refresh-external.yml`: weekly `fetch-external.mjs`; when `external/` changed it commits, tags a patch release and publishes the image.
- Dependabot covers GitHub Actions only: its pnpm runs on Node < 26 and `engineStrict` fails every npm job. npm majors are upgraded by hand.
- `ci.yml`: lint + check + unit tests, build + Playwright/axe, and a Docker build + smoke test (synthetic fixture) on both architectures.
- Runner is distroless `cc-debian13:nonroot` (uid 65532) with the build stage's Node binary: no shell. Debug with `node -e`.

## Commands

```bash
pnpm install
pnpm dev                     # DATA_DIR=samples/fixture pnpm dev without real data
pnpm check                   # svelte-check
pnpm lint                    # Prettier --check + ESLint (pnpm format to fix)
pnpm test                    # Vitest (synthetic fixture, in-memory DB)
pnpm build && pnpm test:e2e  # Playwright + axe against the production build
pnpm db:generate             # after editing schema.ts
pnpm external                # refresh environmental snapshots
pnpm fixture                 # regenerate synthetic workbooks
pnpm social-preview          # re-render static/og-image.png + docs/social-preview.png (Playwright)
REAL_DATA_DIR=data pnpm vitest run src/lib/server/import/realData.test.ts   # opt-in real-data summary
```

### Before push / finishing a PR (required for agents)

| Change                              | Local checks                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| Docs only                           | `pnpm lint`                                                          |
| Page copy / styling                 | `pnpm lint`, `pnpm check`                                            |
| Analytics / importer logic          | + `pnpm test` and the opt-in real-data test; bump `IMPORTER_VERSION` |
| New page, shared components, tokens | + `pnpm build`, `pnpm test:e2e` (add the route to `NAV`)             |
| Docker, workflows, dependencies     | everything above + `docker build .` and a container smoke run        |

## What not to do

- Don't edit, rename, re-save or "clean" the spreadsheets. Don't commit them, fixtures derived from them, or SQLite caches.
- Don't add a chart library or third-party scripts/fonts without updating the CSP in `vite.config.ts` and this file. Map tiles (Esri World Imagery, OpenStreetMap) are the only allowed external images (`img-src`); a new tile host needs the CSP, the e2e tile stub in `e2e/pages.spec.ts` and the attribution.
- Don't hard-code numbers in page copy; compute them in the load function.
- Don't claim causation from the correlations; don't overstate the human-pressure results (the source paper found no significant effect).
- Don't reintroduce dual-axis charts or per-point value labels.

## File issues for what you find

Don't silently fix unrelated things and don't let them go unrecorded: **file a GitHub issue**. Search first (`gh issue list --state all --search "<keywords>"`), one issue per problem, title `Area: short summary`, body with what/why/acceptance. Labels: `data`, `analytics`, `environment`, `design`, `docker`, `infrastructure`, `data-quality`, `findings`, `question`, `accessibility`, `documentation`, `enhancement`, `bug`. Epics: #68 importer · #69 environment · #70 design · #71 biology · #72 environment/fieldwork analyses · #73 findings · #74 infra · #75 data quality. Never put real records in an issue.

## Changelog for agents

| When    | Note                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11 | v0.1.0: importer for all 13 seasons + adults + GPS + pressure ranking; external snapshots; 25 pages / 130+ charts; Docker, CI, release workflows; issues #1–#75.                                                                                       |
| 2026-11 | v0.2.0: Physioshark logo/icon, footer version, OG image, CSV download on every chart, histogram overlay, busy-day (holiday) analysis, season rewind; unreadable DATA_DIR no longer fatal.                                                              |
| 2026-11 | v0.2.1: interactive Leaflet map (satellite/street tiles); in-situ temperature loggers (#10: HOBO + EnvLogger CSVs, cross-checked between nurseries) with water-quality and nursery charts, set variable, finding; logger data-quality issues #95–#100. |
