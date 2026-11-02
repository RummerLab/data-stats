# AGENTS.md — Physioshark Data Stats

> **Living document.** Read this before changing the repo and update it when you learn something new. Prefer short, actionable notes; delete stale guidance.

Web app for **http://data.physioshark.org/**: 13 seasons (2013-14 → 2025-26) of Moorea shark-nursery surveys from the Physioshark project (Dr Jodie Rummer, RummerLab), joined with weather, ocean, tide, climate and sun/moon data. Modelled on [crag-stats](https://github.com/Luen/crag-stats).

## Golden rules

1. **Never edit the data spreadsheets.** The `.xlsx` files in `data/` are the source of truth. The app only reads them. Problems in the sheets are reported on the data-quality page and in issues for the lab to fix at the source.
2. **Never commit or bake the spreadsheets into the image.** This repo is public. `data/` and `*.xlsx` are gitignored and dockerignored; the container mounts the folder read-only at `/data`. CI uses a synthetic fixture in `samples/fixture/`.
3. **The SQLite database is a derived cache.** It is rebuilt from `DATA_DIR` + `external/` whenever their fingerprint (or `IMPORTER_VERSION`) changes. After editing `src/lib/server/db/schema.ts`, run `pnpm db:generate`; there is no upgrade path to protect.
4. **Show everything** (user decision): crew names and free-text field notes are public on the site.

## Stack

SvelteKit 3 + Svelte 5 runes, Vite 8, Tailwind 4, Drizzle ORM + better-sqlite3, pnpm 12 (`packageManager`), Node 26. Charts are server-rendered SVG components (no chart library). Docker multi-arch → `ghcr.io/rummerlab/data-stats`.

## Repository map

```
src/lib/server/import/   xlsx.ts (fflate reader), normalize.ts, columns.ts (header aliases),
                         logs.ts (shark + set logs), extras.ts (lab, WQ, HOBO, blood…),
                         reference.ts (GPS, pressure ranking, adults), sites.ts, crew.ts,
                         external.ts, index.ts (orchestrator: link sets, individuals, env joins)
src/lib/server/astro.ts  sunset/twilight/moon (local formulas)
src/lib/server/tides.ts  tide extrema/interpolation (UHSLC Papeete)
src/lib/stats.ts         regression, correlation, Wilson CI, histograms, box stats
scripts/fetch-external.mjs  refresh external/ snapshots (public data, committed)
```

## Importer notes

- Units differ by season: 2013-15 lengths in cm, 2021-22 Cm/Na logs in cm despite "mm" headers, adults in cm. `harmoniseUnits()` converts per sheet from medians and logs every conversion.
- Dates one year outside their season are corrected (`fixSeasonYear`) and logged.
- 2013-14 "Shark log physioshark" / "Set Log physioshark" are skipped as duplicates (#9). 2015-16 recaptures are horizontal column blocks; 2013-15 recaptures come from "Recaptures" sheets.
- Site spellings → `sites.ts` (#13); crew aliases → `crew.ts` (#14).
- Moorea is UTC−10 with no DST; times are stored as minutes after local midnight.

## Commands

```bash
pnpm install
pnpm dev
pnpm check && pnpm lint && pnpm test
pnpm db:generate        # after schema changes
pnpm external           # refresh environmental snapshots
```

## File issues for what you find

Search first (`gh issue list --state all --search …`), one issue per problem, title `Area: summary`, label it (`data`, `analytics`, `environment`, `design`, `docker`, `infrastructure`, `data-quality`, `findings`, `question`). Epics are #68–#75.

## Changelog for agents

| When    | Note                                                                                  |
| ------- | ------------------------------------------------------------------------------------- |
| 2026-11 | Scaffold, importer, schema, external fetcher, issues #1–#75 created. App UI not built. |
