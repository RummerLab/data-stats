# Deploying data.physioshark.org

The site is a single container (`ghcr.io/rummerlab/data-stats`) plus a folder of spreadsheets. It needs no database server and no outbound network access at runtime: environmental data ship inside the image (`external/`) and are refreshed weekly by a workflow that publishes a new image.

## 1. Host setup

```bash
mkdir -p /srv/physioshark-data/data && cd /srv/physioshark-data
```

Copy `docker-compose.ghcr.yml` and `.env.example` (as `.env`) from this repository, then put the Physioshark `.xlsx` workbooks in `./data`. Sub-folders are fine (e.g. `data/2025-2026 Adult data/`).

```bash
docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d
```

The first start imports every workbook (a few seconds) into the `cache` volume. `GET /health` returns `{"ok":true,…}` once ready.

If the GHCR package is private, log in first with a token that has `read:packages` (`docker login ghcr.io`). See issue #66 about making the code-only image public.

## 2. Public URL

The container listens on `127.0.0.1:${HOST_PORT:-8098}` by default. Put it behind a reverse proxy or Cloudflare Tunnel and point `data.physioshark.org` at it:

- **Cloudflare Tunnel:** add a public hostname `data.physioshark.org` → `http://localhost:8098`.
- **Caddy:** `data.physioshark.org { reverse_proxy 127.0.0.1:8098 }` (adds HTTPS automatically).
- **nginx:** `proxy_pass http://127.0.0.1:8098;` with `proxy_set_header X-Forwarded-Proto $scheme;`.

Set `ORIGIN` in `.env` to the public URL if the proxy does not send `X-Forwarded-Proto`.

## 3. Updating the data

- **New or corrected workbook:** copy it into `./data`. The app notices within a minute and rebuilds its cache; no restart needed. Check `/data-quality` afterwards.
- **Never edit the workbooks on the server to make the app happy**: fix the source with the lab and replace the file.
- **New image (code or environmental data):** `docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d` (or let Watchtower do it; the service carries the Watchtower label).

## 4. Troubleshooting

- `docker logs physioshark-data` shows `[import] rebuilt in … ms: {...}` after each import, or the error that stopped it.
- The cache is disposable: `docker compose -f docker-compose.ghcr.yml down && docker volume rm physioshark-data_cache` forces a clean rebuild.
- The image is distroless and runs as uid 65532 with no shell. The data folder must be readable by that user (default `644` files are fine).
