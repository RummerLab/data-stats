# Physioshark Data

**http://data.physioshark.org/** · thirteen seasons of [Physioshark](https://physioshark.org/) shark-nursery surveys in Mo'orea, French Polynesia, joined with weather, ocean, tide, climate and sun/moon data, and turned into charts, findings and profiles.

Led by Dr Jodie Rummer (RummerLab, James Cook University) in collaboration with CRIOBE. Built with SvelteKit, Drizzle and SQLite.

## What's in it

| Section     | Pages                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Explore     | Overview, season report cards, nursery map and profiles, every tagged shark, auto-generated findings                    |
| Biology     | Body size & condition, newborns and birth timing, growth, recaptures & site fidelity, adult blacktips, physiology & lab |
| Environment | What drives catches, ocean & heat stress (SST, DHW, ENSO, waves), weather, tides, moon, time of day, human pressure     |
| Fieldwork   | Sampling effort, crew leaderboards, water quality and in-situ logger temperatures, searchable field notes               |
| About       | Methods, data sources, publications, data-quality report                                                                |

More than 130 server-rendered SVG charts and maps (several repeat per season, nursery or shark), with hover tooltips, legends and data tables, in light and dark themes.

## The data (read this first)

- **The spreadsheets are the source of truth and are never edited by this app.**
- **They are never committed to this public repository, and never baked into the Docker image.** `data/` and `*.xlsx` are git- and docker-ignored. On the server they are mounted read-only into the container.
- Raw temperature logger exports (HOBO and EnvLogger `.csv` files) can sit anywhere under `data/`, e.g. `data/Temperature loggers/`. They are read the same way: never edited, never committed.
- The app imports them into a derived SQLite cache on startup and re-imports automatically (within a minute) whenever a workbook is added or changed. Drop in next season's `Physioshark_Shark Log 2026-2027.xlsx` and the site updates.
- Anything odd the importer notices (unit conversions, impossible measurements, out-of-season dates, tag conflicts, unknown sites) is listed on the **Data quality** page for the lab to fix in the source sheets.
- Environmental data are public and live in `external/` (Open-Meteo ERA5 weather and waves, NOAA OISST, NOAA Coral Reef Watch via PacIOOS, UHSLC Papeete tide gauge, NOAA CPC ENSO indices). `scripts/fetch-external.mjs` refreshes them; a weekly workflow commits updates and publishes a new image.
- Tests, CI and the container smoke test use **synthetic** workbooks in `samples/fixture/` (`pnpm fixture` regenerates them).

## Run locally

Requires Node 26 and pnpm (pinned in `package.json#packageManager`).

```bash
pnpm install
```

Put the Physioshark `.xlsx` workbooks in `./data` (any sub-folders are fine), then:

```bash
pnpm dev
```

Without `./data`, point at the synthetic fixture:

```bash
DATA_DIR=samples/fixture pnpm dev
```

| Variable        | Default                      | Meaning                                     |
| --------------- | ---------------------------- | ------------------------------------------- |
| `DATA_DIR`      | `./data`                     | Folder with the workbooks (read-only)       |
| `DATABASE_PATH` | `./cache/physioshark.sqlite` | Derived SQLite cache (safe to delete)       |
| `EXTERNAL_DIR`  | `./external`                 | Environmental snapshots                     |
| `ORIGIN`        | –                            | Public URL when the proxy sends no protocol |

## Deploy (Docker / GHCR)

Images are published to `ghcr.io/rummerlab/data-stats` (linux/amd64 + linux/arm64) on every `v*` tag, nightly dependency release and weekly data refresh.

```bash
cp .env.example .env
```

```bash
docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d
```

The compose file mounts `${DATA_PATH:-./data}` read-only at `/data` and keeps the derived database in a `cache` volume. See [docs/DEPLOY.md](docs/DEPLOY.md) for data.physioshark.org (reverse proxy / Cloudflare Tunnel, updating the spreadsheets).

## Development

```bash
pnpm check && pnpm lint && pnpm test
```

```bash
pnpm build && pnpm test:e2e
```

Opt-in check against the real spreadsheets (prints counts; never writes to them):

```bash
REAL_DATA_DIR=data pnpm vitest run src/lib/server/import/realData.test.ts
```

Read [AGENTS.md](AGENTS.md) before changing the importer, charts or release process. Ideas, epics and data questions are tracked as [GitHub issues](https://github.com/RummerLab/data-stats/issues).

## Credits

Survey data © the Physioshark project. Environmental data: Open-Meteo (CC BY 4.0, ERA5 © Copernicus/ECMWF), NOAA OISST v2.1, NOAA Coral Reef Watch (via PacIOOS), University of Hawaii Sea Level Center, NOAA Climate Prediction Center. Coastline © OpenStreetMap contributors (ODbL).
