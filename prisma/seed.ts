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
      resumeUrl: "/resume.pdf",
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
//  ADMIN USER
// ─────────────────────────────────────────────────────────────────────────────

async function seedAdminUser(): Promise<void> {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");
  const name = requireEnv("ADMIN_NAME");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name,
    },
  });
  console.log(`  ✓ AdminUser (${email})`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKILLS  (step3 §2.3 with proposed tier split)
// ─────────────────────────────────────────────────────────────────────────────

async function seedSkills(): Promise<void> {
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

  // Skills have no natural unique key in the schema besides id.
  // We use deleteMany + createMany for a clean idempotent approach
  // (skills are low-volume; this is safe).
  await prisma.skill.deleteMany({});
  await prisma.skill.createMany({ data: skills });
  console.log(`  ✓ Skills (${skills.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPERIENCE  (step3 §2.4)
// ─────────────────────────────────────────────────────────────────────────────

async function seedExperience(): Promise<void> {
  // Experiences have no unique slug — use deleteMany + createMany for idempotency
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
      },
    ],
  });
  console.log("  ✓ Experience (2 roles)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDUCATION
// ─────────────────────────────────────────────────────────────────────────────

async function seedEducation(): Promise<void> {
  // No unique slug — deleteMany + createMany for idempotency
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
      },
    ],
  });
  console.log("  ✓ Education (1 entry)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACHIEVEMENTS  (step3 §2.7)
// ─────────────────────────────────────────────────────────────────────────────

async function seedAchievements(): Promise<void> {
  await prisma.achievement.deleteMany({});

  await prisma.achievement.createMany({
    data: [
      {
        title: '"Going Beyond" Award',
        description:
          "Awarded by Humancloud Technologies for delivering critical production features across multiple projects — including the bank-grade SCB Monte Carlo platform, Teamcast, Meet Scribe, and Lease Oasis.",
        date: new Date("2025-03-01"),
        order: 0,
      },
      {
        title: "Mentored Simulix Interns",
        description:
          "Mentored interns building Simulix — Humancloud's internal Monte Carlo demo platform — sharing domain knowledge on simulation architecture, TensorFlow GBM, and async job queues.",
        date: new Date("2025-06-01"),
        order: 1,
      },
      {
        title: "B.E. in Artificial Intelligence & Data Science",
        description:
          "Zeal College of Engineering & Research, Pune — CGPA 8.9/10 — 2021–2024.",
        date: new Date("2024-06-30"),
        order: 2,
      },
    ],
  });
  console.log("  ✓ Achievements (3 items)");
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROJECTS  (step3 §3.1–3.8)
// ─────────────────────────────────────────────────────────────────────────────

async function seedProjects(): Promise<void> {
  const projects: Array<{
    slug: string;
    title: string;
    oneLiner: string;
    role: string;
    tags: string[];
    stack: string[];
    metric: string;
    liveUrl?: string;
    screenshots: Prisma.InputJsonValue;
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
      screenshots: [
        {
          url: "/screenshots/scb-monte-carlo.png",
          alt: "Simulix — Monte Carlo simulation platform",
        },
      ],
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

    // ── 2. Aquatech Autotool (client placement, Angular 19 frontend) ─────────
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
      screenshots: [],
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
      screenshots: [
        { url: "/screenshots/teamcast.png", alt: "Teamcast dashboard" },
      ],
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
      screenshots: [
        { url: "/screenshots/meet-scribe.png", alt: "Meet Scribe dashboard" },
      ],
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
      screenshots: [
        { url: "/screenshots/lease-oasis.png", alt: "Lease Oasis listings" },
      ],
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
      screenshots: [
        { url: "/screenshots/medic-ai.png", alt: "Medic AI portal" },
      ],
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
      screenshots: [
        { url: "/screenshots/avaloq-gbs.png", alt: "Avaloq GBS dashboard" },
      ],
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
      screenshots: [],
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
      screenshots: [],
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
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      update: {},
      create: project,
    });
  }
  console.log(`  ✓ Projects (${projects.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BLOG POSTS  (step3 §4)
// ─────────────────────────────────────────────────────────────────────────────

async function seedBlogPosts(): Promise<void> {
  const posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    coverImage?: string;
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
      coverImage: "/placeholder.png",
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
      coverImage: "/placeholder.png",
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
      coverImage: "/placeholder.png",
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
      create: post,
    });
  }
  console.log(`  ✓ BlogPosts (${posts.length} items)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MEDIA  (local /public/screenshots assets — testing only; replaced by
//  Cloudinary uploads later. cloudinaryUrl holds a local /screenshots path.)
// ─────────────────────────────────────────────────────────────────────────────

async function seedMedia(): Promise<void> {
  await prisma.media.deleteMany({});

  // Files currently in portfolio-frontend/public/screenshots/
  const files = [
    'teamcast1',
    'teamcast2',
    'teamcast3',
    'teamcast4',
    'teamcast5',
    'teamcast6',
  ];

  await prisma.media.createMany({
    data: files.map((name, i) => ({
      cloudinaryUrl: `/screenshots/${name}.png`,
      publicId: `local/${name}`,
      alt: `Teamcast screenshot ${i + 1}`,
      type: 'image/png',
      category: 'Projects',
    })),
  });
  console.log(`  ✓ Media (${files.length} local screenshots)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION  — admin-editable dropdown option sets
// ─────────────────────────────────────────────────────────────────────────────

async function seedConfig(): Promise<void> {
  const sets: { key: string; label: string; items: { value: string; label: string }[] }[] = [
    {
      key: 'contact_link_types',
      label: 'Contact link types',
      items: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'website', label: 'Website' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'github', label: 'GitHub' },
        { value: 'twitter', label: 'X (Twitter)' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'medium', label: 'Medium' },
        { value: 'dribbble', label: 'Dribbble' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'resume', label: 'Resume / CV' },
      ],
    },
    {
      key: 'social_link_types',
      label: 'Social link types',
      items: [
        { value: 'website', label: 'Website' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'github', label: 'GitHub' },
        { value: 'twitter', label: 'X (Twitter)' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'medium', label: 'Medium' },
        { value: 'dribbble', label: 'Dribbble' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'email', label: 'Email' },
      ],
    },
    {
      key: 'skill_groups',
      label: 'Skill groups',
      items: [
        { value: 'LANGUAGES', label: 'Languages' },
        { value: 'FRONTEND', label: 'Frontend' },
        { value: 'BACKEND', label: 'Backend' },
        { value: 'DATA', label: 'Data' },
        { value: 'CLOUD_DEVOPS', label: 'Cloud / DevOps' },
        { value: 'AI', label: 'AI' },
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

async function seedPages(): Promise<void> {
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
      metaTitle: "Projects — Rohit Malviya",
      metaDescription:
        "Production systems I've built — fintech, SaaS, real-estate, insurance, meeting-AI — across TypeScript, Go, Python & Java.",
      navLabel: "Work",
      navOrder: 1,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "blog",
      title: "Blog",
      metaTitle: "Blog — Rohit Malviya",
      metaDescription:
        "Engineering deep-dives — Monte Carlo simulations, multi-tenant data modelling, Playwright automation, and more.",
      navLabel: "Blog",
      navOrder: 2,
      showInNav: true,
      isSystem: true,
      published: true,
    },
    {
      slug: "contact",
      title: "Contact",
      metaTitle: "Contact — Rohit Malviya",
      metaDescription:
        "Get in touch with Rohit Malviya — full-stack engineer based in Pune, India.",
      navLabel: "Contact",
      navOrder: 3,
      showInNav: true,
      isSystem: true,
      published: true,
    },
  ];

  for (const pageData of systemPages) {
    await prisma.page.upsert({
      where: { slug: pageData.slug },
      // update applies nav defaults on every re-seed so existing rows stay in sync
      update: {
        navLabel: pageData.navLabel,
        navOrder: pageData.navOrder,
        showInNav: pageData.showInNav,
        published: pageData.published,
      },
      create: pageData,
    });
  }
  console.log(`  ✓ Pages (${systemPages.length} system pages)`);

  // ── Home page sections ────────────────────────────────────────────────────

  const homePage = await prisma.page.findUniqueOrThrow({
    where: { slug: "home" },
  });

  // Section data shapes per step4 §3.2
  // We only create sections if none exist yet (idempotency for sections).
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
      // ── HERO ──────────────────────────────────────────────────────────────
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

      // ── ABOUT ─────────────────────────────────────────────────────────────
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

      // ── SKILLS ────────────────────────────────────────────────────────────
      {
        type: "SKILLS",
        order: 2,
        enabled: true,
        data: {
          heading: "02 — skills",
          source: "skills-table",
        } satisfies Prisma.InputJsonValue,
      },

      // ── EXPERIENCE ────────────────────────────────────────────────────────
      {
        type: "EXPERIENCE",
        order: 3,
        enabled: true,
        data: {
          heading: "03 — experience",
          source: "experience-table",
        } satisfies Prisma.InputJsonValue,
      },

      // ── FEATURED_PROJECTS ─────────────────────────────────────────────────
      {
        type: "FEATURED_PROJECTS",
        order: 4,
        enabled: true,
        data: {
          heading: "04 — featured work",
          auto: "featured",
          limit: 4,
        } satisfies Prisma.InputJsonValue,
      },

      // ── BLOG_TEASER ───────────────────────────────────────────────────────
      {
        type: "BLOG_TEASER",
        order: 6,
        enabled: true,
        data: {
          heading: "06 — from the blog",
          limit: 3,
        } satisfies Prisma.InputJsonValue,
      },

      // ── ACHIEVEMENTS ──────────────────────────────────────────────────────
      {
        type: "ACHIEVEMENTS",
        order: 7,
        enabled: true,
        data: {
          heading: "07 — recognition",
          source: "achievements-table",
        } satisfies Prisma.InputJsonValue,
      },

      // ── EDUCATION ─────────────────────────────────────────────────────────
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
        } satisfies Prisma.InputJsonValue,
      },

      // ── CONTACT ───────────────────────────────────────────────────────────
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
          resumeUrl: "/resume.pdf",
        } satisfies Prisma.InputJsonValue,
      },
    ];

    for (const section of sections) {
      await prisma.section.create({
        data: {
          pageId: homePage.id,
          type: section.type as any,
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
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nSeeding database...\n");

  await seedSiteSettings();
  await seedAdminUser();
  await seedSkills();
  await seedExperience();
  await seedEducation();
  await seedAchievements();
  await seedProjects();
  await seedBlogPosts();
  await seedMedia();
  await seedConfig();
  await seedPages();

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
