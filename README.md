# portfolio-backend

NestJS 10 REST API that powers the personal portfolio CMS. It serves all content
for `portfolio-frontend`, handles admin authentication, manages Cloudinary media
assets, and runs a two-way Gmail contact-sync so visitor messages and admin replies
stay in sync between the in-app inbox and a real Gmail inbox.

Every successful response is wrapped in a `{ data: T }` envelope.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (`@nestjs/common` / `@nestjs/core`) |
| Language | TypeScript 5 |
| ORM / DB | Prisma 5 + PostgreSQL |
| Auth | `@nestjs/jwt` + `passport-jwt` — JWT stored in an httpOnly `access_token` cookie |
| Media | Cloudinary SDK v2 — uploads, WebP conversion, dynamic-folder mode |
| Email / Sync | Google APIs (`googleapis`) — Gmail OAuth2 for outbound emails and thread polling |
| Scheduling | `@nestjs/schedule` — cron-based Gmail sync every 2 minutes |
| Validation | `class-validator` + `class-transformer` — global `ValidationPipe` with `whitelist: true` |
| API Docs | `@nestjs/swagger` — Swagger UI at `/api/docs` |
| Security | `helmet`, `@nestjs/throttler` (login rate-limited to 5 req/min), CORS allowlist |
| Passwords | `bcrypt` (12 rounds) |

---

## Modules

All modules live under `src/modules/`. Every route is prefixed with `/api`.

| Module | Responsibility |
|---|---|
| `auth` | Admin login/logout with JWT in an httpOnly cookie, refresh-token endpoint, `JwtAuthGuard`, `CurrentUser` decorator |
| `pages` | CRUD for URL-addressable CMS pages (slug, nav metadata, published flag) |
| `sections` | Ordered content blocks belonging to a page; each block has a `SectionType` and a free-form `data` JSON payload |
| `projects` | Portfolio project entries — slug, title, one-liner, role, tags, stack, metric, MDX body, featured/published flags |
| `blog` | Blog post entries — slug, title, excerpt, tags, MDX body, reading time, publish date |
| `skills` | Skill entries grouped by category, each with a `SkillLevel` (EXPERT / PROFICIENT / FAMILIAR) |
| `experience` | Work history — role, company, location, date range, bullet-point responsibilities |
| `education` | Academic history — degree, school, date range, optional detail |
| `achievements` | Awards and milestones — title, description, optional date |
| `settings` | `SiteSettings` singleton (name, tagline, email, socials, theme, OG meta) — upserted on id `"singleton"` |
| `media` | File uploads to Cloudinary; polymorphic owner reference; WebP conversion for raster images; hard delete synced with Cloudinary |
| `config` | Admin-editable `Configuration` option lists (e.g. `contact_link_types`); `GET /api/config/enums` exposes read-only schema enums |
| `contact` | Visitor contact-form submission; `ContactThread` + `ContactMessage` inbox; admin reply from app; Gmail two-way sync |
| `stats` | Dashboard aggregate counts (pages, projects, posts, skills, etc.) in a single DB transaction |
| `health` | `GET /api/health` — process liveness + PostgreSQL reachability check |

---

## Data Model

> Source of truth: `prisma/schema.prisma`. IDs use `cuid()`. Every non-user table
> carries `createdById` / `updatedById` FK columns pointing to `AdminUser` as a
> real audit trail.

### Enums

| Enum | Values |
|---|---|
| `SectionType` | `HERO`, `ABOUT`, `SKILLS`, `EXPERIENCE`, `FEATURED_PROJECTS`, `PROJECTS_GRID`, `BLOG_TEASER`, `ACHIEVEMENTS`, `EDUCATION`, `CONTACT`, `METRICS`, `RICH_TEXT`, `CTA`, `GALLERY`, `CONTENT_BLOCK` |
| `SkillLevel` | `EXPERT`, `PROFICIENT`, `FAMILIAR` |
| `DefaultTheme` | `DARK`, `LIGHT` |

### Core Models

**`AdminUser`** — the single admin account, seeded from env vars. Acts as the audit
principal; its id is stored as `createdById` / `updatedById` on every other table.

**`Page` → `Section`** — a `Page` is a URL-addressable route (unique `slug` + `title`).
Each page owns an ordered list of `Section` rows. A section carries a `SectionType`
enum value and a `data Json` column whose shape is determined by the type — e.g. a
`HERO` section stores headline/sub-headline text while a `FEATURED_PROJECTS` section
stores a list of project IDs to pin. Deleting a page cascades to its sections.

**Content collections** — `Project`, `BlogPost`, `Experience`, `Education`,
`Achievement`, and `Skill` are independent content tables each with `order` and
audit columns. `Project` and `BlogPost` support `published` flags and full MDX
bodies stored as `Text`.

**`SiteSettings`** — singleton row (id always `"singleton"`). Stores the owner's
name, tagline, contact email, location, socials JSON (`{ github, linkedin, twitter? }`),
default theme, brand accent colour, footer text, and OG metadata.

**`Configuration`** — admin-editable option lists keyed by a stable string
(e.g. `contact_link_types`). Each row holds a `items Json` array of
`{ value: string, label: string }` objects consumed by dropdowns in the CMS.

**`Media`** — Cloudinary-backed asset record. Ownership is **polymorphic**:
`ownerType` (`project` | `blog` | `experience` | `education` | `achievement` |
`page` | `settings`) plus `ownerId` replace per-entity FK columns. `usage`
disambiguates multi-purpose owners (e.g. on `settings`: `usage='resume'` vs
`usage='og'`). `order` controls display sequence within an owner. `publicId`
is unique and used for Cloudinary upserts and hard deletes.

**`ContactThread` → `ContactMessage`** — a `ContactThread` holds the visitor's name,
email, subject, and an optional `gmailThreadId` for Gmail correlation. Messages
record `direction` (`inbound` | `outbound`), `source` (`web` | `app` | `gmail` |
`notification`), body text, and an optional `gmailMessageId` used as a deduplication
key during sync. Deleting a thread cascades to its messages.

---

## Key Features

### CMS CRUD
Full create/read/update/delete for every content type. Public GET routes return
published content; write operations require the JWT guard. All mutations record
`createdById` / `updatedById` from the authenticated admin.

### JWT Auth (httpOnly Cookie)
Login via `POST /api/auth/login` — credentials validated with bcrypt, JWT
issued into an httpOnly `access_token` cookie (SameSite=lax, Secure in production).
A separate refresh-token flow is available. Login is throttled to 5 requests per
minute per IP.

### Cloudinary Media Uploads
Files are uploaded via `POST /api/media/upload` (multipart/form-data). The service:
- Validates MIME type against an allowlist.
- Converts JPEG/PNG/WEBP to WebP before uploading (SVG, GIF, PDF are passed through).
- Constructs a stable `publicId` scoped to the owner (`{folder}/{ownerType}/{ownerId}/{slugified-name}`) and uses Cloudinary's `asset_folder` for dynamic-folder mode.
- Upserts by `publicId` — re-uploading the same asset replaces the existing Cloudinary resource.
- Hard deletes the Cloudinary asset when `DELETE /api/media/:id` is called.

### Gmail Two-Way Contact Sync
When a visitor submits the contact form:
1. A `ContactThread` + inbound `ContactMessage` are created in the DB.
2. A notification email is sent to the admin via the Gmail API (OAuth2 refresh-token flow), creating a Gmail thread. The `gmailThreadId` is stored on the `ContactThread`.

When the admin replies from the app (`POST /api/contact/:id/reply`):
1. An outbound `ContactMessage` is stored.
2. The reply is sent into the same Gmail thread so the visitor sees it from a real email address.

A `@nestjs/schedule` cron job (default: every 2 minutes, configurable via
`GMAIL_SYNC_CRON`) polls Gmail for new messages in known threads. Any reply sent
directly from Gmail is pulled in as a `ContactMessage` with `source='gmail'`,
deduplicated by `gmailMessageId`. The entire Gmail integration gracefully degrades
to a no-op when the Gmail env vars are absent.

### `/api/config/enums`
Returns the Prisma-schema enums (`SectionType`, `SkillLevel`, `DefaultTheme`) as
JSON so the frontend can build type-safe dropdowns without hardcoding enum values.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (create a database named `portfolio`)
- A [Cloudinary](https://cloudinary.com) account (free tier is sufficient)
- A Google Cloud project with the Gmail API enabled and an OAuth2 refresh token
  (only required if you want the Gmail contact-sync feature)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
```

The full set of variables and their purpose:

```dotenv
# Server
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:3000        # comma-separated frontend origins

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/portfolio?schema=public

# JWT — use `openssl rand -hex 32` to generate each secret
JWT_SECRET=
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

# Admin account — created by the seed script
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=portfolio        # root folder in your Cloudinary account

# Gmail API — OAuth2 (required for two-way contact sync)
GMAIL_USER=                               # the Gmail address that sends/receives
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Email template links
SITE_URL=http://localhost:3000/
ADMIN_MESSAGES_URL=http://localhost:3000/admin/messages

# Optional: override the Gmail sync cron expression (default: every 2 minutes)
# GMAIL_SYNC_CRON=*/2 * * * *
```

> The Gmail variables are optional for local development. When absent, the
> contact form still saves messages to the database; email sending and cron
> sync are silently skipped.

### 3. Run database migrations

```bash
npm run prisma:migrate        # creates/updates tables in development
```

To apply migrations in production (no prompt, no data reset):

```bash
npm run prisma:deploy
```

### 4. Seed initial content

```bash
npx prisma db seed
```

The seed script (`prisma/seed.ts`) is idempotent — safe to re-run. It upserts:
- The `AdminUser` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`
- `SiteSettings` singleton
- Skills, Experience, Education, Achievements, Projects, BlogPosts, Configuration option sets, and the default Pages + Sections

### 5. Start the development server

```bash
npm run start:dev
```

The API is available at `http://localhost:4000/api`.
Swagger UI is at `http://localhost:4000/api/docs`.

### Fresh database reset

To drop all data and re-run all migrations and seed from scratch:

```bash
npm run db:reset              # wraps `prisma migrate reset`
```

### Other useful scripts

| Script | Command |
|---|---|
| Production build | `npm run build` |
| Production start | `npm run start:prod` |
| Prisma Studio (DB GUI) | `npm run prisma:studio` |
| Generate Prisma client | `npm run prisma:generate` |
| Lint + auto-fix | `npm run lint` |
| Format | `npm run format` |

---

## Local development with Docker Compose

An alternative to the "Getting Started" flow above — runs the same
production Dockerfile against a disposable, containerized Postgres. Useful
when you don't want to install/manage Postgres locally, or want to sanity-check
the actual production image before deploying.

```bash
docker compose up --build
```

**What runs where:**

| Service | Image | Host port | Purpose |
|---|---|---|---|
| `db` | `postgres:16-alpine` | `5433` → `5432` | Disposable local Postgres (named volume `portfolio_db_data`) |
| `api` | built from `./Dockerfile` | `4000` → `4000` | The NestJS API, same image that ships to Cloud Run |

Port `5433` (not the default `5432`) is used on the host side specifically so
this doesn't clash with a Postgres instance you might already have running
locally. `docker compose exec`/inside the compose network, `api` always
reaches the database at `db:5432`.

Once both containers are up, the API is at `http://localhost:4000/api`
(Swagger at `http://localhost:4000/api/docs`).

**Migrations run automatically.** The image's `CMD` runs
`npx prisma migrate deploy && exec node dist/main` on every container start —
on a fresh volume this applies the one existing migration before the app
starts listening; on subsequent restarts it's a no-op (already-applied
migrations are skipped).

**Credentials:** `docker-compose.yml` reads `${VAR:-default}` values that
Compose resolves from this directory's real `.env` file when present (falling
back to harmless local-dev defaults otherwise) — so if your `.env` already has
real Cloudinary/Gmail/JWT values, compose picks them up automatically; nothing
extra to configure. `DATABASE_URL`, `PORT`, `NODE_ENV`, and `CORS_ORIGINS` are
always fixed to the compose-local values regardless of your `.env` (see the
comments in `docker-compose.yml`). Two things worth knowing:
- Cloudinary env vars are read eagerly at boot (`CloudinaryProvider.onModuleInit`
  calls `ConfigService.getOrThrow`), so the API will refuse to start if they're
  completely unset — compose supplies dummy values (`demo`/`demo_key`/`demo_secret`)
  so it always boots; actual media uploads simply fail until you add real
  credentials to `.env`.
- Gmail env vars are left blank by default (not faked) — the app already
  handles this gracefully (`GmailService.isConfigured()` returns `false`), so
  the contact form still saves messages to the DB, it just skips sending/syncing
  email, rather than throwing real Google OAuth errors against a fake token.

**Seeding:** the production image intentionally does **not** include
`ts-node` (it's a devDependency, kept out of `--omit=dev` to keep the image
lean), so `docker compose exec api npx prisma db seed` will fail with
`spawn ts-node ENOENT`. Run the seed from your host instead, pointed at the
container's published port:

```bash
DATABASE_URL="postgresql://portfolio:portfolio_local_pw@localhost:5433/portfolio?schema=public" npx prisma db seed
```

(Swap in your own `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` if you
overrode the compose defaults.)

**No source bind-mount / no live reload:** this compose file builds the image
from source rather than mounting your working tree into the container (bind
mounts of paths under `~/Desktop` fail with a permission error on some
machines, independent of Docker Compose itself). After changing source code,
re-run `docker compose up --build` to rebuild before testing — this is a
build-based workflow, not a hot-reload dev server. For iterative day-to-day
development, `npm run start:dev` against a local or containerized Postgres
(see "Getting Started" above) is faster.

**Resetting:**

```bash
docker compose down -v   # stops containers AND deletes the db volume — next `up` starts from a truly empty database
```

---

## API Overview

| Base path | Description |
|---|---|
| `GET /api/health` | Liveness + DB check |
| `POST /api/auth/login` | Admin login (rate-limited 5/min) |
| `POST /api/auth/logout` | Clear auth cookie |
| `GET /api/pages` | List published pages |
| `GET /api/sections` | Sections for a page |
| `GET /api/projects` | List published projects |
| `GET /api/blog` | List published blog posts |
| `GET /api/skills` | All skills |
| `GET /api/experience` | Work history |
| `GET /api/education` | Education history |
| `GET /api/achievements` | Achievements list |
| `GET /api/settings` | SiteSettings singleton |
| `GET /api/media` | Media library (admin only) |
| `POST /api/media/upload` | Upload a file to Cloudinary (admin only) |
| `GET /api/config/enums` | Schema enums as JSON (public) |
| `GET /api/config` | Admin-editable option sets (public) |
| `POST /api/contact` | Submit visitor contact form (public) |
| `GET /api/stats` | Dashboard counts (admin only) |

Full interactive documentation is available at `/api/docs` when the server is running.

---

## Security Notes

- All secrets (`DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_API_SECRET`,
  `GOOGLE_REFRESH_TOKEN`, etc.) live exclusively in `.env`.
- `.env` is git-ignored. The repository only tracks `.env.example` with placeholder
  values. Never commit a populated `.env` or any file containing real credentials.
- The `GOOGLE_REFRESH_TOKEN` grants read/send access to the configured Gmail inbox.
  Rotate it immediately if it is ever exposed.
- JWT cookies are `httpOnly` and `Secure` (HTTPS-only) in production. The
  `sameSite: lax` policy prevents cross-site request forgery for the majority
  of use cases.
