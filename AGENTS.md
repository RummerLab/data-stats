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
                         diet.ts (gastric lavage: fullness, prey groups)
                         events.ts (cyclones and heavy-rain days vs catches)
                         glm.ts (NB/Poisson GLM, splines) · catchModel.ts (joint catch model)
                         glmm.ts (binomial mixed model, crossed random intercepts) · sex.ts
                         survival.ts (Cormack–Jolly–Seber apparent survival, BFGS)
                         tests.ts (the statistic behind each chart, worded for ChartCard stats)
src/lib/server/astro.ts  sunset/twilight/moon (local formulas) · tides.ts (extrema, interpolation)
src/lib/server/holidays.ts French Polynesia public holidays (Easter-based too), festive window,
                         school holidays (schoolDays) and the one-label-per-date dayType
src/lib/stats.ts         regression, Spearman, Welch, Wilson, binomial, histograms, box stats
src/lib/components/      ChartCard, StatTile, DataTable, FindingCard, MooreaMap (SSR SVG),
                         InteractiveMap (Leaflet, lazy; MooreaMap is its fallback), charts/*
                         (ForestPlot: rate ratios with intervals on a log scale)
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
- Diet (#40): `Lavage (y/n)` / `Gastic lavage` → `captures.lavage`; `Lavage (full/empty)` / `Stomach content` → `stomach` (full | traces | empty; "no sample" is null); `Lavage (contents)` / `Stomach sample type` / 2013-14 `State of Stomach` → `stomach_contents` free text. A fullness cell that isn't a fullness word (e.g. "worm found") becomes contents. Analyses in `analytics/diet.ts` (fed = full or traces).
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
- Month × hour calendars (#127, `analytics/thermalCalendar.ts`) read `logger_diel`, whose `n` is contributing days (one nursery-wide hourly mean per day), not sensor samples. Cells need ≥ 10 days. Every nursery shares one colour domain taken from the supported cells, in whole degrees (24–33 °C with the current loggers): the 15–40 °C cleaning window squeezed the lagoon into two colour steps. Pooled means can't show peaks or hours above a threshold.

### Cloud cover (#104)

- ERA5 `cloud_evening` covers every set; the crew's 1–4 `cloud_cover` score exists only in 2020–22 and tracks ERA5 (score 1 ≈ 43%, 4 ≈ 94%). `moonlight()` in `analytics/cloud.ts` = illumination × sin(moon altitude) × clear-sky fraction.
- Cloud vs water temperature must be compared within the same month: the cloudy wet season is also the warmest, so raw correlations are ~0 while within-month ones are strongly negative.

### Cyclones and heavy rain (#24)

- `fetch-external.mjs --only=cyclones` downloads the IBTrACS South Pacific CSV (~36 MB) and keeps track points within 750 km of Moorea since 2013 (`external/cyclones.csv`, `cyclone_points` table). Analyses use 500 km.
- Heavy-rain day = top 1% of ERA5 daily precipitation (the grid cell under-reads mountain rain).
- After-event catches are compared with other sets in the same season and month (observed / expected, bootstrap interval), never with all sets: storms and downpours cluster in the wet season.

### Chlorophyll-a (#23)

- `fetch-external.mjs --only=chlorophyll` reads NOAA S-NPP VIIRS science-quality weekly chlorophyll (`noaacwNPPVIIRSSQchlaWeekly` on coastwatch.noaa.gov ERDDAP; the pfeg copy only redirects there) for a box around Moorea and writes one median per week (`external/chlorophyll-weekly.csv`, `chlorophyll_weekly` table, `sets.chl` for the week holding the set date).
- The median covers an offshore ring: pixels within 30 km of Moorea's centre and ≥ 10 km from any pixel with no value in more than half the weeks (land and coast, Tahiti's included). Coastal pixels read tens of times the open ocean (land in the pixel, lagoon floor, haze), and some get a value often enough that "never valid" misses them. The job throws if the ring shrinks below 40 pixels.
- Science-quality weeks lag by about six weeks. It is the ocean around the island, not lagoon water; don't describe it as conditions in the nurseries.

### Catch model (#54)

- `analytics/catchModel.ts`: negative-binomial counts per timed gillnet set, offset log(net-hours), natural-spline day of season (knots at the 0/25/50/75/100% quantiles), nursery and season as effect-coded fixed effects (each level vs the average; no random effects), and nine environment terms per +1 SD. Complete cases only; nurseries need ≥ 30 complete sets, and a species gets a nursery effect only where ≥ 10 of it were caught (otherwise the estimate runs off to zero or infinity).
- The headline: sea temperature's raw link with catch rate (≈ −25% per °C) vanishes once day of the season is in the model. Don't describe SST as a driver of catches on other pages.
- `glm.ts` is generic (IRLS + ML θ, Wald intervals via `contrast`); reuse it rather than writing another fitter.

### Sex ratio mixed model (#117)

- `analytics/sex.ts`: female (1) vs male (0) per individual, counted once at its first capture, with the nursery and season of that capture as crossed random intercepts (`glmm.ts`: Laplace approximation, PIRLS as lme4's nAGQ = 0, SDs by Nelder–Mead). Tests fix one SD at 0 and halve the χ²₁ p (boundary).
- Reuse `fitBinomialGlmm` for any yes/no outcome with grouping (fed or empty, recaptured or not) instead of pooling groups; there is no R in CI, so validate new uses against simulated data as `glmm.test.ts` does.

### Apparent survival (#42)

- `analytics/survival.ts`: Cormack–Jolly–Seber per species on 14-day blocks of the season. One history per pup, nursery and season, starting at its first capture there, so pups born later don't bias it. φ is shared, or one per nursery for the nursery test. Capture probability is cloglog(aₙ + β·log net-hours) for that fortnight, with an intercept per nursery and p = 0 in fortnights with no set. Untimed sets count as a typical set, and a catch in a fortnight with no set on record counts as one.
- φ is apparent: death and leaving look the same, and moving to another nursery counts as leaving. Nurseries need ≥ 10 pups seen again in a later fortnight of the same season. The transience model gives the first fortnight after tagging its own φ.
- `fitCjs` is generic and validated on simulated histories in `survival.test.ts`. Reuse it rather than writing another fitter. Wald intervals are on the logit scale and are null at the boundary (φ ≈ 1).

### Scar transitions (#126)

- `analytics/scarTransitions.ts` pairs consecutive field captures of one shark within a season that both have a scar stage. Unknown stages are skipped. These pairs are left out: identity conflicts, a capture sharing its day with another, pairs spanning two seasons and pairs with a lab stay in between. Backward transitions stay visible and are counted for the lab.
- The days are time between captures, not healing time or age. A transition gets a box only from five pairs (`MIN_BOX_PAIRS`). Labels match the rest of /neonates: open, healing, healed.

### School holidays (#25)

- `fetch-external.mjs --only=school` writes `external/school-holidays.csv` (first and last day off, local dates). 2013-14 to 2016-17 are transcribed in the script from the Polynesian government's calendar orders for collèges and lycées (arrêtés 0270/CM 2013, 0399, 0401 and 0403/CM 2014), archived from education.pf by the Wayback Machine; the national dataset only starts in 2017-18. From 2017-18 it is the Ministry's `fr-en-calendrier-scolaire` open data (Polynésie, Licence Ouverte 2.0, credit it): pupils only, a day counts when either level is off, `end_date` is the day classes resume.
- The national data has slips (the 2023 November break "starts" on 28 September): fix them in `SCHOOL_ERRATA`. The job throws if breaks overlap, so a new typo fails the weekly refresh instead of reaching the site.
- `dayType` precedence: public holiday > festive window > school holidays > weekend. The pressure page also compares school-holiday weekdays with term-time weekdays, which keeps weekends out of the contrast.

### Adding a new season

Drop the workbook in `data/` named like `Physioshark_Shark Log 2026-2027.xlsx` (the `YYYY-YYYY` in the file name sets the season). Check the Data quality page for unknown sites, unmatched headers ("Sheet not imported") and unit warnings, and extend aliases if needed. Never rename columns in the workbook to make the importer happy.

## Charts & design

- Follow the dataviz method: categorical slots in fixed order (`--series-1…8`, validated light and dark), sequential = one hue (`--seq-*`), diverging = blue ↔ red with a neutral midpoint, one y-axis only (never dual axes), legends for ≥ 2 series, text in ink tokens (never the series colour), 4 px rounded bar ends, 2 px lines, hover tooltips, data tables via `ChartCard table`.
- Every chart registers its data with the enclosing `ChartCard` (`registerCsv` in `charts/csv.ts`), which shows **Download CSV**. A new chart component must call `registerCsv` too. An explicit `ChartCard table` takes precedence.
- Back every trend, relationship or group difference with a test (#119): compute it in the load function with `analytics/tests.ts` and pass the sentence to `ChartCard stats`. Catch rates: `rateTest`/`rateText` (negative-binomial LRT with log net-hours offset, raw and adjusted for nursery, season and day of the season; pass `skip` for the factor under test). Values across groups: `groupsText` (Kruskal–Wallis). Shares: `tableText` (χ²). One value per season: `trendText`. Scatters: `fitText` (R², p, Spearman) or `rankText`. Copy and findings that name a "best" or "highest" group must check the test first (the moon finding picked the best of eight phases, #118).
- Cite the study behind a chart with `<ChartCard papers={['debaere2024lunar']}>` (ids in `src/lib/publications.ts`). Link only papers that analysed the same question with this dataset; check the abstract first. PDFs are served at `rummerlab.com/papers/<file>` (metadata in the rummerlab-website repo, `data/papers.json`).
- Species colours come from `src/lib/species.ts` (blacktip = slot 1, sicklefin lemon = slot 2).
- Charts measure their width (`bind:clientWidth`) and carry a `viewBox` so pre-hydration renders scale down instead of overflowing.
- Keyboard (#32): every chart spreads `markKeys()` from `charts/marks.ts` onto its svg (one tab stop, `role="application"` while it has marks, arrows/Home/End/Enter/Escape) and puts `data-mark={i}` on each mark's hover element so `markAt` can pin the tooltip there. Pointer handlers use `pointerIn(e)`. A new chart needs both, plus `KEYS_HINT` in its `aria-label`. Only put `aria-label` on elements that are links (e.g. linked scatter points).
- Page weight (#76): markup, not data, made pages heavy. Scatter sends one path of dots per colour above 250 points and swaps in circles after mount, hover picks the nearest point, coordinates are rounded to 0.1 px. Keep per-mark attributes off big charts; put shared ones on a parent `<g>`. `hooks.server.ts` Brotli/gzips HTML and JSON and sets a weak ETag (build version + import hash) so revalidation is a 304 without a render.
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

Questions for the lab go to Dr Jodie Rummer (`@JodieRummer`) on GitHub: label the issue `question`, tag her in the body (or in a comment on an existing issue), and number the questions so each can be answered in a line. Say what changes on the site with each answer. She reads the issues and replies there.

## Changelog for agents

| When    | Note                                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11 | v0.1.0: importer for all 13 seasons + adults + GPS + pressure ranking; external snapshots; 25 pages / 130+ charts; Docker, CI, release workflows; issues #1–#75.                                                                                                        |
| 2026-11 | v0.2.0: Physioshark logo/icon, footer version, OG image, CSV download on every chart, histogram overlay, busy-day (holiday) analysis, season rewind; unreadable DATA_DIR no longer fatal.                                                                               |
| 2026-11 | v0.2.1: interactive Leaflet map (satellite/street tiles); in-situ temperature loggers (#10: HOBO + EnvLogger CSVs, cross-checked between nurseries) with water-quality and nursery charts, set variable, finding; logger data-quality issues #95–#100.                  |
| 2026-11 | v0.2.2: GF read as tawny nurse shark (#12); charts cite the Physioshark paper behind them (ChartCard papers, PDFs on rummerlab.com); cloud cover vs catches, moonlight and nursery water (#104); Schnabel abundance and blacktip VBGF (#43, #44).                       |
| 2026-11 | v0.2.3: negative-binomial catch model on /drivers (#54; SST link is the calendar); gastric lavage diet columns and charts (#40); IBTrACS cyclones and heavy-rain days vs catches (#24); ForestPlot chart, LineChart markers.                                            |
| 2026-11 | v0.2.4: French Polynesia school holidays as a busy-day proxy (#25: archived 2013–17 orders + Ministry open data); lighter scatter plots, compressed pages and ETag revalidation (#76); keyboard-readable charts and reduced motion (#32).                               |
| 2026-11 | v0.2.5: sex ratio by nursery and season with a binomial mixed model (#117); a Statistics line under every chart with a trend or difference (#119); moon finding tested (#118); adjusted season test on the overview (#120); lab questions go to Jodie Rummer on GitHub. |

- Security scans (#144): use Snyk CLI >=1.1308.3 with `test --all-projects --dev` for the pnpm 12 multi-document lockfile. Remaining upstream advisories and mitigations are tracked in docs/dev/SNYK-144.md.
