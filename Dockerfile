# =====================================================================
#  portfolio-backend — production Dockerfile (Google Cloud Run)
#
#  Two-stage build:
#    1. build   — full deps (incl. devDependencies), compiles Nest + Prisma
#    2. runtime — production deps only, non-root, listens on Cloud Run's
#                 injected $PORT
#
#  Prisma note (read before touching this file):
#  `npm ci --omit=dev` in the runtime stage does NOT run `prisma generate`
#  implicitly for a fresh, guaranteed-correct client — we make that
#  explicit below by re-running `npx prisma generate` in the runtime
#  stage itself (not by copying node_modules/.prisma across stages).
#  This is only possible because `prisma` (the CLI) was moved from
#  devDependencies to dependencies in package.json — otherwise
#  `--omit=dev` would strip the CLI and `npx prisma generate` /
#  `npx prisma migrate deploy` would have to fetch it from the registry
#  on every cold start. Verified locally: `npm ci --omit=dev` followed by
#  `npx prisma generate` produces a working node_modules/.prisma/client
#  with the engine binary matching the container it runs in (so build
#  and runtime can even use slightly different base images without any
#  engine-mismatch risk).
#
#  Image-size notes (read before touching the runtime stage):
#  Measured on this machine, the *un*optimized image was 1.47GB. The
#  single biggest offender was `RUN chown -R nodeapp:nodeapp /app` running
#  AFTER node_modules/dist were already copied in — on overlay2, changing
#  ownership of a file forces a full copy-up into a new layer, so that one
#  RUN line was silently duplicating the entire ~410MB node_modules+dist
#  tree in a second layer. Fixed by creating the user/group first, chowning
#  the (still-empty) WORKDIR once, switching to USER nodeapp, and using
#  `COPY --chown=` for everything copied afterward — so files land with the
#  right owner on first write and no duplicate layer is ever created.
#  The remaining optimizations (npm cache, duplicate Prisma engine
#  binaries, .d.ts/.map/doc files) are commented individually below.
#  Do not reintroduce a post-hoc `chown -R` — it will silently bloat the
#  image again even if every other optimization here is kept.
# =====================================================================

# ---------------------------------------------------------------------
# Stage 1: build
# ---------------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

# python3/make/g++: safety net for native addons (e.g. bcrypt) in case no
# prebuilt binary matches this exact image; openssl: Prisma's engine
# binary auto-detection needs it present at `generate` time too.
# hadolint ignore=DL3008
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching) — the Prisma schema must
# exist before `npm ci` so @prisma/client's install-time hooks can see it.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Now bring in the rest of the source and build.
# Kept as separate RUN layers (rather than chained with &&) on purpose:
# if `prisma generate` or the schema changes, Docker only re-runs from
# that layer instead of invalidating the (slower) `npm run build` too.
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl/ca-certificates: required at runtime for Prisma's query engine
# and for outbound TLS (Neon Postgres, Gmail API, Cloudinary, etc.). Both
# are already the minimal set — nothing else in the runtime image needs
# apt packages (no shells/tools are exec'd besides `node` and the Prisma
# CLI's own bundled binaries).
# User/group + chown of the (still-empty) WORKDIR happens here, BEFORE
# any files are copied in — see the "Image-size notes" comment above for
# why this ordering matters (avoids a full node_modules copy-up layer).
# hadolint ignore=DL3008
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system nodeapp \
  && useradd --system --gid nodeapp --home-dir /app --shell /usr/sbin/nologin nodeapp \
  && chown nodeapp:nodeapp /app

USER nodeapp

# Production deps only. `prisma` lives in "dependencies" (not
# devDependencies) specifically so it survives --omit=dev — both the
# migrate-deploy step and the generate step below need the CLI present.
# --chown here (and on every COPY below) keeps files owned by nodeapp from
# the first write, so no later `chown -R` (and its duplicate layer) is needed.
COPY --chown=nodeapp:nodeapp package.json package-lock.json ./
COPY --chown=nodeapp:nodeapp prisma ./prisma

# Single RUN layer: install prod deps, generate the client, then strip
# everything that isn't needed to (a) load @prisma/client at runtime or
# (b) run `prisma migrate deploy` at container startup. Each removal is
# deliberately narrow/named (no broad wildcard deletes) and was verified
# after the fact with:
#   docker run --rm <image> node -e "require('@prisma/client')"
#   docker run --rm <image> npx prisma migrate deploy --help
#
#   1. `npm cache clean --force` — npm ci populates ~/.npm (~50MB of
#      downloaded tarballs) as a side effect; it's dead weight once
#      install is done and only costs space because it happens in its
#      own RUN otherwise. Safe: purely a download cache, nothing requires
#      it at runtime.
#   2. Duplicate query-engine binaries — with no `binaryTargets` override
#      in schema.prisma, only ONE platform's engine is ever downloaded,
#      but that one engine ends up copied into node_modules THREE times
#      by different packages (~14MB each on linux):
#        - node_modules/.prisma/client/libquery_engine-*   → KEPT, this is
#          the copy @prisma/client actually `require()`s at query time.
#        - node_modules/@prisma/engines/libquery_engine-*  → removed. Only
#          consumed by `prisma generate` (already ran, above) and by CLI
#          subcommands (introspect/studio) this image never calls.
#        - node_modules/prisma/libquery_engine-*           → removed. Same
#          reasoning; `prisma migrate deploy` talks to the SCHEMA engine
#          (node_modules/@prisma/engines/schema-engine-*, kept, untouched)
#          not the query engine.
#   3. Non-Postgres WASM query engines — @prisma/client/runtime ships a
#      wasm engine per SQL dialect (postgresql/mysql/sqlite) even though
#      only one datasource provider is ever active (postgresql, per
#      schema.prisma) and this project uses the Node-API binary engine at
#      runtime anyway (`npx prisma -v` reports "Query Engine (Node-API)"),
#      so all three wasm files are normally inert. We only remove the
#      mysql/sqlite pair and deliberately leave the postgresql wasm file
#      in place as a low-risk fallback.
#   4. *.d.ts — TypeScript type declarations. Never read by Node's
#      require()/import at runtime (only by the TS compiler, which only
#      ever ran in the build stage against source, not against
#      node_modules). ~66MB across node_modules.
#   5. *.map — source maps for already-compiled runtime JS. Not read by
#      Node unless something explicitly installs source-map-support and
#      opts in; nothing in this dependency tree does at runtime. ~17MB.
#   6. *.md docs (README/CHANGELOG/etc.) inside node_modules — docs only,
#      never `require()`d. LICENSE files are intentionally left alone
#      (kept for OSS license compliance/audit). ~4MB.
#   Explicitly NOT pruned: raw (non-declaration) *.ts files some packages
#   ship alongside compiled JS (~1.4MB) — small enough that the risk of a
#   package resolving one directly isn't worth the marginal saving; and
#   googleapis (~200MB) — required per-spec and stripping individual API
#   subfolders out of it is exactly the fragile find-delete pattern we're
#   avoiding here.
RUN npm ci --omit=dev --no-audit --no-fund \
  && npx prisma generate \
  && npm cache clean --force \
  && rm -f node_modules/@prisma/engines/libquery_engine-* \
  && rm -f node_modules/prisma/libquery_engine-* \
  && rm -f node_modules/@prisma/client/runtime/query_engine_bg.mysql.js \
  && rm -f node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm \
  && rm -f node_modules/@prisma/client/runtime/query_engine_bg.sqlite.js \
  && rm -f node_modules/@prisma/client/runtime/query_engine_bg.sqlite.wasm \
  && find node_modules -name "*.d.ts" -delete \
  && find node_modules -name "*.map" -delete \
  && find node_modules -iname "*.md" -delete

# Compiled app only — no src/, tests, or build tooling in the final image.
COPY --from=build --chown=nodeapp:nodeapp /app/dist ./dist

# Cloud Run injects PORT (default 8080) — the app reads it via
# ConfigService/PORT in src/main.ts and binds 0.0.0.0. This EXPOSE is
# documentation only; Cloud Run ignores it and uses the PORT env var.
EXPOSE 8080

# Shell form so `&&` works, matching the Render startCommand today.
# `exec` replaces the shell with the node process so it becomes PID 1
# and receives SIGTERM directly from Cloud Run for graceful shutdown.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
