# Deploying to Google Cloud Run (free tier)

This is a practical, first-time-GCP-user walkthrough for deploying
`portfolio-backend` to Cloud Run. The frontend stays on Vercel; the database
stays on Neon. Nothing here touches the existing Render deployment
(`render.yaml`, `.github/workflows/deploy.yml`) — both are left in place and
still work if you want to keep Render around or roll back.

---

## 0. Prerequisites (one-time, ~10 minutes)

1. **Create/select a GCP project** at https://console.cloud.google.com.
2. **Enable billing** on the project. Cloud Run's free tier still applies
   with billing enabled — a card is required, but you will not be charged as
   long as you stay within the free tier described in §6 below (this app is
   comfortably inside it for a personal-portfolio traffic level).
3. **Install the `gcloud` CLI** (skip if already installed):
   https://cloud.google.com/sdk/docs/install
4. **Log in and set the project:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
5. **Enable the required APIs:**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com \
     cloudscheduler.googleapis.com
   ```

---

## 1. First manual deploy (simplest path — uses Cloud Build)

`--source .` uploads this directory, builds it with **this repo's
`Dockerfile`** via Cloud Build, pushes the image to Artifact Registry, and
deploys it — no separate `docker build`/`docker push` needed, and no local
Docker install required either.

From the `portfolio-backend` directory:

```bash
gcloud run deploy portfolio-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi \
  --port=8080
```

Notes:
- `--allow-unauthenticated` — the API must be publicly reachable by the
  Vercel frontend and Cloud Scheduler.
- `--min-instances=0` — required to stay in the free tier (see §6). The
  container cold-starts on the next request after idling.
- `--max-instances=1` — a personal portfolio backend has no need to scale
  out; this also caps worst-case cost if traffic ever spikes unexpectedly.
- `--port=8080` — Cloud Run's convention; the app already respects the
  `PORT` env var it injects (see `src/main.ts`), so this just documents it
  explicitly.
- First deploy takes a few minutes (Cloud Build has to build the image).
  Subsequent deploys are faster with layer caching.

`gcloud` will print a **Service URL** at the end, e.g.
`https://portfolio-backend-xxxxx-el.a.run.app`. You'll need it for steps 3–4.

---

## 2. Environment variables

Set these on the Cloud Run **service** (not in CI, not baked into the
image). Full list, matching `.env.example`:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset — Cloud Run injects `8080` automatically. |
| `CORS_ORIGINS` | Your Vercel domain(s), comma-separated, e.g. `https://your-site.vercel.app` |
| `DATABASE_URL` | **Use Neon's POOLED connection string** (the one with `-pooler` in the hostname), not the direct one. Cloud Run can spin up several concurrent container instances/requests; Postgres has a hard connection limit, and Neon's PgBouncer pooler is what protects you from exhausting it. Get it from Neon dashboard → your project → Connection Details → "Pooled connection". |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `1d` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` (different value from `JWT_SECRET`) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Used by the seed script, not read at runtime unless you re-seed |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard |
| `CLOUDINARY_UPLOAD_FOLDER` | `portfolio` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Gmail OAuth2 credentials |
| `GMAIL_USER` | The Gmail address being synced |
| `GMAIL_SYNC_CRON` | Optional — irrelevant on Cloud Run (see §3); harmless to leave unset |
| `SITE_URL` | Your public site URL, used in email templates |
| `ADMIN_MESSAGES_URL` | Deep link to the admin messages page, e.g. `https://your-site.vercel.app/admin/messages` |
| `CRON_SECRET` | `openssl rand -hex 32` — required for the Cloud Scheduler sync endpoint (§3). If unset, that endpoint always returns 401. |

### Set them (simple — plain env vars)

```bash
gcloud run services update portfolio-backend \
  --region asia-south1 \
  --set-env-vars NODE_ENV=production,CORS_ORIGINS=https://your-site.vercel.app,SITE_URL=https://your-site.vercel.app,ADMIN_MESSAGES_URL=https://your-site.vercel.app/admin/messages,CLOUDINARY_UPLOAD_FOLDER=portfolio
```

Repeat with `--update-env-vars` (or add more to the same `--set-env-vars`
list) for the remaining keys. Console UI works too: Cloud Run → your service
→ Edit & Deploy New Revision → Variables & Secrets.

### Better practice — Secret Manager

For anything sensitive (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`CLOUDINARY_API_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
`CRON_SECRET`, `ADMIN_PASSWORD`), Secret Manager is the better long-term
practice — the value is never visible in `gcloud run services describe`
output or in the console the way a plain env var is. Plain env vars are
perfectly fine to start with, though; it's a low-effort upgrade to do later.

```bash
# one-time: create the secret
echo -n "postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require" | \
  gcloud secrets create DATABASE_URL --data-file=-

# grant the Cloud Run service's runtime service account access
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# mount it as an env var on the service
gcloud run services update portfolio-backend \
  --region asia-south1 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest
```

Repeat per secret.

---

## 3. Cloud Scheduler — replaces the in-app Gmail-sync cron

**Why this is needed:** `ContactSyncTask` (`@nestjs/schedule`, every 2 min by
default) only runs while the Node process is actively executing. Cloud Run
scales to zero when idle and throttles CPU to near-zero between requests
even on a "warm" instance — so the in-process cron cannot be relied on to
fire on schedule. `POST /api/contact/sync-cron` (added in this change) does
the exact same sync as the admin `/api/contact/sync` route, but is
authenticated with a shared-secret header (`x-cron-secret`) instead of a
JWT, so an external scheduler can call it.

This also has a nice side effect: a periodic HTTP call keeps hitting the
service, which (a) is often enough to keep the container/DB connection warm
and (b) — because the handler queries Postgres — keeps your **Neon** project
active, avoiding Neon's own idle-suspend on the free tier.

Create the job (every 5 minutes):

```bash
gcloud scheduler jobs create http portfolio-backend-contact-sync \
  --location=asia-south1 \
  --schedule="*/5 * * * *" \
  --uri="https://YOUR-CLOUD-RUN-URL/api/contact/sync-cron" \
  --http-method=POST \
  --headers="x-cron-secret=YOUR_CRON_SECRET_VALUE" \
  --attempt-deadline=30s
```

Replace `YOUR-CLOUD-RUN-URL` with the Service URL from step 1, and
`YOUR_CRON_SECRET_VALUE` with the exact value you set as `CRON_SECRET` on
the Cloud Run service in §2.

**Cost:** Cloud Scheduler's free tier includes **3 free jobs per month**
account-wide; this uses exactly 1.

---

## 4. Point the frontend at the new backend

1. In Vercel → your project → Settings → Environment Variables, set
   `NEXT_PUBLIC_API_URL` (or whatever your frontend calls it) to the Cloud
   Run Service URL, e.g. `https://portfolio-backend-xxxxx-el.a.run.app/api`.
2. Redeploy the frontend from Vercel.
3. Back on the Cloud Run service, make sure `CORS_ORIGINS` includes the
   exact Vercel domain(s) actually used (production domain + any preview
   domains you rely on), comma-separated, no trailing slash.

---

## 5. Health check (optional but recommended)

Cloud Run's own startup check just needs the container to accept TCP
connections on `$PORT` in time — nothing extra is required for that.
Optionally, point Cloud Run's HTTP **startup probe** at the app's real
health endpoint (`GET /api/health` — checks DB connectivity too, see
`src/modules/health/health.controller.ts`) so a broken deploy (e.g. bad
`DATABASE_URL`) fails the health check instead of serving traffic:

```bash
gcloud run services update portfolio-backend \
  --region asia-south1 \
  --use-http2 \
  --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,timeoutSeconds=5,periodSeconds=5,failureThreshold=3
```

(This is a single optional flag — feel free to skip it initially and add it
once the first deploy is confirmed working.)

---

## 6. Free-tier notes

Cloud Run's always-free tier (per month, per billing account):
- **2 million requests**
- **360,000 GiB-seconds** of memory
- **180,000 vCPU-seconds** of compute

A personal-portfolio-scale backend (contact form + CMS reads, occasional
admin writes, a Scheduler ping every 5 min) uses a small fraction of this.

- **Cold starts:** expect roughly **1–4 seconds** for this Node/Nest app to
  cold-start after being scaled to zero (Nest's module graph + Prisma engine
  init add a bit over a bare Node process). The first request after an idle
  period will feel that delay; subsequent requests are fast until it scales
  back down.
- **Why not `--min-instances=1`:** that keeps one instance warm 24/7, which
  is billed continuously instead of per-request — for a low-traffic
  portfolio site this alone can push you past the free vCPU-second/GiB-second
  allowance for the month. Keep `--min-instances=0` unless cold starts become
  a real UX problem.

---

## 7. GitHub Actions path (`workflow_dispatch`, manual)

`.github/workflows/deploy-cloudrun.yml` builds via Cloud Build and deploys,
triggered manually from Actions → "Deploy to Cloud Run" → "Run workflow".
It never sets application env vars/secrets — those live on the Cloud Run
service itself (§2), so a routine deploy only ever changes the image.

**Repo secrets** (Settings → Secrets and variables → Actions → Secrets):
- `GCP_SA_KEY` — JSON key for a dedicated deploy service account (see below).
  The workflow's header comment also documents the Workload Identity
  Federation alternative, which avoids a long-lived key entirely.

**Repo variables** (same page, Variables tab) — all optional, sensible
defaults baked into the workflow:
- `GCP_PROJECT_ID` (required — no default)
- `GCP_REGION` (default `asia-south1`)
- `ARTIFACT_REPO` (default `portfolio-backend`)
- `SERVICE_NAME` (default `portfolio-backend`)

**Create the deploy service account and key:**

```bash
gcloud iam service-accounts create portfolio-backend-deployer \
  --display-name="portfolio-backend CI deployer"

PROJECT_ID=$(gcloud config get-value project)
SA_EMAIL="portfolio-backend-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/cloudbuild.builds.editor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE"
done

gcloud iam service-accounts keys create key.json --iam-account="$SA_EMAIL"
```

Paste the full contents of `key.json` into the `GCP_SA_KEY` secret, then
**delete the local `key.json` file** — don't commit it, don't keep it lying
around.

**One-time Artifact Registry repo** (only needed if you use the GitHub
Actions path instead of/in addition to `gcloud run deploy --source .`, which
creates one for you automatically on first run):

```bash
gcloud artifacts repositories create portfolio-backend \
  --repository-format=docker \
  --location=asia-south1
```

---

## Quick reference — all commands in order

```bash
# 0. one-time
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com

# 1. first deploy
gcloud run deploy portfolio-backend --source . --region asia-south1 \
  --allow-unauthenticated --min-instances=0 --max-instances=1 --memory=512Mi --port=8080

# 2. env vars (repeat/extend as needed — see table in §2)
gcloud run services update portfolio-backend --region asia-south1 \
  --set-env-vars NODE_ENV=production,CORS_ORIGINS=https://your-site.vercel.app,...

# 3. Cloud Scheduler
gcloud scheduler jobs create http portfolio-backend-contact-sync \
  --location=asia-south1 --schedule="*/5 * * * *" \
  --uri="https://YOUR-CLOUD-RUN-URL/api/contact/sync-cron" \
  --http-method=POST --headers="x-cron-secret=YOUR_CRON_SECRET_VALUE" --attempt-deadline=30s
```
