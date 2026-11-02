# syntax=docker/dockerfile:1

# The spreadsheets are NEVER part of this image (public repo, unpublished data). They are
# mounted read-only at /data at runtime; the derived SQLite lives in the /cache volume.

FROM node:26-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")" \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build \
  && pnpm prune --prod \
  && mkdir -p /runtime-cache /runtime-libs \
  && cp -L "$(gcc -print-file-name=libatomic.so.1)" /runtime-libs/libatomic.so.1

FROM gcr.io/distroless/cc-debian13:nonroot AS runner
WORKDIR /app
ENV PATH=/usr/local/bin:/usr/bin:/bin
ENV NODE_ENV=production
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/data
ENV DATABASE_PATH=/cache/physioshark.sqlite
ENV EXTERNAL_DIR=/app/external

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/local/LICENSE /usr/local/share/doc/node/LICENSE
COPY --from=build /runtime-libs/ /usr/local/lib/
COPY --from=build --chown=65532:65532 /runtime-cache /cache

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/external ./external
COPY scripts/server.mjs scripts/serverOrigin.mjs ./scripts/

EXPOSE 3000
VOLUME ["/cache"]
USER 65532:65532

HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# server.mjs wraps build/ so plain-HTTP and proxied access both resolve the right origin.
CMD ["node", "scripts/server.mjs"]
