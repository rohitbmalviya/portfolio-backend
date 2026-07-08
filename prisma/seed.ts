/**
 * prisma/seed.ts
 *
 * Idempotent seed script — safe to re-run at any time.
 * All writes use upsert() on natural unique keys so
 * re-running never duplicates rows.
 *
 * Run:  npx prisma db seed
 *   or: ts-node prisma/seed.ts
 *
 * Requires:  ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME in .env
 * Content source-of-truth: step3.md
 * Structure source-of-truth: step4.md §3
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// bcrypt cost factor — high enough to be slow for attackers, fast enough for a seed script
const BCRYPT_ROUNDS = 12;

// ─── helpers ────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SITE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

async function seedSiteSettings(): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "Rohit Malviya",
      tagline:
        "Full-stack engineer who ships production systems end-to-end — from a bank-grade Monte Carlo engine to multi-tenant SaaS — across TypeScript, Go, Python & Java.",
      email: "rohitbmalviya@gmail.com",
      location: "Pune, India",
      socials: {
        github: "https://github.com/rohithumancloud",
        linkedin: "https://linkedin.com/in/rohitbmalviya",
      } satisfies Prisma.InputJsonValue,
      // resumeUrl removed — now normalised to resumeMediaId (null by default)
      defaultTheme: "DARK",
      brandAccent: "#22d3ee", // cyan-400
      footerText: "Designed & built by Rohit Malviya — Next.js + Tailwind",
      ogTitle: "Rohit Malviya — Full-Stack Engineer",
      ogDescription:
        "Full-stack engineer (2+ yrs) building production SaaS & bank-grade systems across TypeScript, Go, Python & Java. Architected a Monte Carlo platform for Siam Commercial Bank; owns large backends & multi-role frontends.",
    },
  });
  console.log("  ✓ SiteSettings");
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN USER  —  created FIRST; id is threaded into all content seeders
// ─────────────────────────────────────────────────────────────────────────────

async function seedAdminUser(): Promise<string> {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");
  const name = requireEnv("ADMIN_NAME");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name,
    },
  });
  console.log(`  ✓ AdminUser (${email})`);
  return admin.id;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKILLS  (step3 §2.3 with proposed tier split)
// ─────────────────────────────────────────────────────────────────────────────

async function seedSkills(createdById: string): Promise<void> {
  const skills: Array<{
    group: string;
    name: string;
    level: "EXPERT" | "PROFICIENT" | "FAMILIAR";
    order: number;
  }> = [
    // LANGUAGES
    { group: "LANGUAGES", name: "TypeScript", level: "EXPERT", order: 0 },
    { group: "LANGUAGES", name: "Go", level: "PROFICIENT", order: 1 },
    { group: "LANGUAGES", name: "Python", level: "PROFICIENT", order: 2 },
    { group: "LANGUAGES", name: "Java", level: "FAMILIAR", order: 3 },
    { group: "LANGUAGES", name: "Dart", level: "FAMILIAR", order: 4 },

    // FRONTEND
    { group: "FRONTEND", name: "Angular 18/19", level: "EXPERT", order: 0 },
    { group: "FRONTEND", name: "Next.js", level: "EXPERT", order: 1 },
    { group: "FRONTEND", name: "React", level: "EXPERT", order: 2 },
    { group: "FRONTEND", name: "Tailwind CSS", level: "EXPERT", order: 3 },
    { group: "FRONTEND", name: "RxJS", level: "PROFICIENT", order: 4 },
    {
      group: "FRONTEND",
      name: "Signals (Angular)",
      level: "PROFICIENT",
      order: 5,
    },
    {
      group: "FRONTEND",
      name: "Reactive Forms",
      level: "PROFICIENT",
      order: 6,
    },

    // BACKEND
    { group: "BACKEND", name: "Node.js / Express", level: "EXPERT", order: 0 },
    { group: "BACKEND", name: "NestJS", level: "PROFICIENT", order: 1 },
    { group: "BACKEND", name: "FastAPI", level: "PROFICIENT", order: 2 },
    { group: "BACKEND", name: "Gin (Go)", level: "PROFICIENT", order: 3 },
    { group: "BACKEND", name: "REST APIs", level: "EXPERT", order: 4 },
    { group: "BACKEND", name: "Microservices", level: "PROFICIENT", order: 5 },
    { group: "BACKEND", name: "Spring Boot", level: "FAMILIAR", order: 6 },

    // DATA
    { group: "DATA", name: "PostgreSQL", level: "EXPERT", order: 0 },
    { group: "DATA", name: "Prisma", level: "EXPERT", order: 1 },
    { group: "DATA", name: "Redis", level: "PROFICIENT", order: 2 },
    { group: "DATA", name: "TypeORM", level: "PROFICIENT", order: 3 },
    { group: "DATA", name: "MongoDB", level: "PROFICIENT", order: 4 },
    { group: "DATA", name: "Elasticsearch", level: "FAMILIAR", order: 5 },
    { group: "DATA", name: "Oracle", level: "FAMILIAR", order: 6 },
    { group: "DATA", name: "SQLAlchemy", level: "FAMILIAR", order: 7 },

    // CLOUD / DEVOPS
    { group: "CLOUD_DEVOPS", name: "Docker", level: "PROFICIENT", order: 0 },
    {
      group: "CLOUD_DEVOPS",
      name: "Kubernetes",
      level: "PROFICIENT",
      order: 1,
    },
    { group: "CLOUD_DEVOPS", name: "Helm", level: "PROFICIENT", order: 2 },
    { group: "CLOUD_DEVOPS", name: "GCP", level: "PROFICIENT", order: 3 },
    { group: "CLOUD_DEVOPS", name: "AWS", level: "PROFICIENT", order: 4 },
    {
      group: "CLOUD_DEVOPS",
      name: "GitHub Actions",
      level: "PROFICIENT",
      order: 5,
    },
    { group: "CLOUD_DEVOPS", name: "Jenkins", level: "PROFICIENT", order: 6 },
    {
      group: "CLOUD_DEVOPS",
      name: "BullMQ / ARQ",
      level: "PROFICIENT",
      order: 7,
    },
    { group: "CLOUD_DEVOPS", name: "Stripe", level: "PROFICIENT", order: 8 },

    // AI / ML
    { group: "AI", name: "TensorFlow", level: "FAMILIAR", order: 0 },
    { group: "AI", name: "LangChain / LangGraph", level: "FAMILIAR", order: 1 },
    { group: "AI", name: "RAG", level: "PROFICIENT", order: 2 },
    { group: "AI", name: "Gemini", level: "PROFICIENT", order: 3 },
    { group: "AI", name: "LiveKit", level: "PROFICIENT", order: 4 },
  ];

  // Skills have no natural unique key besides id.
  // deleteMany + createMany for clean idempotent reseed (low-volume, safe).
  await prisma.skill.deleteMany({});
  await prisma.skill.createMany({
    data: skills.map((s) => ({ ...s, createdById })),
  });
  console.log(`  ✓ Skills (${skills.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPERIENCE  (step3 §2.4)
// ─────────────────────────────────────────────────────────────────────────────

async function seedExperience(createdById: string): Promise<void> {
  await prisma.experience.deleteMany({});

  await prisma.experience.createMany({
    data: [
      {
        role: "Software Engineer",
        company: "Humancloud Technologies",
        location: "Pune, India",
        startDate: new Date("2024-07-01"),
        endDate: null,
        bullets: [
          "Architected a 3-service production Monte Carlo platform for Siam Commercial Bank — TensorFlow GBM with Cholesky-correlated multi-asset paths, FastAPI + ARQ async engine over Oracle, SFTP ingestion pipeline with HMAC verification and FX conversion to THB.",
          "Owned the ~185-endpoint Client backend on Teamcast (Express + Prisma) plus Candidate and Client Next.js portals — job postings, applications, shortlists, Stripe subscriptions, ATS integrations, and analytics.",
          "Built Meet Scribe's bot-service (3 Playwright platform adapters, PulseAudio/FFmpeg audio capture to GCS, Gemini speaker diarization) and the 41-route Stripe Subscription/Payment domain (checkout, webhooks, credits, invoices) plus 10-page admin & checkout UI.",
          "Shipped Lease Oasis Property/Admin/Inquiry/S3/Notification services + a Python RAG microservice (FastAPI + LangChain + LangGraph multi-agent flow over 768-dim Gemini embeddings in Elasticsearch) + 14-page admin & 8-page operator UIs.",
          "Built Medic AI's 34-route Partner ecosystem + 4 role portals; frontend on Avaloq GBS (Angular 19, MiFID II suitability) with signal-based state, lazy-loaded routes, and reactive forms.",
        ],
        order: 0,
        createdById,
      },
      {
        role: "Software Developer Intern",
        company: "Humancloud Technologies",
        location: "Pune, India",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-06-30"),
        bullets: [
          "Built OMS — a Go + Angular 18 HR/attendance platform across 3 client organisations: 24 Go REST APIs, goroutine-based batch processing (5,000+ records/file), and a custom punch-pairing algorithm for biometric reconstruction.",
          "Built authentication (JWT/bcrypt/Google OAuth), the Property module, and buyer/seller/agent portals on PropertyBull — a 4-microservice real-estate platform; integrated AWS S3 uploads and wired Docker + Jenkins CI/CD.",
        ],
        order: 1,
        createdById,
      },
    ],
  });
  console.log("  ✓ Experience (2 roles)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDUCATION
// ─────────────────────────────────────────────────────────────────────────────

async function seedEducation(createdById: string): Promise<void> {
  await prisma.education.deleteMany({});

  await prisma.education.createMany({
    data: [
      {
        degree: "B.E. — Artificial Intelligence & Data Science",
        school: "Zeal College of Engineering & Research, Pune",
        startDate: new Date("2021-08-01"),
        endDate: new Date("2024-06-30"),
        detail: "CGPA 8.9 / 10",
        order: 0,
        createdById,
      },
    ],
  });
  console.log("  ✓ Education (1 entry)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACHIEVEMENTS  (step3 §2.7)
// ─────────────────────────────────────────────────────────────────────────────

async function seedAchievements(createdById: string): Promise<void> {
  await prisma.achievement.deleteMany({});

  await prisma.achievement.createMany({
    data: [
      {
        title: '"Going Beyond" Award',
        description:
          "Awarded by Humancloud Technologies for delivering critical production features across multiple projects — including the bank-grade SCB Monte Carlo platform, Teamcast, Meet Scribe, and Lease Oasis.",
        date: new Date("2025-03-01"),
        order: 0,
        createdById,
      },
      {
        title: "Mentored Simulix Interns",
        description:
          "Mentored interns building Simulix — Humancloud's internal Monte Carlo demo platform — sharing domain knowledge on simulation architecture, TensorFlow GBM, and async job queues.",
        date: new Date("2025-06-01"),
        order: 1,
        createdById,
      },
      {
        title: "B.E. in Artificial Intelligence & Data Science",
        description:
          "Zeal College of Engineering & Research, Pune — CGPA 8.9/10 — 2021–2024.",
        date: new Date("2024-06-30"),
        order: 2,
        createdById,
      },
    ],
  });
  console.log("  ✓ Achievements (3 items)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROJECTS  (step3 §3.1–3.8)
//  screenshots removed — images are uploaded via Cloudinary after seed.
// ─────────────────────────────────────────────────────────────────────────────

async function seedProjects(createdById: string): Promise<void> {
  const projects: Array<{
    slug: string;
    title: string;
    oneLiner: string;
    role: string;
    tags: string[];
    stack: string[];
    metric: string;
    liveUrl?: string;
    overview: string;
    contribution: string;
    body: string;
    featured: boolean;
    order: number;
    published: boolean;
  }> = [
    // ── 1. SCB Monte Carlo ──────────────────────────────────────────────────
    {
      slug: "scb-monte-carlo",
      title: "SCB Monte Carlo Platform",
      oneLiner:
        "Bank-grade Monte Carlo portfolio-simulation platform for Siam Commercial Bank.",
      role: "Sole architect & engineer — entire platform.",
      tags: [
        "Python",
        "TensorFlow",
        "FastAPI",
        "ARQ",
        "Oracle",
        "Kubernetes",
        "Helm",
      ],
      stack: [
        "Python",
        "TensorFlow",
        "FastAPI",
        "ARQ",
        "Redis",
        "Oracle",
        "Kubernetes",
        "Helm",
        "OpenShift",
      ],
      metric: "3 services · ~1,242 tests · Cholesky-GBM engine",
      liveUrl: "https://simulix.humancloud.dev",
      overview:
        "A production Monte Carlo platform that ingests the bank's fund/price/FX data over SFTP, syncs it to Oracle, and runs TensorFlow GBM simulations with Cholesky-correlated multi-asset paths — returning 10/50/90-percentile outcome scenarios, achievement dates, and goal probability for goal-based investment advice.",
      contribution:
        "Designed and built all three services plus infra independently: the FastAPI + ARQ/Redis async engine; the Cholesky-correlated GBM math implemented in TensorFlow; Oracle persistence; the SFTP→Oracle data pipeline (HMAC-verified, idempotent, FX-converted to THB); the Helm/OpenShift deployment; and a ~1,242-test suite with a load benchmark. Engaged directly with the bank's team on requirements and demos.",
      body: `## Architecture

The platform consists of three independent services:

1. **data-pull** — polls the bank\'s SFTP server, verifies file integrity via HMAC, and dumps raw CSV/XLSX data to a staging area.
2. **data-sync** — reads staging, applies FX conversion to THB, validates against known fund/price schemas, and upserts into Oracle tables (idempotent — safe to re-run on the same file).
3. **engine (API + worker)** — FastAPI accepts simulation requests and enqueues an ARQ job; the ARQ worker pulls the latest data from Oracle, builds the Cholesky-decomposed covariance matrix, runs TensorFlow GBM with correlated Wiener increments across N paths, and persists the 10/50/90-percentile outcomes plus goal-probability back to Oracle.

\`\`\`
SFTP → data-pull → staging → data-sync → Oracle
                                              ↑
                              engine-api → ARQ queue → engine-worker → Oracle (results)
                                              ↑
                                           Redis (job state)
\`\`\`

## Key Engineering Decisions

**Cholesky-correlated GBM** — Standard GBM assumes uncorrelated assets, which underestimates portfolio tail-risk. We decompose the historical covariance matrix (\`Σ = LLᵀ\`) and multiply standard normal draws by \`Lᵀ\` to produce correlated Wiener increments. This is numerically stable and vectorises efficiently in TensorFlow.

**ARQ over Celery** — ARQ (async Redis queue in pure Python) was chosen over Celery for its simplicity, native \`asyncio\` support, and first-class FastAPI integration. Each simulation job is idempotent and retried automatically on worker restart.

**Oracle over PostgreSQL** — The bank mandated Oracle as the system-of-record. We use SQLAlchemy Core for typed queries and handle Oracle-specific date arithmetic carefully.

## Test Suite

~1,242 tests across unit (GBM math assertions, FX conversion edge-cases), integration (pipeline end-to-end with mocked SFTP), and load tests (benchmarking N=10,000-path simulations at concurrency).

## Live Demo & NDA Note

The bank's production deployment is on-prem (VPN-only) under NDA. A **public demo of the same Monte Carlo engine — Simulix** — is available at [simulix.humancloud.dev](https://simulix.humancloud.dev), so you can try the simulation flow without the bank's internal data.`,
      featured: true,
      order: 0,
      published: true,
    },

    // ── 2. Aquatech Autotool ─────────────────────────────────────────────────
    {
      slug: "aquatech-autotool",
      title: "Aquatech Autotool",
      oneLiner:
        "Water/process-engineering plant-design & technical-proposal automation.",
      role: "Frontend UI Engineer (Angular 19) — redesigned ~60% of the frontend.",
      tags: ["Angular 19", "React Flow", "RxJS", "TypeScript", "Frontend"],
      stack: [
        "Angular 19",
        "React 19",
        "@xyflow/react",
        "Angular Material",
        "RxJS",
        "TypeScript",
        "jsPDF",
        "Django REST (consumed)",
      ],
      metric:
        "~60% frontend redesign · React-Flow-in-Angular diagram editor · 91 components",
      overview:
        "An internal tool for water/process-engineering teams: enter a project's feed-water analysis and capacity, and it auto-selects the treatment scheme, computes the water/mass balance, lays out the block/P&ID diagram, builds the bill-of-quantities and costing, and generates the technical-proposal PDF — across desalination, industrial/ultrapure-water, and infrastructure plant types.",
      contribution:
        "Redesigned ~60% of the Angular 19 frontend and optimized load/runtime performance (lazy-loaded modules, OnPush, loader-suppressed background calls, debounced auto-save). Embedded a React 19 React-Flow diagram editor inside Angular via a custom cross-framework bridge, built a config-driven dynamic form engine, and delivered client-side multi-page PDF reporting.",
      body: `## Product Context

Aquatech Autotool is an internal estimation-and-proposal tool for water/process-engineering teams. From a project's feed-water analysis and capacity it auto-selects the treatment scheme, computes the water/mass balance, lays out the block/P&ID diagram, builds the bill-of-quantities and costing, and generates the technical-proposal PDF — across desalination, industrial/ultrapure-water, and infrastructure plant types.

## My Role — Frontend UI Engineer

Redesigned ~60% of the Angular 19 frontend (UI/UX overhaul) and optimized load/runtime performance, while owning the most differentiated parts of the UI.

## Highlights

- **React-in-Angular diagram editor** — embedded a React 19 React-Flow (@xyflow) interactive canvas inside the Angular 19 app via a custom cross-framework bridge: React mounted with \`ReactDOM.createRoot\`, data through Angular \`@Input/@Output\`, imperative control via \`window\` globals and a registered save callback.
- **Custom node/edge system** — 5 node types, 4 edge types, multi-handle connections, drag-and-drop placement, multi-select delete, and a missing-data highlight overlay.
- **Client-side PDF reporting** — jsPDF + html-to-image capture of the live React-Flow canvas, with bounds/viewport math and font-ready sync, into paginated A4 reports.
- **Config-driven dynamic form engine** — 11 field types across tabbed/sectioned/repeating layouts, with api/static option sources and api/formula computed fields.
- **Reactive cross-field logic** — RxJS \`combineLatest\` + \`debounce\` + \`distinctUntilChanged\` for live formula recompute, auto-fill triggers, and silent debounced auto-save with \`localStorage\` caching.

## Stack

Angular 19 (standalone) · React 19 / @xyflow React-Flow · Angular Material · RxJS · jsPDF — integrated with a Django REST API.`,
      featured: true,
      order: 1,
      published: true,
    },

    // ── 7. Teamcast ─────────────────────────────────────────────────────────
    {
      slug: "teamcast",
      title: "Teamcast",
      oneLiner:
        "AI-powered hiring & assessment SaaS (candidates, clients, partners, support).",
      role: "Owned the ~185-endpoint Client backend (Express + Prisma) + Candidate/Client portals.",
      tags: [
        "Express",
        "Prisma",
        "PostgreSQL",
        "Next.js",
        "LiveKit",
        "Convex",
        "GCP Vertex AI",
        "Stripe",
      ],
      stack: [
        "Node.js",
        "Express",
        "Prisma",
        "PostgreSQL",
        "Next.js",
        "React",
        "BullMQ",
        "Convex",
        "LiveKit",
        "GCP Vertex AI",
        "Stripe",
        "GKE",
        "Docker",
      ],
      metric: "148 Prisma models · ~185-endpoint backend",
      liveUrl: "https://teamcast.ai",
      overview:
        "Full hiring-lifecycle platform — job posting → AI candidate matching → 3-stage AI assessment funnel → AI-proctored LiveKit interviews → hire. 148-model multi-tenant Postgres backend; Convex real-time layer for notifications and live interview state.",
      contribution:
        "Built and owned the Client backend (~185 endpoints: job postings, applications, shortlists, candidate import, Stripe subscriptions, ATS integrations, analytics) and the Candidate/Client Next.js portals (role-based routing, form-heavy workflows, component reuse across the hiring funnel).",
      body: `## Overview

Teamcast is a full hiring-lifecycle SaaS covering every step from job creation to offer — with AI at each stage.

## Architecture

\`\`\`
Express API (system of record)
  ├── BullMQ workers (AI scoring, email, import jobs)
  ├── Convex (real-time notifications + interview state)
  ├── GCP Vertex AI (candidate matching + interview scoring)
  ├── LiveKit (AI-proctored video interviews)
  └── Stripe (subscription + credit billing)
               ↕
         PostgreSQL (148 Prisma models)
\`\`\`

## Data Model Complexity

148 Prisma models covering: companies, job postings, pipelines, pipeline stages, applications, candidates, assessments (question banks, submission scoring), live interviews (LiveKit sessions, proctoring events), subscriptions, invoices, ATS webhooks, and analytics aggregates. Multi-tenancy is rooted at \`company\` with every query filtered by \`companyId\`.

## My Backend Domain (~185 endpoints)

- **Jobs** — create/update/close postings, manage pipeline stages, clone templates.
- **Applications** — apply, advance/reject across stages, bulk operations.
- **Shortlists & Import** — CSV/ATS candidate import with deduplication.
- **Stripe Billing** — subscription plans, seat counts, credit balance, invoices.
- **Analytics** — time-to-hire, funnel conversion, source attribution.

## Frontend Portals

Candidate Portal: application status, assessment submissions, interview scheduling. Client Portal: full hiring dashboard, job management, candidate review, ATS configuration.`,
      featured: false,
      order: 6,
      published: true,
    },

    // ── 5. Meet Scribe ──────────────────────────────────────────────────────
    {
      slug: "meet-scribe",
      title: "Meet Scribe",
      oneLiner:
        "AI meeting-notetaker that joins calls, records, transcribes & syncs to CRM.",
      role: "Owned the bot-service + the 41-route Stripe billing domain + 10-page admin/checkout.",
      tags: [
        "Playwright",
        "BullMQ",
        "Gemini",
        "Google Speech",
        "GCS",
        "Stripe",
        "Express",
        "Prisma",
      ],
      stack: [
        "Node.js",
        "Express",
        "Prisma",
        "PostgreSQL",
        "Playwright",
        "BullMQ",
        "Gemini",
        "Google Cloud Speech",
        "GCS",
        "Stripe",
        "Convex",
        "GKE",
        "PM2",
      ],
      metric: "3 Playwright adapters · 41 billing routes",
      liveUrl: "https://meetscribe.co",
      overview:
        "A headless bot silently joins Microsoft Teams, Zoom, and Google Meet; captures audio to GCS; and produces Gemini-diarized transcripts → summaries, MOM emails, and CRM sync — on a Stripe credit/subscription model.",
      contribution:
        "Built the bot-service (3 Playwright platform adapters, PulseAudio/FFmpeg audio capture to GCS, Gemini-powered speaker diarization) and the 41-route Stripe Subscription/Payment domain (checkout, webhooks, credits, invoices) plus the 10-page admin & checkout UI.",
      body: `## Architecture

\`\`\`
Express API / Worker (PM2 split)
  ├── BullMQ — bot-dispatch, transcript, email, CRM-sync queues
  ├── bot-service — Playwright (Teams / Zoom / Meet adapters)
  │     └── PulseAudio → FFmpeg → GCS audio chunks
  ├── Google Cloud Speech → transcript segments
  ├── Gemini — speaker diarization + summarisation
  ├── Stripe — subscriptions + credit wallet
  └── Convex — real-time meeting state + client push
               ↕
         PostgreSQL (Prisma)
\`\`\`

## Bot Service — Engineering Details

Each platform adapter (Teams, Zoom, Meet) is a separate Playwright script that:
1. Authenticates and joins the meeting URL.
2. Intercepts the virtual audio device (PulseAudio virtual sink) to capture raw PCM.
3. Pipes chunks through FFmpeg → Opus → GCS upload in rolling 30-second segments.
4. Emits a BullMQ "meeting-ended" event on disconnect.

The hardest part was making each adapter robust to platform UI changes (Zoom's DOM is notoriously unstable) and handling late-join, reconnect, and waiting-room scenarios.

## Stripe Billing Domain (41 routes)

- Subscription plans (monthly/annual, seat-based).
- Credit wallet (buy credits, deduct on bot-use, auto-recharge threshold).
- Webhook handler (invoice.paid, subscription.deleted, payment_intent events).
- Invoice history, receipt emails, proration.

## Speaker Diarization

Google Cloud Speech returns segments with speaker tags. Gemini is called with the full segmented transcript and a system prompt asking it to:
- Map speaker tags to participant display names (joined from the meeting roster).
- Generate a structured summary (key decisions, action items, MOM draft).`,
      featured: true,
      order: 4,
      published: true,
    },

    // ── 6. Lease Oasis ──────────────────────────────────────────────────────
    {
      slug: "lease-oasis",
      title: "Lease Oasis",
      oneLiner:
        "UAE property-rental & lease-management platform (7-service microservices).",
      role: "Owned Property/Admin/Inquiry/S3/Notification services + a Python RAG microservice + admin/operator UIs.",
      tags: [
        "Express",
        "TypeORM",
        "PostgreSQL",
        "FastAPI",
        "LangChain",
        "LangGraph",
        "Elasticsearch",
        "Next.js",
      ],
      stack: [
        "Node.js",
        "Express",
        "TypeORM",
        "PostgreSQL",
        "FastAPI",
        "Python",
        "LangChain",
        "LangGraph",
        "Elasticsearch",
        "Next.js",
        "Stripe",
        "Docker",
        "GKE",
      ],
      metric:
        "7 services · 63 shared entities · 14-page admin + 8-page operator",
      liveUrl: "https://www.leaseoasis.ae",
      overview:
        "Multi-sided property platform for the UAE market — landlords, agencies, agents, and operators — with credit/subscription billing, Elasticsearch-powered search, and a conversational AI assistant backed by a multi-agent LangGraph flow.",
      contribution:
        "Built the Property/Admin/Inquiry/S3/Notification backend services and a Python RAG microservice (FastAPI + LangChain + LangGraph multi-agent flow over 768-dimensional Gemini embeddings in Elasticsearch), plus the 14-page Admin and 8-page Operator Next.js frontends.",
      body: `## Architecture

\`\`\`
7 Microservices:
  ├── property-service     (Express + TypeORM) — listings, units, availability
  ├── admin-service        (Express + TypeORM) — platform admin, landlord onboarding
  ├── inquiry-service      (Express + TypeORM) — lead capture, viewing requests
  ├── s3-service           (Express) — AWS S3 signed-URL uploads / delivery
  ├── notification-service (Express + BullMQ) — email + push + in-app
  ├── subscription-service (Express + Stripe) — credit/plan billing
  └── rag-service          (FastAPI + Python) — LangGraph AI assistant
               ↕
   PostgreSQL (shared-entity library — 63 entities)
   Elasticsearch (768-dim Gemini embeddings for semantic property search)
\`\`\`

## RAG Microservice — LangGraph Multi-Agent Flow

The conversational AI assistant answers questions like "Show me 2-bedroom apartments in Dubai Marina under AED 80k/yr with parking" by:

1. **Router agent** — classifies intent (search / FAQ / policy).
2. **Elasticsearch retrieval agent** — converts the query to a 768-dim Gemini embedding, runs ANN search + keyword filters (price range, bedrooms, location, amenities).
3. **Formatter agent** — assembles the final response with property cards + direct listing links.

LangGraph's checkpointing keeps conversation history for follow-up questions.

## Shared Entity Library

63 TypeORM entities live in a shared npm package imported by all Express services, ensuring schema consistency across services without duplicating model definitions.

## Frontend

14-page Admin app: landlord management, listing approval, fraud flagging, subscription management, reports. 8-page Operator app: daily inquiry pipeline, viewing schedule, deal tracking.`,
      featured: true,
      order: 5,
      published: true,
    },

    // ── 4. Medic AI ─────────────────────────────────────────────────────────
    {
      slug: "medic-ai",
      title: "Medic AI",
      oneLiner:
        "Travel-insurance SaaS aggregator (insurers → agency partners → issuer agents).",
      role: "Owned the 34-route Partner ecosystem + built 4 role-specific portals.",
      tags: ["Express", "Prisma", "PostgreSQL", "Next.js", "pdfmake", "AWS S3"],
      stack: [
        "Node.js",
        "Express",
        "Prisma",
        "PostgreSQL",
        "Next.js",
        "pdfmake",
        "AWS S3",
        "QR verification",
        "Docker",
      ],
      metric: "34-route partner ecosystem · 4 role portals · credit facility",
      liveUrl: "https://www.tanim.ai",
      overview:
        "B2B2C insurance distribution: insurers define products, partners onboard on a credit facility, issuer agents instantly issue policies (PDF certificate + QR verification) with settlement and reporting.",
      contribution:
        "Built the 34-route Partner ecosystem (onboarding, issuer agents, configuration, credit facility + payment-proof reconciliation, partner-run policy issuance) and the 4 role portals (admin / insurer / partner / partner-employee) with role-based middleware routing and multi-step forms.",
      body: `## Architecture

\`\`\`
Express + Prisma API
  ├── Admin portal      — platform config, insurer management, partner KYC, settlement
  ├── Insurer portal    — product configuration, rate tables, commission rules
  ├── Partner portal    — agent onboarding, credit balance, policy issuance, reports
  └── Partner-employee  — issue policies, view own history
               ↕
         PostgreSQL (Prisma)
         AWS S3 (PDF certificate storage)
\`\`\`

## Partner Ecosystem (34 routes)

The partner domain is the business-critical path:

- **Onboarding** — multi-step KYC, document upload to S3, admin approval workflow.
- **Credit facility** — partners operate on a credit balance; each policy issuance deducts the premium. Low-balance alerts + auto-pause.
- **Payment-proof reconciliation** — partners upload bank transfer receipts; admin reconciles and credits the balance.
- **Policy issuance** — partner employee fills traveller details + selects product; API generates a signed PDF certificate (pdfmake) with embedded QR code pointing to a public verification endpoint; stores to S3.
- **Settlement reports** — monthly CSV breakdown per partner, per product, per issuer.

## Role-Based Middleware

A single Express middleware layer reads the JWT \`role\` claim and attaches the appropriate Prisma scope (e.g., \`partnerId\` filter) before every controller handler — keeping the business logic clean and preventing cross-partner data leakage.`,
      featured: false,
      order: 3,
      published: true,
    },

    // ── 3. Avaloq GBS ───────────────────────────────────────────────────────
    {
      slug: "avaloq-gbs",
      title: "Avaloq GBS",
      oneLiner: "MiFID II-compliant goal-based investment-advisory platform.",
      role: "Frontend developer (Angular 19) on a regulated-finance product.",
      tags: ["Angular 19", "Signals", "RxJS", "Reactive Forms", "TypeScript"],
      stack: [
        "Angular 19",
        "TypeScript",
        "RxJS",
        "Angular Signals",
        "Spring Boot",
        "Java 21",
        "PostgreSQL",
      ],
      metric: "~69 lazy routes · ~1,845 signal usages · MiFID II suitability",
      liveUrl: "https://demo-gbs.humancloud.ltd",
      overview:
        "Wealth-advisory platform — clients set financial goals, complete MiFID II risk-profiling and suitability assessment, get matched to model portfolios, review advisor proposals, and execute orders.",
      contribution:
        "Built features on the Angular 19 app using signal-based state, lazy-loaded routes, reactive forms, and RxJS; participated in code reviews under strict quality gates for regulated financial software.",
      body: `## Product Context

Avaloq GBS (Goal-Based Solutions) is a wealth-management platform for financial advisors and their clients. It must comply with MiFID II regulations — every suitability assessment, portfolio recommendation, and order must be auditable.

## Frontend Architecture

\`\`\`
Angular 19 (SSR)
  ├── ~69 lazy-loaded route modules (feature-area isolation)
  ├── ~1,845 signal usages (fine-grained reactivity, no zone.js overhead)
  ├── Reactive Forms (typed, multi-step suitability wizard)
  └── RxJS (API calls, polling, error/retry)
               ↕
Spring Boot 4 / Java 21 backend (PostgreSQL, MiFID II engine)
\`\`\`

## Angular 19 Signals in Practice

MiFID II suitability requires live recalculation as the user answers questions. Angular Signals replaced \`BehaviorSubject\` chains for the suitability state tree — the score, risk band, and product eligibility all recompute instantly without manual subscription management.

## Code Quality Gates

The project enforced strict ESLint rules, mandatory code reviews, component size limits, and accessibility (WCAG AA) — standard practice for regulated financial software shipped to multiple bank customers.`,
      featured: false,
      order: 2,
      published: true,
    },

    // ── 9. OMS ──────────────────────────────────────────────────────────────
    {
      slug: "oms",
      title: "OMS",
      oneLiner:
        "Golang + Angular HR / biometric-attendance platform (deployed to 3 client orgs).",
      role: "Full-stack engineer (intern) — backend + frontend.",
      tags: ["Go", "Gin", "GORM", "Angular 18", "PostgreSQL", "Docker"],
      stack: [
        "Go",
        "Gin",
        "GORM",
        "PostgreSQL",
        "Angular 18",
        "TypeScript",
        "RxJS",
        "Docker",
        "Kubernetes",
        "Harbor",
      ],
      metric: "24 Go REST APIs · 27 Angular components · goroutine batch",
      liveUrl: undefined,
      overview:
        "Ingests raw biometric punch files and reconstructs attendance records via a custom punch-pairing algorithm; produces muster-roll + daily/monthly reports with Excel export. Deployed to 3 client organisations.",
      contribution:
        "Built the 24-endpoint Go backend (clean architecture with Gin + GORM), goroutine-based batch processing (5,000+ records/file), a custom punch-pairing algorithm, and 27 Angular 18 components (reactive forms, RxJS, role-based routing, typed services, HTTP interceptors).",
      body: `## Architecture

\`\`\`
Angular 18 SPA
       ↕
Gin + GORM (Go) — REST API (24 endpoints)
       ↕
PostgreSQL
       ↕
Docker → Harbor container registry → GitOps K8s deployment
\`\`\`

## Punch-Pairing Algorithm

Raw biometric data arrives as a flat stream of (employee_id, timestamp, device_id) tuples. The algorithm:

1. Groups punches by employee and calendar day.
2. Sorts by timestamp.
3. Pairs the first punch of each day as IN, the last as OUT (with configurable multi-shift support).
4. Flags anomalies: unpaired punches, out-before-in sequences, duplicate device records.

Processed in goroutine fan-out — one goroutine per employee per file — allowing a 5,000-record file to process in under 2 seconds.

## Go Backend — Clean Architecture

\`\`\`
cmd/server/     — entry point, DI wiring
internal/
  domain/       — entities + repository interfaces
  usecase/      — business logic (pure Go, no HTTP)
  transport/    — Gin handlers (HTTP only)
  repository/   — GORM implementations
\`\`\`

## Angular 18 Frontend

27 components across: employee management, department config, shift settings, daily punch review, muster-roll report (with XLSX export via \`xlsx\` library), leave management, and role-based dashboards (HR admin / manager / employee).`,
      featured: false,
      order: 8,
      published: true,
    },

    // ── 8. PropertyBull ─────────────────────────────────────────────────────
    {
      slug: "propertybull",
      title: "PropertyBull",
      oneLiner:
        "4-microservice real-estate marketplace (Next.js + Express, polyglot).",
      role: "Built auth, the Property module & buyer/seller/agent portals (intern).",
      tags: [
        "Next.js",
        "Express",
        "TypeORM",
        "PostgreSQL",
        "AWS S3",
        "Jenkins",
      ],
      stack: [
        "Next.js",
        "React",
        "Node.js",
        "Express",
        "TypeORM",
        "PostgreSQL",
        "AWS S3",
        "Docker",
        "Jenkins",
        "Python",
        "Java",
      ],
      metric: "4 microservices · JWT + Google OAuth · S3 uploads",
      liveUrl: "https://app.propertybulls.ai",
      overview:
        "Real-estate platform connecting buyers, sellers, agents, and service providers — MLS data sync, AI property search, Stripe billing.",
      contribution:
        "Built authentication (JWT, bcrypt, Google OAuth), the Property module, and the buyer/seller/agent portals; integrated AWS S3 uploads; helped wire Docker + Jenkins CI/CD.",
      body: `## Architecture (Polyglot Microservices)

\`\`\`
Next.js (public site + portals)
       ↕
Express / TypeORM (main API + auth + property module)
Python service (AI property search — embedding-based)
Java service (MLS data sync — scheduled batch)
       ↕
PostgreSQL · AWS S3
\`\`\`

## Auth Module

- JWT (access + refresh, httpOnly cookies).
- bcrypt password hashing (12 rounds).
- Google OAuth 2.0 (passport-google-oauth20) with account-linking (same email → merge).
- Role claim embedded in JWT payload (buyer / seller / agent / admin).

## Property Module

CRUD for listings with rich metadata (type, bedrooms, bathrooms, amenities, geolocation). Image upload via AWS S3 signed URLs — client uploads directly to S3, then POSTs the resulting S3 key to the API.

## Role-Based Portals

- **Buyer portal** — saved searches, favourites, enquiry history, viewing scheduler.
- **Seller portal** — my listings dashboard, enquiry inbox, offer management.
- **Agent portal** — client management, listing assignments, commission tracker.`,
      featured: false,
      order: 7,
      published: true,
    },

    // ── 10. FlowDesk — CRM & Invoicing with an AI Assistant ──────────────────────────────────────────
    {
      slug: "flowdesk",
      title: "FlowDesk — CRM & Invoicing with an AI Assistant",
      oneLiner:
        "Multi-tenant CRM for freelancers: clients, a kanban deals pipeline, printable invoices, and a Gemini-powered assistant that summarizes client history and drafts follow-up emails from real CRM data.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Full-Stack",
        "AI Integration",
        "CRM",
        "SaaS",
        "Multi-Tenant",
        "Server Actions",
        "Invoicing",
      ],
      stack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite (libSQL)",
        "Tailwind CSS v4",
        "shadcn/ui",
        "Google Gemini",
        "Zod",
      ],
      metric:
        "~25 Zod-validated server actions as the entire backend — zero REST routes; AI features work with zero config via a demo-mode fallback built from real data",
      overview:
        "FlowDesk is a full-stack, multi-tenant CRM and invoicing app for freelancers and small businesses. Users manage clients with an activity timeline, move deals through a five-stage kanban pipeline, and issue auto-numbered, print-ready invoices with computed totals. An AI panel on each client profile — powered by Google Gemini 2.5 Flash — summarizes the relationship and drafts personalized follow-up emails grounded in the client's actual deals and interactions, and degrades gracefully to data-driven templates when no API key is set.",
      contribution:
        "Sole architect and developer: designed the Prisma schema (6 models, documented Restrict/Cascade delete policy, composite multi-tenant indexes, integer-paise money), built custom JWT auth from scratch (jose HS256, httpOnly cookies, Next.js 16 proxy route guard), implemented the full backend as ~25 typed Server Actions with per-user tenant isolation in every query, integrated the Gemini REST API server-side with ownership checks and a demo-mode fallback, and built the UI (kanban board, dashboard KPIs with Recharts, print-CSS invoices) on Tailwind v4 + shadcn/ui.",
      body: `FlowDesk is a CRM and invoicing platform I built end-to-end as a personal project, on Next.js 16's App Router with React Server Components and Server Actions as the entire backend — there is no REST layer. Every mutation is a typed server action validated with Zod, returning a consistent \`ActionResult\` envelope with field-level errors, and every database query is scoped by \`ownerId\` so each user's workspace is fully isolated.

## Data model & invoicing

The Prisma 7 schema (SQLite via libSQL, Postgres-swappable) covers Users, Clients, Deals, Activities, Invoices, and InvoiceItems with four enums for statuses and stages. Design decisions are documented in the schema itself: \`Restrict\` on user-owned relations to prevent silent cascade deletes, \`Cascade\` where children are meaningless without their parent, and composite indexes for the hot multi-tenant list queries. All money is stored as integer paise (INR) — no floats. Invoice totals are computed from line items at query time to avoid drift, and invoice numbers are generated server-side (\`INV-001\`, \`INV-002\`, …) per workspace, with a \`@@unique([ownerId, number])\` constraint as the race-condition net.

## Deals pipeline & app

Deals move through a five-stage kanban board (Lead → Qualified → Proposal → Won/Lost); stage changes run through a validated \`moveDealStage\` action inside \`useTransition\`. A dashboard aggregates KPIs — open pipeline value, won-this-month, outstanding invoices — with a Recharts revenue view. Auth is hand-rolled: jose-signed HS256 JWTs in an httpOnly cookie with 7-day sliding sessions, bcryptjs hashing, and route protection in Next 16's \`proxy.ts\`.

## The AI assistant

Each client profile has an AI panel with two actions, implemented as server-only functions calling Google Gemini 2.5 Flash over REST. "Summarize activity" loads the client's ten most recent deals and twenty activities (after verifying ownership) and prompts for a factual relationship summary with an explicit no-invention instruction; "Draft follow-up email" builds a personalized, subject-lined email from recent deals, interactions, and an optional goal. If the API key is missing or the call fails, both actions fall back to templated responses assembled from the same real data and flagged as demo mode in the UI — so the feature is demonstrable with zero configuration. The API key never leaves the server. Scope is honest: single-turn grounded generation, not chat, tool use, or RAG.`,
      featured: false,
      order: 9,
      published: true,
    },

    // ── 11. ShopRewards — Loyalty & Reward System ──────────────────────────────────────────
    {
      slug: "shoprewards",
      title: "ShopRewards — Loyalty & Reward System",
      oneLiner:
        "Full-stack loyalty platform for a hardware/electrical shop where tradespeople earn points for bringing customers and redeem them for rewards — built on an atomic, append-only points ledger.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Full-stack",
        "Monorepo",
        "REST API",
        "Auth & Security",
        "Database Design",
        "Loyalty / Points Engine",
        "Docker",
      ],
      stack: [
        "Next.js 14",
        "NestJS 10",
        "TypeScript",
        "Prisma",
        "PostgreSQL 16",
        "TanStack Query",
        "Tailwind CSS",
        "Docker",
        "pnpm workspaces",
      ],
      metric:
        "7 atomic point flows over an append-only ledger — balances always reconcile, never go negative",
      overview:
        "ShopRewards is a loyalty program for a hardware & electrical shop: tradespeople (electricians, plumbers, carpenters, AC technicians, contractors) earn points every time they bring an end-customer to the shop and redeem them for rewards like an iPhone 15 at 40,000 points. It ships as a pnpm monorepo — a Next.js 14 web app (marketing landing page, customer portal, admin portal), a NestJS 10 REST API (~36 endpoints, 10 modules), and a shared TypeScript package that keeps domain enums and types identical on both sides — backed by PostgreSQL via Prisma and deployed on Vercel + Render + Neon.",
      contribution:
        "Sole architect and developer of every layer: the data model (11 Prisma models around an append-only PointLedger), the points engine with a single-writer grant() that row-locks the customer (SELECT … FOR UPDATE) so balances stay consistent under concurrency, cookie-based JWT auth with rotating hashed refresh tokens and reuse-detection family revocation, the role-guarded admin and customer portals with TanStack Query and Recharts dashboards, Dockerized dev setup with a one-command bootstrap and a realistic 700-line seed, unit/e2e tests, and the production deployment with a first-party cookie proxy.",
      body: `ShopRewards models a real small-business problem: a hardware shop wants to reward the tradespeople who bring it customers. The shopkeeper (ADMIN) records each purchase and awards points; tradespeople (CUSTOMERs) track a fully transparent ledger, refer peers, collect automatic bonuses, and redeem points for catalog rewards the admin approves and fulfils.

**Architecture.** A pnpm monorepo with three workspaces: \`apps/web\` (Next.js 14 App Router, Tailwind, shadcn-style Radix UI), \`apps/api\` (NestJS 10 + Prisma 5 on PostgreSQL 16), and \`packages/shared\` (domain enums, point-economy defaults, response shapes) so frontend and backend vocabulary never drift.

**The points engine.** Every point movement in the system flows through one method — \`PointsService.grant()\` — the only code allowed to mutate a balance. It runs inside a Prisma transaction, row-locks the customer with \`SELECT … FOR UPDATE\`, rejects any movement that would go negative, and atomically writes an append-only \`PointLedger\` row (signed points, balance-after, originating transaction/redemption/admin). Seven flows sit on top: admin-awarded purchase points, redemptions with a race-safe stock decrement and immediate deduction, automatic refund-and-restock when an admin rejects, referral bonuses on signup via code, a once-per-day login bonus using double-checked locking, an idempotent 6 a.m. birthday cron, and manual admin bonuses — each atomic and audit-trailed.

**Auth & hardening.** One login endpoint resolves admins (email) or customers (email or phone), with Argon2 hashing. Sessions are httpOnly-cookie JWTs plus rotating opaque refresh tokens stored hashed; reuse of a rotated token revokes the entire token family. Helmet, strict DTO validation, global rate limiting, and problem-details errors round out the API; Next.js edge middleware mirrors role routing while the API stays the real boundary. The web data layer is 16 TanStack Query hooks over typed axios modules with a deduplicated silent-refresh interceptor.

**Shipping.** Dockerized Postgres, \`pnpm setup\` one-command bootstrap, a 727-line realistic seed, unit and e2e tests, and a live deployment: Vercel (web) proxying \`/api\` to Render (API, needed for the cron) over Neon Postgres so auth cookies stay first-party. Honest scope: a personal demo project — single shop, no SMTP, local image storage — but built on production patterns.`,
      featured: false,
      order: 10,
      published: true,
    },

    // ── 12. GaitPro — Browser-Based Gait Analysis Engine ──────────────────────────────────────────
    {
      slug: "gait-engine",
      title: "GaitPro — Browser-Based Gait Analysis Engine",
      oneLiner:
        "A zero-dependency gait & biomechanics dashboard that detects steps, computes force/joint-angle metrics, and renders a video-synced skeleton overlay — all in vanilla JavaScript.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Biomechanics",
        "Gait Analysis",
        "Data Visualization",
        "Computer Vision",
        "Signal Processing",
        "Canvas Rendering",
        "Vanilla JS",
      ],
      stack: [
        "JavaScript (ES6)",
        "HTML5 Canvas",
        "Chart.js",
        "MediaPipe Pose (upstream)",
        "CSS3",
        "FileReader / Blob API",
        "requestAnimationFrame",
        "localStorage",
      ],
      metric:
        "~6,100 lines of hand-written vanilla JS across 7 IIFE modules with exactly one runtime dependency (Chart.js) — no framework, no build step, no backend",
      overview:
        "GaitPro is a single-page, entirely client-side dashboard that turns walking data into clinical-style gait analytics. It accepts a ground-reaction-force CSV, a MediaPipe pose-landmark CSV, or one-click synthetic demo data, then detects individual steps, segments the gait cycle into stance/swing phases, computes per-step biomechanical parameters, and flags left/right asymmetries. A second pipeline overlays a color-coded skeleton on uploaded video, computes live joint angles, and classifies gait phase — all synchronized frame-accurately to playback. There is no server: files are read in-browser, analysis runs in memory, and exports are generated as client-side downloads.",
      contribution:
        "As sole developer I designed and built every layer in plain JavaScript with no framework or bundler — a namespaced IIFE module architecture with a clean public API per module. I wrote the analysis engine from scratch (threshold-based step-detection state machine, impulse via numerical integration, symmetry index, gait-cycle segmentation), modeled a physiologically realistic double-peak ground-reaction-force generator from a sum of Gaussians with Box–Muller noise, implemented dot-product joint-angle geometry and prominence-based heel-strike detection over MediaPipe's 33 landmarks, and engineered a Canvas 2D skeleton renderer synced to HTML5 video via a requestAnimationFrame loop plus a custom Chart.js playhead plugin with progressive, throttled plotting.",
      body: `## Architecture

GaitPro is deliberately dependency-light: seven vanilla-JavaScript modules, each an IIFE returning a small public API (\`GaitEngine\`, \`GaitData\`, \`SkeletonData\`, \`GaitCharts\`, \`VideoCharts\`, \`VideoPlayer\`, \`App\`), wired together by plain \`<script>\` ordering. The only third-party runtime code is Chart.js from a CDN — no React/Vue, no bundler, no npm install, no backend. The controller (\`app.js\`) holds one state object, routes six SPA views, and writes to the DOM directly with \`createElement\`/\`replaceChildren\` (never \`innerHTML\` on user data). Two analysis pipelines share one dark, CSS-variable design system: a force pipeline (CSV or synthetic → step detection → parameters → charts) and a video pipeline (video + pose CSV → skeleton overlay + live angles).

## The Engine

The analytical core is a threshold-based state machine that walks each foot's force channel, opening a stance window when force crosses a configurable threshold and keeping it only if its duration falls within valid bounds — rejecting noise spikes and preventing merged steps. Per step it derives peak force, contact time, loading rate, and impulse (a Riemann-sum integration of the force curve). It then computes mean ± sample standard deviation per foot, a left/right symmetry index (\`|L−R|/((L+R)/2)×100\`) with tiered alerts, and stance/swing gait-cycle percentages. Because settings (force threshold, step-duration limits, asymmetry threshold) are live-bound sliders, changing any of them re-runs the entire engine and repaints every view.

## Decisions

Two choices define the project. First, the synthetic **ground-reaction-force generator** models real biomechanics rather than faking noise: the classic double-hump "M-curve" is built from a sum of Gaussians (heel-strike peak ~22% stance, push-off ~78%, mid-stance valley) with exponential heel-strike/toe-off ramps, a configurable asymmetry factor, and Box–Muller Gaussian noise — realistic enough that the same detector runs identically on real and synthetic input. Second, **rendering is hand-rolled on Canvas 2D**: the skeleton overlay is drawn bone-by-bone with visibility-weighted opacity and region color-coding, driven by a requestAnimationFrame loop that maps \`video.currentTime\` to the nearest data frame for frame-accurate sync, while a custom Chart.js \`afterDraw\` plugin paints a scrub playhead and reveals angle timelines progressively as the clip plays. Content-aware CSV parsing auto-detects force vs. pose files (and converts pose ankle-height into a pseudo-force signal), and persistence uses prototype-pollution-safe key whitelisting. Scope is kept honest — force is modeled or pose-derived, not force-plate, and pose estimation runs in an upstream pipeline that emits the landmark CSV this app consumes.`,
      featured: false,
      order: 11,
      published: true,
    },

    // ── 13. MediBook — Doctor Appointment Booking Platform ──────────────────────────────────────────
    {
      slug: "medibook",
      title: "MediBook — Doctor Appointment Booking Platform",
      oneLiner:
        "Full-stack healthcare booking app where patients book real-time computed slots with a deposit flow, and doctors manage schedules from a dedicated dashboard — with double-booking prevention enforced at the database level.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Full-Stack",
        "Healthcare",
        "Booking Engine",
        "Server Actions",
        "Authentication",
        "Database Design",
        "TypeScript",
      ],
      stack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite/libSQL",
        "Tailwind CSS v4",
        "shadcn/ui",
        "Zod",
        "jose (JWT)",
      ],
      metric:
        "Zero-REST architecture: 23 typed, Zod-validated Server Actions are the entire API surface — end-to-end types from DB to UI",
      overview:
        "MediBook is a two-sided doctor-appointment platform: patients browse and filter doctors by specialty and city, pick from live bookable slots computed from each doctor's weekly recurring schedule, and book with a mock deposit payment; doctors get their own dashboard with booking management, stats, a weekly-availability editor, and profile controls. The 4-state appointment lifecycle (PENDING → CONFIRMED / CANCELLED / COMPLETED) is paired 1-1 with a payment record whose amount snapshots the fee in integer paise at booking time.",
      contribution:
        "Sole architect and developer of everything: the 5-model Prisma schema with 16 query-tuned indexes, the slot-expansion booking engine with two-layer double-booking prevention (application re-check plus a DB unique constraint catching P2002 races), custom stateless JWT auth (jose HS256, httpOnly cookie, bcrypt-12) enforced both per-action and at the edge via Next 16's proxy.ts, the transactional booking/payment flow behind a gateway-shaped payment seam, both dashboards, and the Tailwind v4 + shadcn/ui frontend.",
      body: `## Architecture

MediBook is a Next.js 16 App Router application (React 19, TypeScript 5) with **no REST API layer at all**: 23 typed server functions across 4 action modules (auth, doctors, booking, doctor-dashboard) form the entire API surface. Every action validates input with Zod and returns an \`ActionResult<T>\` discriminated union, so errors are values handled exhaustively in the UI and types flow unbroken from Prisma to React. Data lives in Prisma 7 via the libSQL driver adapter — SQLite locally, swappable to Turso/Postgres — with 5 models, 3 enums, and 16 secondary indexes tuned to the two dashboards' query patterns. Route protection runs at the edge in Next 16's \`proxy.ts\` (the middleware successor), verifying the jose-signed JWT session cookie without a database round-trip and enforcing role-based redirects (\`/doctor/*\` for doctors, \`/dashboard\` and \`/booking/*\` for any authenticated user).

## Key Engineering Decisions

**Compute slots, don't store them.** Doctors define weekly recurring availability templates (day-of-week, window, slot duration); the booking engine expands these into concrete bookable datetimes for the next 14 days, subtracts PENDING/CONFIRMED appointments fetched in a single range query, and drops past slots — no slot-row explosion in the database.

**Double-booking is a database guarantee.** Booking re-checks the slot at the application level for good UX, but the real guard is \`@@unique([doctorId, startsAt])\` — a concurrent race throws Prisma \`P2002\`, caught and mapped to a friendly "slot was just taken" message.

**Transactional money handling.** Appointment and pending payment are created atomically; confirming payment flips Payment→PAID and Appointment→CONFIRMED in one transaction. Amounts are integer paise (no float currency bugs), snapshotted onto the payment so later fee changes don't rewrite history. The payment provider sits behind a single seam module shaped like a real gateway call — currently a mock, deliberately signature-compatible with Stripe/Razorpay.

**Deliberate schema details.** Appointment user relations use \`onDelete: Restrict\` (medical records shouldn't cascade away), and the codebase carefully handles a dual-ID subtlety: availability slots reference \`DoctorProfile.id\` while appointments reference \`User.id\`.

**Honest scope:** a personal portfolio project — mock payments, no automated tests, timezone-naive clinic-local times, and seeded (not review-computed) ratings. Roughly 7,400 lines across 51 TS/TSX files, with a 432-line idempotent seed providing demo doctors, patients, and bookings.`,
      featured: false,
      order: 12,
      published: true,
    },

    // ── 14. LearnHub — Online Learning Platform (LMS) ──────────────────────────────────────────
    {
      slug: "learnhub",
      title: "LearnHub — Online Learning Platform (LMS)",
      oneLiner:
        "Full-stack LMS where students enroll, watch lessons, and unlock server-graded quizzes at 100% progress, and instructors build courses and track enrollment analytics.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Full-stack",
        "LMS",
        "Server Actions",
        "Auth & RBAC",
        "Data Modeling",
        "EdTech",
        "Type Safety",
      ],
      stack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite (libSQL)",
        "Tailwind CSS v4",
        "shadcn/ui",
        "Zod",
        "jose (JWT)",
      ],
      metric:
        "~35 typed Server Actions across 7 domain modules, 9-model Prisma schema, 13 routes — zero REST endpoints",
      overview:
        "LearnHub is a two-sided learning platform built end-to-end on Next.js 16. Students browse a filterable catalog, enroll in free or (mock-)paid courses, work through video lessons in a curriculum player with per-lesson completion tracking, and take an end-of-course quiz that unlocks only at 100% progress and is graded entirely on the server. Instructors get a role-gated area with a course builder (modules, lessons, quiz questions/options), a publish toggle, and a 30-day enrollment analytics chart. It is a personal portfolio project with deliberately honest scope: payments are mocked and data comes from a rich seed script.",
      contribution:
        "Sole architect and developer. Designed the 9-model Prisma schema with DB-level invariants (unique enrollments, one quiz per course, idempotent progress upserts) and composite indexes matching the catalog's exact filter queries; built the entire backend as ~35 typed Server Actions with Zod validation and a discriminated-union error contract; wrote a custom JWT auth layer (jose, httpOnly cookie, bcrypt) enforced both at the edge proxy and inside every action; implemented app-level row security so all 18 instructor mutations resolve ownership up the relation chain; and built the full UI with Tailwind v4, shadcn/ui, react-hook-form, and Recharts.",
      body: `LearnHub is a full-stack learning management system I built solo to explore how far the modern Next.js server-first model can go without a conventional API layer. There are no REST route handlers at all: the complete backend surface is roughly 35 typed Server Actions organized into seven domain modules (auth, courses, enrollment, learning, quiz, instructor, dashboard), giving end-to-end TypeScript types from Prisma rows to component props with no DTO drift.

### Data model
The Prisma schema has 9 models — User, Course, Module, Lesson, Enrollment, LessonProgress, Quiz, Question, Option, QuizAttempt — with invariants pushed into the database where possible: a unique (userId, courseId) pair makes double-enrollment impossible, a unique courseId enforces one quiz per course, and progress writes are idempotent upserts. Composite indexes (published+category, published+level, published+pricePaise) mirror the catalog's exact filter combinations. Progress is never stored as a percentage; a single computeProgress() helper always derives it from completed-lesson rows, so it cannot drift when instructors edit curricula. Money is integer paise with en-IN formatting — no floating-point currency.

### Correctness details
The quiz engine is the standout: correct answers (isCorrect) are never serialized to the client — the student-facing query selects only option id and text, and grading re-fetches answers server-side into a questionId → Set<optionId> map. The quiz itself stays locked until every lesson is complete, enforced in the action layer, with retakes allowed and best attempts surfaced on the dashboard.

### Auth and authorization
Sessions are custom-built (no NextAuth): jose HS256 JWTs in an httpOnly cookie, bcrypt work factor 12, and a startup guard on secret length. Enforcement is deliberately two-tier — a stateless edge proxy (Next 16's proxy.ts, the middleware replacement) handles role-based redirects without a DB round-trip, while every server action independently re-checks requireUser/requireRole. Instructor mutations add application-level row security: ownership resolvers walk each entity up to course.instructorId and throw on mismatch.

### Honest scope
This is a portfolio project, not production SaaS: payments are mocked at a clearly-marked seam, the database is SQLite via Prisma 7's libSQL driver adapter (with a documented Turso/Postgres path), demo content comes from a ~1,000-line seed, and there is no automated test suite. What it demonstrates is architecture, data-modeling, and security discipline at around 9,200 lines of hand-written TypeScript.`,
      featured: false,
      order: 13,
      published: true,
    },

    // ── 15. NestFinder — Real Estate Listing Marketplace ──────────────────────────────────────────
    {
      slug: "nestfinder",
      title: "NestFinder — Real Estate Listing Marketplace",
      oneLiner:
        "A full-stack property portal where buyers search, favourite, and enquire on listings while agents manage them from an analytics dashboard — built on Next.js 16 with zero API routes.",
      role: "Personal project — sole architect & developer",
      tags: [
        "Full-Stack",
        "Server Actions",
        "Auth & RBAC",
        "Database Design",
        "Marketplace",
        "India-Localised",
        "Server Components",
      ],
      stack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite (libSQL)",
        "Tailwind CSS v4",
        "shadcn/ui",
        "Zod",
        "Recharts",
      ],
      metric:
        "5 Prisma models · 11 routes · 21 server actions · 0 API endpoints",
      overview:
        "NestFinder is a real-estate marketplace in the 99acres mould, localised for India: buyers and renters browse properties with URL-driven filters (buy/rent, type, city, price range, bedrooms, text search), view image galleries with a lightbox and keyless OpenStreetMap embeds, save favourites, and send enquiries — even as guests. Agents get a dashboard with KPI stats and a 30-day enquiry trend chart, full listing CRUD with image ordering, and an enquiry inbox with a NEW → CONTACTED → CLOSED workflow. All prices are stored as integer paise and rendered with lakh/crore formatting.",
      contribution:
        "I built everything solo: the 5-model Prisma 7 schema with 24 indexes (including composite indexes matched to real filter combinations), a from-scratch JWT auth system (jose HS256 in an httpOnly cookie, bcrypt-12, generic login errors), Next 16 proxy.ts edge guards with role-based redirects, 21 Zod-validated server actions with a uniform ActionResult contract and agentId-scoped queries as app-level row security, the full UI (43 components on Tailwind v4 + shadcn/ui with Suspense streaming and skeletons), the Recharts dashboard, and an 804-line seed with 15 realistic listings across 5 Indian cities.",
      body: `## Architecture

NestFinder is a Next.js 16 App Router application with **no REST layer at all**: 11 pages talk to the database through 21 typed Server Actions, called directly from Server Components for reads and client components for mutations. Every boundary is typed end-to-end and validated with Zod on the server. Pages are Server Components by default — only ~30 of 54 tsx files opt into \`"use client"\`, where interactivity (gallery lightbox, filter bar, forms) demands it — and search results stream inside \`<Suspense>\` with skeleton fallbacks.

Data lives in a 5-model Prisma 7 schema (User, Property, PropertyImage, Favorite, Enquiry) on the new driver-adapter architecture: \`@prisma/adapter-libsql\` over SQLite locally, with the PostgreSQL swap path documented in \`prisma.config.ts\`. The Property model carries 13 indexes, five of them composite (\`[status, city]\`, \`[city, listingType, propertyType]\`, …) mirroring the browse page's actual query shapes.

## Key Engineering Decisions

- **Auth from scratch, defense in depth.** A jose-signed HS256 JWT in an httpOnly cookie; Next 16's \`proxy.ts\` (the middleware replacement) enforces route access at the edge with role-based redirects and \`returnUrl\`, while every server action independently re-checks \`requireUser()\`/\`requireRole()\` and scopes queries to the authenticated agent's \`agentId\` — explicit app-level row security, since SQLite has none.
- **Integer money.** Prices are paise-denominated \`Int\` columns; en-IN \`Intl.NumberFormat\` plus custom lakh/crore compaction (\`₹1.2 Cr\`) keeps floating-point out of currency entirely.
- **URL-driven search.** Filter, sort, and pagination state lives in query params, so every result set is shareable and server-rendered.
- **Deliberate edge cases.** Guest enquiries via a nullable FK with \`SetNull\`; sold/rented listings stay viewable by slug with a status badge; favourites survive status changes; slugs are made collision-proof with an id suffix; the enquiry chart fills zero-days for a gapless 30-day axis.
- **Zero-key externals.** OpenStreetMap iframe embeds and placeholder image hosts mean the repo runs on \`pnpm install\`, migrate, seed, dev — no API keys.

## Honest Notes

This is a portfolio project, not a production service: one migration, no automated tests or CI, demo image hosts, and SQLite in development. Its purpose is demonstrating current-generation Next.js architecture — Server Actions as the entire backend surface, RSC-first rendering, Prisma 7's new setup — done cleanly, end to end, by one person.`,
      featured: false,
      order: 14,
      published: true,
    },

    // ── 16. ShopSphere — E-Commerce Store + Admin Dashboard ──────────────────────────────────────────
    {
      slug: "shopsphere",
      title: "ShopSphere — E-Commerce Store + Admin Dashboard",
      oneLiner:
        "Full-stack Next.js 16 online store with a transactional, oversell-proof checkout and an admin dashboard for inventory, orders, and sales analytics.",
      role: "Personal project — sole architect & developer",
      tags: [
        "e-commerce",
        "full-stack",
        "server-actions",
        "transactions",
        "auth",
        "admin-dashboard",
        "analytics",
      ],
      stack: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Prisma 7",
        "SQLite (libSQL)",
        "Tailwind CSS v4",
        "shadcn/ui",
        "Recharts",
        "Zod",
      ],
      metric:
        "8-model Prisma schema, 12 routes, ~24 typed server actions (zero REST endpoints), ~8,000 lines of TypeScript",
      overview:
        "ShopSphere is a full-stack e-commerce app with two surfaces in one Next.js 16 codebase: a customer storefront (searchable, filterable catalog, product detail with gallery and related items, DB-backed cart, checkout, order history) and a role-guarded admin dashboard (product/inventory CRUD, an order-status pipeline, and sales analytics with KPI cards and revenue charts). It was built to demonstrate correct commerce engineering — integer-paise money, snapshot-accurate order history, and a transactional checkout that can never oversell — with payments mocked behind a single-file gateway seam designed for a drop-in Stripe/Razorpay swap.",
      contribution:
        "Sole architect and developer of everything: the 8-model Prisma 7 schema (with 20+ deliberate indexes and FK Restrict rules), the entire data layer as ~24 Zod-validated typed server actions with no REST routes, custom jose-JWT auth with role-based access enforced at both the Next.js 16 edge proxy and inside every mutating action, the three-phase transactional checkout, the storefront UI (Tailwind v4 + shadcn/ui, dark mode), the admin analytics dashboard (Recharts), and an 825-line deterministic seed script with demo users, catalog, and orders.",
      body: `## What it is

ShopSphere is a full-stack online store: customers browse a catalog with search, category and price filters, and four sort modes; manage a persistent cart; and check out with a shipping form and a mock Stripe/Razorpay payment choice. Admins get a separate role-guarded dashboard for product and inventory CRUD, an order-status pipeline (PENDING → PAID → SHIPPED → DELIVERED / CANCELLED), and sales analytics.

## The interesting engineering

**Transactional checkout that never oversells.** \`placeOrder\` runs in three phases: inside a Prisma \`$transaction\`, stock is re-validated for every cart line and the Order, OrderItems, and Payment rows are created as PENDING; the (mock) gateway call then runs *outside* the transaction — exactly where a real async payment call must sit; finally an atomic batch transaction flips Order and Payment to PAID, decrements stock per line, and clears the cart, all-or-nothing.

**Data integrity by design.** All money is integer paise — no floating-point currency anywhere. OrderItems store name and unit-price snapshots taken at purchase time, so history survives renames and repricing. Products referenced by orders are protected by \`onDelete: Restrict\`, and the admin delete action catches Prisma's P2003 error and returns a friendly "has existing orders — set stock to 0" message. The cart is one UPSERT row per (user, product), enforced by a unique constraint.

**Server actions instead of a REST layer.** The entire API surface is ~24 typed server actions. Every action validates input with Zod (cuid IDs, quantity bounds, price constraints) and returns a discriminated-union \`ActionResult\` — never a thrown error — with field errors mapping directly onto React Hook Form.

**Defense-in-depth auth.** Custom JWT sessions (jose HS256 in an httpOnly cookie, bcrypt work factor 12) are enforced twice: a Next.js 16 edge proxy handles redirects, while every mutating action independently calls \`requireUser\`/\`requireRole\`. Roles are assigned server-side only, and login errors are enumeration-safe.

**Admin analytics.** KPI cards computed from seven parallel Prisma aggregates, a zero-filled daily revenue series rendered with Recharts, and a \`groupBy\` order-status breakdown.

## Honest scope

A personal portfolio project by a sole developer. Payments are mocked behind a single-file provider seam; the database is SQLite via Prisma 7's libSQL driver adapter, swappable to PostgreSQL for production; there is no automated test suite.`,
      featured: false,
      order: 15,
      published: true,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      update: {},
      create: { ...project, createdById },
    });
  }
  console.log(`  ✓ Projects (${projects.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BLOG POSTS  (step3 §4)
//  coverImage removed — images uploaded via Cloudinary after seed.
// ─────────────────────────────────────────────────────────────────────────────

async function seedBlogPosts(createdById: string): Promise<void> {
  const posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    tags: string[];
    body: string;
    readingTime: number;
    published: boolean;
    publishedAt: Date;
  }> = [
    // ── Post 1: SCB Monte Carlo ──────────────────────────────────────────────
    {
      slug: "bank-grade-monte-carlo-cholesky-gbm-tensorflow",
      title:
        "Building a bank-grade Monte Carlo engine: Cholesky-correlated GBM in TensorFlow",
      excerpt:
        "How I designed and built a production Monte Carlo simulation platform for Siam Commercial Bank — covering Cholesky decomposition, correlated GBM paths, TensorFlow vectorisation, FastAPI + ARQ async architecture, and ~1,242 tests.",
      tags: [
        "Python",
        "TensorFlow",
        "Monte Carlo",
        "FastAPI",
        "Fintech",
        "Architecture",
      ],
      readingTime: 12,
      published: true,
      publishedAt: new Date("2025-03-15"),
      body: `## Why Monte Carlo?

Goal-based investment advice needs to answer: *"Given this portfolio and my monthly contributions, what is the probability of reaching ₿ 5M in 15 years?"* Closed-form solutions (like the Black-Scholes formula) work for single assets in idealised conditions, but real portfolios hold multiple correlated assets, and real markets have fat tails that simple lognormal assumptions miss.

Monte Carlo solves this by simulating thousands of possible futures — sampling random paths for each asset, computing portfolio values along each path, and reading off the distribution of outcomes. At the bank, we returned 10th/50th/90th-percentile scenarios and a goal-achievement probability.

## The Correlation Problem

Standard GBM (Geometric Brownian Motion) assumes each asset follows:

\`\`\`
dS = μS dt + σS dW
\`\`\`

where \`dW\` is an independent Wiener increment. Independence is wrong for a real portfolio — equities and bonds are negatively correlated; assets in the same sector move together. Simulating them independently underestimates diversification and overstates tail-risk in some scenarios while understating it in others.

The fix is **Cholesky decomposition** of the historical covariance matrix.

## The Cholesky Trick

Given a covariance matrix \`Σ\` (N × N, for N assets), Cholesky factorises it as:

\`\`\`
Σ = L Lᵀ
\`\`\`

where \`L\` is lower-triangular. To generate correlated Wiener increments:

1. Sample \`Z ~ N(0, I)\` (independent standard normals, shape: paths × time_steps × N).
2. Compute \`Z_corr = Z @ Lᵀ\` (matrix multiply; shape unchanged).
3. Use \`Z_corr\` in the GBM update — the assets now have the correct covariance structure.

In TensorFlow this vectorises naturally across all paths simultaneously:

\`\`\`python
L = tf.linalg.cholesky(covariance_matrix)       # (N, N)
Z = tf.random.normal([n_paths, n_steps, N])      # independent draws
Z_corr = Z @ tf.transpose(L)                     # correlated draws

# GBM update (log-space, vectorised)
log_returns = (mu - 0.5 * sigma**2) * dt + sigma * tf.sqrt(dt) * Z_corr
log_prices = tf.cumsum(log_returns, axis=1)      # (n_paths, n_steps, N)
prices = S0 * tf.exp(log_prices)                 # absolute prices
\`\`\`

Running 10,000 paths over 180 monthly time-steps across 12 assets completes in ~800 ms on a single CPU — well within the API's SLA.

## FastAPI + ARQ Async Architecture

Simulations are expensive. We don't want the HTTP request to block for 800 ms — especially under load. The solution: **enqueue, don't block**.

\`\`\`
POST /simulate
  → validate inputs
  → enqueue ARQ job (store job_id in Redis)
  → return { job_id }

GET /simulate/{job_id}/status
  → check Redis key
  → return { status: "pending" | "running" | "done" | "failed", result? }
\`\`\`

ARQ (Async Redis Queue) is a lightweight Python job queue built on asyncio + Redis. Each simulation job is:
- **Idempotent** — the job function checks whether results already exist in Oracle before running.
- **Retried automatically** — ARQ retries failed jobs up to 3 times with exponential backoff.
- **Observable** — job state is written to a Redis key at each stage; the status endpoint is a simple cache read.

## Data Pipeline: SFTP → Oracle

Before the engine can simulate anything, it needs today's fund prices and FX rates. The data-pull service:
1. Connects to the bank's SFTP server and lists new files (by modification date).
2. Downloads each file and verifies the HMAC-SHA256 signature provided in a sidecar manifest.
3. Pushes verified files to a staging directory.

The data-sync service then:
1. Reads each staging file, parses CSV/XLSX columns, validates against the expected schema.
2. Applies FX conversion (all prices normalised to THB using the day's FX rate).
3. Upserts into Oracle using SQLAlchemy Core — the upsert is idempotent on (fund_id, price_date), so re-running on the same file is safe.

## Testing: ~1,242 Tests

The test suite breaks down as:
- **Unit (~900)** — GBM math assertions (zero-vol → deterministic path; identity covariance → uncorrelated), FX conversion edge-cases (zero rate, missing rate fallback), data-sync validation rules.
- **Integration (~280)** — end-to-end pipeline with a mocked SFTP server (paramiko's \`ServerInterface\`) and an in-memory SQLite standing in for Oracle.
- **Load (~62)** — benchmarking N=10,000 path simulations at concurrency=10; verifying p95 latency < 3 s.

## Key Lessons

1. **Always work in log-space for GBM.** Computing \`exp(cumsum(log_returns))\` avoids numerical blow-up that can occur with direct multiplication of many (1 + r) terms.
2. **Covariance matrix conditioning matters.** Historical covariance matrices can be near-singular; adding a small diagonal jitter (\`Σ + εI\`) prevents Cholesky from failing on ill-conditioned inputs.
3. **ARQ over Celery for async Python.** Celery's complexity (separate result backend config, serialisation quirks, beat scheduler) was unnecessary for this use-case. ARQ's 200-line source is easy to reason about and debug.
4. **Talk to the client early and often.** The bank's team had specific requirements around decimal precision (8 decimal places for THB prices) and date handling (Thai fiscal year conventions) that weren't in the initial spec. Two short calls surfaced these before they became bugs in production.`,
    },

    // ── Post 2: Teamcast 148 models ──────────────────────────────────────────
    {
      slug: "designing-148-model-multi-tenant-hiring-platform",
      title: "Designing a 148-model multi-tenant hiring platform",
      excerpt:
        "How Teamcast's data model handles multi-tenancy, a 3-stage AI assessment funnel, Express as system-of-record alongside Convex for real-time, and BullMQ for background work — at 148 Prisma models.",
      tags: [
        "PostgreSQL",
        "Prisma",
        "Multi-tenancy",
        "Express",
        "Architecture",
        "Hiring",
      ],
      readingTime: 10,
      published: true,
      publishedAt: new Date("2025-04-10"),
      body: `## The Problem Space

Teamcast is a full hiring-lifecycle SaaS: a company (client) posts jobs, candidates apply, go through a multi-stage AI assessment funnel, do a LiveKit video interview, and get hired — all in one platform. Multiple companies use the same platform simultaneously (multi-tenancy). The data model has to support all of this without cross-tenant leakage, while keeping query performance acceptable at scale.

## Rooting Multi-Tenancy at \`Company\`

Every entity that belongs to a company carries a \`companyId\` foreign key. The Express middleware pipeline attaches the authenticated company's ID to \`req.context\` after JWT verification, and every Prisma query includes \`where: { companyId: req.context.companyId }\`.

This "application-level tenancy" pattern is simpler than PostgreSQL Row-Level Security for a Node.js/Express app — you don't need session variables or a PL/pgSQL policy layer. The tradeoff: you must discipline every query to include the tenant filter (a linting rule and an integration test suite that tests with two tenants simultaneously provides the safety net).

## The 148-Model Breakdown

At 148 models you'd expect a sprawling mess. In practice the models cluster into clear domains:

| Domain | Model count | Core entities |
|---|---|---|
| Company & auth | 8 | Company, User, Role, Invite, ApiKey |
| Jobs & pipeline | 18 | Job, Pipeline, Stage, StageTemplate |
| Candidates | 14 | Candidate, Application, ApplicationStatus |
| Assessments | 32 | Assessment, QuestionBank, Question, Submission, Score |
| Interviews | 22 | Interview, LiveKitSession, ProctorEvent, Recording |
| Billing | 19 | Subscription, Plan, CreditBalance, Invoice, Webhook |
| ATS integrations | 15 | AtsConnection, AtsSync, CandidateImport |
| Analytics | 12 | Funnel, Conversion, SourceAttribution |
| Misc | 8 | Notification, AuditLog, FeatureFlag |

The size comes from the assessment domain — supporting multiple question types (MCQ, coding, video, written), scoring rubrics, anti-cheat signals, and per-stage pass thresholds at a per-company configuration level generates a lot of models.

## Express as System-of-Record + Convex for Real-Time

This is the most interesting architectural decision. We use **two separate persistence layers**:

- **Express + Prisma + PostgreSQL** — the authoritative source of truth. All mutations (create job, submit assessment, update application status) go through Express. This layer owns consistency.
- **Convex** — a real-time database used for notifications and live interview state. When Express updates an application status, it also writes to a Convex document. The client subscribes to Convex and sees the change instantly without polling.

Why not use Convex for everything? Convex's query API is powerful for real-time but harder to reason about for complex relational queries (joining 148 models across 6 domains). Postgres + Prisma handles that naturally.

## The 3-Stage Assessment Funnel

Each job has a configurable Pipeline of Stages. A candidate moves through stages in order; failing a stage exits them from the funnel. A typical pipeline:

\`\`\`
Stage 1: Screening MCQ (auto-scored, instant)
Stage 2: Coding challenge (auto-scored, 60-min window)
Stage 3: Live interview (LiveKit, AI-proctored)
\`\`\`

The Submission model captures a candidate's answers; a Score model stores the computed score. The pass threshold is a per-Stage, per-Company configuration — not hardcoded. BullMQ workers handle scoring asynchronously (calling Vertex AI for subjective questions), so candidates get results without waiting for an HTTP response.

## BullMQ Workers

Heavy operations run in BullMQ queues on a separate PM2 process:
- **ai-scoring** — sends submissions to Vertex AI, writes Score back to Postgres.
- **candidate-import** — parses CSV/ATS webhook payloads, deduplicates against existing Candidate rows (by email + companyId), creates Application rows.
- **email** — interview invites, stage advancement notifications, offer letters.
- **ats-sync** — periodic sync of application status back to connected ATS (Greenhouse, Lever, Workday).

## Lessons

1. **Index every FK column.** With 148 models and hundreds of JOINs, a missing FK index will surface as a slow query the moment you have real data.
2. **Centralise the tenant filter.** A single \`withTenant(companyId)\` Prisma extension middleware that wraps every model's \`findMany / findFirst / update / delete\` saves you from ever forgetting the filter.
3. **Keep Convex writes in the Express service layer, not in the controller.** If the Convex write fails, it should not fail the API response — wrap it in a fire-and-forget try/catch. The source of truth is Postgres; Convex is an eventually-consistent projection.`,
    },

    // ── Post 3: Meet Scribe Playwright bots ──────────────────────────────────
    {
      slug: "three-playwright-bots-join-your-meetings",
      title:
        "3 Playwright bots that silently join your meetings (Teams / Zoom / Meet)",
      excerpt:
        "The engineering behind Meet Scribe's headless meeting bots — per-platform Playwright automation, PulseAudio/FFmpeg audio capture to GCS, and Gemini speaker diarization — and all the quirks that made it hard.",
      tags: [
        "Playwright",
        "Node.js",
        "Gemini",
        "GCS",
        "Automation",
        "Architecture",
      ],
      readingTime: 11,
      published: true,
      publishedAt: new Date("2025-05-01"),
      body: `## The Idea

Meet Scribe is an AI notetaker. You invite a bot to your meeting; it joins silently, captures everything, and produces a diarized transcript, summary, and MOM draft. The engineering challenge: reliably automate three different meeting platforms (Microsoft Teams, Zoom, Google Meet) — each with different DOM structures, authentication flows, and audio APIs — without any official SDK access.

## Architecture Overview

\`\`\`
Meeting invite received
       ↓
BullMQ "dispatch-bot" job
       ↓
bot-service picks up the job
  ├── Playwright launches Chromium in a virtual display (Xvfb)
  ├── Adapter joins the meeting (platform-specific)
  ├── PulseAudio virtual sink captures audio
  └── FFmpeg pipes audio chunks → GCS (rolling 30-second segments)
       ↓
Meeting ends (bot detects "call ended" DOM state)
       ↓
BullMQ "transcribe" job
  ├── Download all GCS segments
  ├── Google Cloud Speech → timed transcript segments
  └── Gemini → speaker diarization + summary
       ↓
CRM sync + MOM email
\`\`\`

## Per-Platform Adapters

Each adapter is a Playwright script with a consistent interface:

\`\`\`typescript
interface MeetingAdapter {
  join(url: string, displayName: string): Promise<void>;
  waitForEnd(): Promise<void>;
  cleanup(): Promise<void>;
}
\`\`\`

### Google Meet

Meet is the most stable. The join flow is:
1. Navigate to the meeting URL.
2. Dismiss the "Join with your browser" prompt (prefer browser to avoid plugin requirements).
3. Click "Ask to join" / "Join now".
4. Wait for the participant list to appear (signals successful join).
5. Detect end: poll for "You've left the meeting" overlay every 5 seconds.

The tricky part: Meet aggressively blocks headless Chromium with a "Your browser isn't supported" banner. The fix: set a real Chrome user-agent string and pass \`--disable-blink-features=AutomationControlled\` to the Chromium launch args.

### Zoom

Zoom is the hardest. Their web client DOM changes frequently — we've had to update selectors after 3 Zoom updates in 8 months. The join flow:
1. Navigate to the Zoom web client URL (\`/wc/{meeting_id}/join\`).
2. Fill display name, click "Join".
3. Handle the "Open Zoom?" native dialog — Playwright intercepts and dismisses it by mocking the \`window.open\` call.
4. Dismiss audio/video permission dialogs.
5. Detect end: Zoom renders a "This meeting has ended" modal.

We wrap every selector in a retry loop with a 30-second timeout and a structured error class (\`ZoomJoinError\`, \`ZoomEndDetectionError\`) so the BullMQ job can retry intelligently.

### Microsoft Teams

Teams uses a React SPA with frequently changing CSS module class names — you can't rely on class selectors. The fix: attribute-based selectors (\`[data-tid="join-btn"]\`) and ARIA role selectors (\`role=button, name="Join now"\`). Microsoft does maintain \`data-tid\` attributes across versions (it's their own test hook convention).

Teams also requires the bot to "knock" and wait for a meeting organiser to admit it — we implemented a 120-second polling loop watching for the lobby state to clear.

## Audio Capture: PulseAudio + FFmpeg

The browser's Web Audio API requires user gesture to start — you can't capture audio from a headless bot via the browser's microphone API. The solution: a virtual audio pipeline at the OS level.

\`\`\`
Chromium audio output
       ↓
PulseAudio virtual sink (null-sink)
       ↓
PulseAudio monitor source (loopback of the null-sink)
       ↓
FFmpeg (reads monitor source, encodes to Opus 48kHz)
       ↓
Rolling 30-second GCS uploads (via @google-cloud/storage stream upload)
\`\`\`

Each GCS object is named \`{jobId}/{segment_index}.opus\` — making it trivial to reassemble in order for transcription.

## Speaker Diarization with Gemini

Google Cloud Speech-to-Text returns a flat transcript with \`speakerTag\` integers (1, 2, 3...). We don't know which speaker tag corresponds to which participant. Gemini bridges this gap:

\`\`\`
System prompt:
  You are a transcript formatter. Given a meeting transcript with speaker tags
  and a participant list, map each speaker tag to a participant name and return
  a clean formatted transcript.

User prompt:
  Participants: Alice Chen, Bob Malhotra, Rohit Malviya
  Transcript:
  [00:00] speaker_1: Good morning everyone...
  [00:05] speaker_2: Morning! Let's start with...
  ...
\`\`\`

Gemini is remarkably good at this — it uses speech patterns, first mentions ("Hi Alice"), and context to make confident mappings. We also ask Gemini in the same call to produce: (a) a structured summary, (b) a list of action items with owners, and (c) a MOM draft in markdown.

## Lessons

1. **Attribute selectors over class selectors** for automation resilience. CSS module classes are build-time artefacts; \`data-*\` attributes are intentional API surfaces.
2. **Virtual display + virtual audio sink** is the only reliable headless audio capture approach — browser APIs won't help you.
3. **Expect platform updates to break your bots.** Build a monitoring job that runs a "smoke join" against a test meeting every 24 hours and alerts on failure. We've caught 3 regressions this way before customers reported them.
4. **Rolling GCS segments over one big file.** If the meeting runs for 3 hours and the upload fails at 2:55:00, you lose everything with a single-file approach. Rolling 30-second segments means you lose at most 30 seconds.`,
    },
  ];

  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        ...post,
        tags: post.tags ?? [],
        createdById,
      },
    });
  }
  console.log(`  ✓ BlogPosts (${posts.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MEDIA  —  starts empty. All images are uploaded via Cloudinary in the app;
//  no local/dummy assets are seeded.
// ─────────────────────────────────────────────────────────────────────────────

async function seedMedia(): Promise<void> {
  // Preserve section-linked placeholder media (gallery images are managed in seedPages).
  await prisma.media.deleteMany({
    where: { OR: [{ ownerType: null }, { ownerType: { not: "section" } }] },
  });
  console.log(
    "  ✓ Media (non-section rows cleared — upload real assets via Cloudinary)",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION  — admin-editable dropdown option sets
// ─────────────────────────────────────────────────────────────────────────────

async function seedConfig(): Promise<void> {
  const sets: {
    key: string;
    label: string;
    items: { value: string; label: string }[];
  }[] = [
    {
      key: "contact_link_types",
      label: "Contact link types",
      items: [
        { value: "email", label: "Email" },
        { value: "phone", label: "Phone" },
        { value: "website", label: "Website" },
        { value: "linkedin", label: "LinkedIn" },
        { value: "github", label: "GitHub" },
        { value: "twitter", label: "X (Twitter)" },
        { value: "instagram", label: "Instagram" },
        { value: "youtube", label: "YouTube" },
        { value: "medium", label: "Medium" },
        { value: "dribbble", label: "Dribbble" },
        { value: "telegram", label: "Telegram" },
        { value: "resume", label: "Resume / CV" },
      ],
    },
    {
      key: "social_link_types",
      label: "Social link types",
      items: [
        { value: "website", label: "Website" },
        { value: "linkedin", label: "LinkedIn" },
        { value: "github", label: "GitHub" },
        { value: "twitter", label: "X (Twitter)" },
        { value: "instagram", label: "Instagram" },
        { value: "youtube", label: "YouTube" },
        { value: "medium", label: "Medium" },
        { value: "dribbble", label: "Dribbble" },
        { value: "telegram", label: "Telegram" },
        { value: "email", label: "Email" },
      ],
    },
    {
      key: "skill_groups",
      label: "Skill groups",
      items: [
        { value: "LANGUAGES", label: "Languages" },
        { value: "FRONTEND", label: "Frontend" },
        { value: "BACKEND", label: "Backend" },
        { value: "DATA", label: "Data" },
        { value: "CLOUD_DEVOPS", label: "Cloud / DevOps" },
        { value: "AI", label: "AI" },
      ],
    },
  ];

  for (const s of sets) {
    await prisma.configuration.upsert({
      where: { key: s.key },
      update: { label: s.label, items: s.items },
      create: { key: s.key, label: s.label, items: s.items },
    });
  }
  console.log(`  ✓ Configuration (${sets.length} option sets)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGES + SECTIONS  (system pages + Home page sections)
// ─────────────────────────────────────────────────────────────────────────────

async function seedPages(createdById: string): Promise<void> {
  // ── System pages ──────────────────────────────────────────────────────────

  const systemPages: Array<{
    slug: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    navLabel: string;
    navOrder: number;
    showInNav: boolean;
    isSystem: boolean;
    published: boolean;
  }> = [
    {
      slug: "home",
      title: "Home",
      metaTitle: "Rohit Malviya — Full-Stack Engineer",
      metaDescription:
        "Full-stack engineer (2+ yrs) building production SaaS & bank-grade systems across TypeScript, Go, Python & Java. Architected a Monte Carlo platform for Siam Commercial Bank.",
      navLabel: "Home",
      navOrder: 0,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "projects",
      title: "Projects",
      metaTitle: "Production Systems",
      metaDescription:
        "9 professional platforms shipped at Humancloud Technologies — fintech, AI hiring, real-estate, insurance, meeting automation — plus 7 self-driven personal builds across e-commerce, healthcare, ed-tech, CRM + AI, loyalty systems, and biomechanics.",
      navLabel: "Work",
      navOrder: 1,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "blog",
      title: "Blog",
      metaTitle: "Writing",
      metaDescription:
        "Technical deep-dives on production systems, architecture decisions, and the craft of shipping software.",
      navLabel: "Blog",
      navOrder: 2,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "experience",
      title: "Experience",
      metaTitle: "Experience",
      metaDescription:
        "Where I've shipped production software — roles, companies, and the systems I built.",
      navLabel: "Experience",
      navOrder: 3,
      showInNav: true,
      isSystem: false,
      published: true,
    },
    {
      slug: "education",
      title: "Education",
      metaTitle: "Education",
      metaDescription: "Degrees, institutions, and academic background.",
      navLabel: "Education",
      navOrder: 4,
      showInNav: true,
      isSystem: false,
      published: true,
    },
    {
      slug: "skills",
      title: "Skills",
      metaTitle: "Skills",
      metaDescription:
        "Languages, frameworks, and tools I work with across the stack.",
      navLabel: "Skills",
      navOrder: 5,
      showInNav: true,
      isSystem: false,
      published: true,
    },
    {
      slug: "achievements",
      title: "Achievements",
      metaTitle: "Achievements",
      metaDescription:
        "Awards, recognition, and milestones from my journey so far.",
      navLabel: "Achievements",
      navOrder: 6,
      showInNav: true,
      isSystem: false,
      published: true,
    },
    {
      slug: "contact",
      title: "Contact",
      metaTitle: "Contact — Rohit Malviya",
      metaDescription:
        "Get in touch with Rohit Malviya — full-stack engineer based in Pune, India.",
      navLabel: "Contact",
      navOrder: 7,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "showcase",
      title: "Showcase",
      metaTitle: "Section Showcase",
      metaDescription: "Every section type, for review.",
      navLabel: "Showcase",
      navOrder: 8,
      showInNav: true,
      isSystem: false,
      published: true,
    },
  ];

  for (const pageData of systemPages) {
    await prisma.page.upsert({
      where: { slug: pageData.slug },
      update: {
        navLabel: pageData.navLabel,
        navOrder: pageData.navOrder,
        showInNav: pageData.showInNav,
        published: pageData.published,
      },
      create: { ...pageData, createdById },
    });
  }
  console.log(`  ✓ Pages (${systemPages.length} system pages)`);

  // ── Home page sections ────────────────────────────────────────────────────

  const homePage = await prisma.page.findUniqueOrThrow({
    where: { slug: "home" },
  });

  const existingSectionCount = await prisma.section.count({
    where: { pageId: homePage.id },
  });

  if (existingSectionCount === 0) {
    const sections: Array<{
      type: string;
      order: number;
      enabled: boolean;
      data: Prisma.InputJsonValue;
    }> = [
      {
        type: "HERO",
        order: 0,
        enabled: true,
        data: {
          eyebrow: "// FULL-STACK ENGINEER · PUNE, INDIA",
          name: "Rohit Malviya.",
          gradientLine: "I build production systems.",
          subhead:
            "From a bank-grade Monte Carlo engine to multi-tenant SaaS platforms — I ship across TypeScript, Go, Python & Java. 2+ years turning hard problems into shipped products at Humancloud Technologies.",
          buttons: [
            { label: "View Résumé", href: "/resume.pdf", style: "primary" },
            {
              label: "GitHub",
              href: "https://github.com/rohithumancloud",
              style: "ghost",
            },
            {
              label: "LinkedIn",
              href: "https://linkedin.com/in/rohitbmalviya",
              style: "ghost",
            },
            {
              label: "Email",
              href: "mailto:rohitbmalviya@gmail.com",
              style: "ghost",
            },
          ],
          metrics: [
            { value: "8", label: "production platforms" },
            { value: "5", label: "languages shipped" },
            { value: "Bank-grade", label: "fintech" },
            { value: "2+", label: "years" },
          ],
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "ABOUT",
        order: 1,
        enabled: true,
        data: {
          heading: "01 — about",
          paragraphs: [
            "I'm a full-stack engineer at Humancloud Technologies (Pune). In 2+ years I've shipped production software across hiring, fintech, real-estate, insurance, and meeting-AI — comfortable owning a feature from the database to the pixel.",
            "I work across the stack and across languages: Angular & Next.js on the front; Express, FastAPI, Spring Boot & Go on the back; PostgreSQL & Oracle for data; Docker, Kubernetes & Helm to ship it. My favourite work sits where the problem is genuinely hard — like architecting a bank-grade Monte Carlo simulation platform for Siam Commercial Bank (TensorFlow GBM with Cholesky-correlated paths, over Oracle, end to end).",
            'I care about correctness, clean architecture, and actually shipping. I hold a B.E. in AI & Data Science (CGPA 8.9) and earned Humancloud\'s "Going Beyond" award for delivering critical production features.',
          ],
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "SKILLS",
        order: 2,
        enabled: true,
        data: {
          heading: "02 — skills",
          source: "skills-table",
          cta: { label: "View all skills", href: "/skills" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "EXPERIENCE",
        order: 3,
        enabled: true,
        data: {
          heading: "03 — experience",
          source: "experience-table",
          cta: { label: "View all experience", href: "/experience" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "FEATURED_PROJECTS",
        order: 4,
        enabled: true,
        data: {
          heading: "04 — featured work",
          auto: "featured",
          limit: 4,
          cta: { label: "View all projects", href: "/projects" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "BLOG_TEASER",
        order: 6,
        enabled: true,
        data: {
          heading: "06 — from the blog",
          limit: 3,
          cta: { label: "View all posts", href: "/blog" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "ACHIEVEMENTS",
        order: 7,
        enabled: true,
        data: {
          heading: "07 — recognition",
          source: "achievements-table",
          cta: { label: "View all achievements", href: "/achievements" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "EDUCATION",
        order: 8,
        enabled: true,
        data: {
          heading: "08 — education",
          items: [
            {
              degree: "B.E. in Artificial Intelligence & Data Science",
              school: "Zeal College of Engineering & Research, Pune",
              period: "2021 – 2024",
              detail: "CGPA 8.9 / 10",
            },
          ],
          cta: { label: "View all education", href: "/education" },
        } satisfies Prisma.InputJsonValue,
      },
      {
        type: "CONTACT",
        order: 9,
        enabled: true,
        data: {
          heading: "Let's build something.",
          blurb:
            "Open to senior full-stack / backend / fintech roles. The fastest way to reach me is email — I reply quickly.",
          showForm: false,
          email: "rohitbmalviya@gmail.com",
          socials: {
            github: "https://github.com/rohithumancloud",
            linkedin: "https://linkedin.com/in/rohitbmalviya",
          },
          resumeUrl: "",
        } satisfies Prisma.InputJsonValue,
      },
    ];

    for (const section of sections) {
      await prisma.section.create({
        data: {
          pageId: homePage.id,
          type: section.type as never,
          order: section.order,
          enabled: section.enabled,
          data: section.data,
        },
      });
    }
    console.log(`  ✓ Home page sections (${sections.length} sections)`);
  } else {
    console.log(`  ✓ Home page sections (already seeded — skipped)`);
  }

  // ── Collection list pages → a single flexible CONTENT_BLOCK ────────────────
  // Each collection gets a dedicated CMS page (projects, blog, experience,
  // education, skills, achievements). The page is a CONTENT_BLOCK — heading +
  // blurb + the collection rendered as cards (mode 'all' = every item) — served
  // by the dynamic [slug] page. Cards link through to their detail pages.
  const listBlocks: Array<{
    slug: string;
    source: string;
    heading: string;
    paragraph: string;
  }> = [
    {
      slug: "projects",
      source: "projects",
      heading: "Production Systems",
      paragraph:
        "9 professional platforms shipped at Humancloud Technologies — fintech, AI hiring, real-estate, insurance, meeting automation — plus 7 self-driven personal builds across e-commerce, healthcare, ed-tech, CRM + AI, loyalty systems, and biomechanics.",
    },
    {
      slug: "blog",
      source: "blog",
      heading: "Writing",
      paragraph:
        "Technical deep-dives on production systems, architecture decisions, and the craft of shipping software.",
    },
    {
      slug: "experience",
      source: "experience",
      heading: "Experience",
      paragraph:
        "Roles where I've owned production systems end to end — click any entry for the full story.",
    },
    {
      slug: "education",
      source: "education",
      heading: "Education",
      paragraph: "Degrees and institutions that shaped my foundation.",
    },
    {
      slug: "skills",
      source: "skills",
      heading: "Skills",
      paragraph:
        "The languages, frameworks, and tools I reach for across the stack.",
    },
    {
      slug: "achievements",
      source: "achievements",
      heading: "Achievements",
      paragraph: "Awards, recognition, and milestones along the way.",
    },
  ];

  for (const lb of listBlocks) {
    const page = await prisma.page.findUniqueOrThrow({
      where: { slug: lb.slug },
    });
    const count = await prisma.section.count({ where: { pageId: page.id } });
    if (count === 0) {
      await prisma.section.create({
        data: {
          pageId: page.id,
          type: "CONTENT_BLOCK" as never,
          order: 0,
          enabled: true,
          data: {
            heading: lb.heading,
            paragraphs: [lb.paragraph],
            source: lb.source,
            mode: "all",
          } satisfies Prisma.InputJsonValue,
        },
      });
      console.log(`  ✓ ${lb.slug} page CONTENT_BLOCK seeded`);
    } else {
      console.log(`  ✓ ${lb.slug} page sections (already seeded — skipped)`);
    }
  }

  // ── Contact page → CONTACT section ───────────────────────────────────────
  const contactPage = await prisma.page.findUniqueOrThrow({
    where: { slug: "contact" },
  });
  const contactSectionCount = await prisma.section.count({
    where: { pageId: contactPage.id },
  });
  if (contactSectionCount === 0) {
    await prisma.section.create({
      data: {
        pageId: contactPage.id,
        type: "CONTACT" as never,
        order: 0,
        enabled: true,
        data: {
          heading: "Let's build something.",
          blurb:
            "Open to senior full-stack / backend / fintech roles. Send me a message — I reply quickly.",
          showForm: true,
          email: "rohitbmalviya@gmail.com",
          socials: {
            github: "https://github.com/rohithumancloud",
            linkedin: "https://linkedin.com/in/rohitbmalviya",
          },
        } satisfies Prisma.InputJsonValue,
      },
    });
    console.log("  ✓ Contact page CONTACT section seeded");
  } else {
    console.log("  ✓ Contact page sections (already seeded — skipped)");
  }

  // ── Showcase page → every remaining section type ──────────────────────────
  const showcasePage = await prisma.page.findUniqueOrThrow({
    where: { slug: "showcase" },
  });
  const showcaseSectionCount = await prisma.section.count({
    where: { pageId: showcasePage.id },
  });
  if (showcaseSectionCount === 0) {
    await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "METRICS" as never,
        order: 0,
        enabled: true,
        data: {
          items: [
            { value: "8", label: "platforms" },
            { value: "5", label: "languages" },
            { value: "2+", label: "years" },
            { value: "1,242", label: "tests (SCB)" },
          ],
        } satisfies Prisma.InputJsonValue,
      },
    });

    await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "RICH_TEXT" as never,
        order: 1,
        enabled: true,
        data: {
          heading: "Rich Text",
          body: "A **markdown** block: supports _emphasis_, lists, and links. Used for long-form content between sections.",
        } satisfies Prisma.InputJsonValue,
      },
    });

    await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "PROJECTS_GRID" as never,
        order: 2,
        enabled: true,
        data: {
          heading: "Projects Grid",
          filter: "all",
          cta: { label: "View all projects", href: "/projects" },
        } satisfies Prisma.InputJsonValue,
      },
    });

    await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "CONTENT_BLOCK" as never,
        order: 3,
        enabled: true,
        data: {
          eyebrow: "// CONTENT BLOCK",
          heading: "Flexible Content Block",
          paragraphs: [
            "A text-only content block.",
            "It can also render any collection as cards — see the Projects/Blog/Experience pages.",
          ],
          align: "center",
        } satisfies Prisma.InputJsonValue,
      },
    });

    // GALLERY — capture id so we can link the placeholder media rows
    const gallerySection = await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "GALLERY" as never,
        order: 4,
        enabled: true,
        data: {
          heading: "Gallery",
        } satisfies Prisma.InputJsonValue,
      },
    });

    await prisma.section.create({
      data: {
        pageId: showcasePage.id,
        type: "CTA" as never,
        order: 5,
        enabled: true,
        data: {
          heading: "Call To Action",
          text: "This is the standalone CTA section (a real button, distinct from the section 'View all' links).",
          button: { label: "Get in touch", href: "/contact" },
        } satisfies Prisma.InputJsonValue,
      },
    });

    console.log("  ✓ Showcase page sections seeded (6 sections)");

    // Placeholder gallery media — 3 Cloudinary demo images (res.cloudinary.com
    // is already whitelisted in next.config; picsum is not). Distinct effects.
    const galleryUrls = [
      "https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_fill/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_fill,e_grayscale/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_fill,e_sepia/sample.jpg",
    ];
    for (let n = 1; n <= 3; n++) {
      await prisma.media.create({
        data: {
          cloudinaryUrl: galleryUrls[n - 1],
          publicId: `showcase/gallery/${n}`,
          alt: `Sample gallery image ${n}`,
          type: "image/jpeg",
          category: "Section",
          ownerType: "section",
          ownerId: gallerySection.id,
          order: n - 1,
        },
      });
    }
    console.log("  ✓ Showcase gallery media (3 placeholder images)");
  } else {
    console.log("  ✓ Showcase page sections (already seeded — skipped)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nSeeding database...\n");

  // Settings has no author — seed independently
  await seedSiteSettings();

  // AdminUser MUST be created first — its id is threaded into every content model
  const adminId = await seedAdminUser();

  await seedSkills(adminId);
  await seedExperience(adminId);
  await seedEducation(adminId);
  await seedAchievements(adminId);
  await seedProjects(adminId);
  await seedBlogPosts(adminId);
  await seedMedia();
  await seedConfig();
  await seedPages(adminId);
  // Note: updatedById intentionally left null on all seeded rows — freshly created.

  console.log("\nSeed complete.\n");
}

main()
  .catch((error: unknown) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
