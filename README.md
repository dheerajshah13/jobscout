# JobScout

**A Germany-focused job aggregator that pulls listings from 7 sources, deduplicates them, and scores every role against your resume — explaining *why* each job fits.**

Built for job seekers in Germany (locals and internationals alike): one search box across every major job board, transparent AI matching, and EN/DE job translation so a German-only posting is never a dead end.

> Monorepo · TypeScript end-to-end · Next.js 15 (App Router, React 19) · Supabase (Postgres + Auth + Storage + RLS) · Tailwind

---

## What it does

- **Aggregates 7 sources into one deduplicated feed** — Arbeitsagentur, Arbeitnow, Remotive, Jobicy, The Muse, Adzuna, and Jooble. A shared adapter interface (`fetch` + `normalize`) means adding a source is one file. Cross-source duplicates are merged by a bilingual fingerprint (`Softwareentwickler` == `Software Developer`).
- **Transparent, resume-driven matching** — every job shows a match score broken into skills / title / location / salary / recency, plus a plain-language reason ("Matches 4 of your 5 skills…"). No black box.
- **Two ways to find work:**
  - **Discover** — LinkedIn-style search with title-anchored relevance (searching *product owner* returns product owners, not engineers who mention one), EN↔DE synonym expansion, a German-city dropdown, filters (workplace / salary / source / date), pagination, and live aggregator results merged in.
  - **AI Matches** — a "Run AI matching" button that ingests fresh jobs for your target roles on demand (solving the cold-start problem), then ranks the top matches against your profile.
- **Application pipeline** — save, mark-applied, and hide jobs; track them on a dedicated pipeline page.
- **Resume upload** — drop a PDF/DOCX and skills, target titles, and seniority are prefilled (Claude when a key is set, free offline keyword extraction otherwise — never crashes).
- **EN/DE everywhere** — a language toggle translates job postings on demand (free Google endpoint → offline dictionary fallback), cached per job.
- **Germany-only guarantee** — aggregator results are constrained and filtered to German locations, so a global source never leaks a "Yorkville, IL" listing.
- **GDPR baseline** — one-click JSON data export, account deletion, consent-aware CV storage, and Impressum/Privacy/Terms pages. Row-level security scopes every user to their own data.

## Architecture

```
packages/core/   Shared engine (pure TS, no build step): domain types, the scoring
                 engine, dedupe fingerprinting, source adapters, ingestion pipeline,
                 bilingual synonym + relevance search, Germany filter.
web/             Next.js App Router. Server components + plain GET/POST forms — no
                 client state libraries. Auth, onboarding, Discover, AI dashboard,
                 job detail, pipeline, profile, SEO landing pages.
worker/          One-shot ingestion runner (tsx) that reuses the core engine.
supabase/        SQL migrations (schema, RLS, self-service policies, CV storage,
                 match-run history, translation cache).
```

The matching engine lives in `packages/core` so the **same code** ranks jobs in the web app (on-demand runs) and the background worker (scheduled ingestion) — no duplicated logic.

## Local setup

```sh
npm install

cp web/.env.example web/.env.local        # fill in Supabase + optional API keys
cp worker/.env.example worker/.env

npm run dev            # web app on http://localhost:3000
npm run worker:dev     # one ingestion pass
```

Apply the migrations in `supabase/migrations/` in order (`supabase db push`, or paste into the Supabase SQL editor). The app degrades gracefully: with no aggregator keys it still runs on the free direct sources; with no `ANTHROPIC_API_KEY` resume parsing uses an offline fallback.

## Notable engineering details

- **One adapter interface, seven sources**, including three keyed aggregators (Adzuna, Jooble, JSearch) with per-source quirks handled in isolation — e.g. Jooble's global endpoint is forced to Germany, Adzuna's umlaut cities are supported, and each has a 5-second timeout race so a slow source never blocks a search.
- **Title-anchored relevance ranking** computed in the app layer over a broad SQL candidate set — precision over raw recall, with a graceful "matched any term" fallback.
- **Live results become permanent** — jobs fetched live from aggregators during a search are persisted (deduped, real UUIDs) so they're clickable, scoreable, and enrich the shared pool.
- **Bilingual by design** — synonym expansion, fingerprinting, translation, and city-name normalization all bridge English and German.

## Status

Functional MVP. Out of scope (by design): payments, email digests, and full UI-string i18n. LinkedIn/Indeed have no public APIs (partner-only licensing) — they are reached indirectly via aggregators, never scraped.
