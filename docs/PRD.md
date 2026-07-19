# JobScout — Product Requirements Document

**Status:** Living document · reflects the current build
**Product:** JobScout — a Germany-focused job aggregator and recommendation app
**Author:** Dheeraj Shah

> This is the canonical concept + requirements doc. For the original planning
> narrative see [`../job-app-build-plan.md`](../job-app-build-plan.md); for the
> MVP scoping decisions see [`../PRODUCT.md`](../PRODUCT.md).

---

## 1. One-liner

**Upload your resume once — JobScout pulls jobs from every major German source, removes duplicates, and tells you *why* each one fits you, in English or German.**

## 2. Problem

Job seekers in Germany check 4–6 different boards (Arbeitsagentur, StepStone, Indeed, LinkedIn, company sites…), see the same listings repeatedly, and have no reliable way to know which of hundreds of postings are actually worth their time. Every board optimizes for volume, not relevance. For **internationals** the pain is worse: sources are fragmented, many postings are German-only, and there's no signal for how well a role matches their background.

**Cost of the status quo:** hours wasted per week, missed postings on boards the user doesn't check, application fatigue, and a language barrier that hides otherwise-great roles.

## 3. Target users

- **Primary:** Active job seekers in Germany, across all role categories (IT, engineering, healthcare/Pflege, logistics, office & sales…).
- **High-value segment:** Internationals in or moving to Germany who are underserved by German-only, single-board search.

Germany is the geographic anchor: every search is constrained to German locations (or remote-within-Germany).

## 4. Goals & success metrics

1. A user who completes onboarding sees a ranked, relevant feed **within 60 seconds**.
2. **≥ 70%** of signups complete profile onboarding.
3. **≥ 25%** of weekly active users click through to apply on ≥ 1 job/week (apply-out is also the future revenue event).
4. Duplicate rate in the feed **under 3%**.
5. Infra + data costs **under ~€150/month** to the first ~2,000 users.

## 5. Non-goals (v1)

- **In-app applications / ATS integration** — apply always links out to the original posting.
- **Employer side** — no job posting, employer accounts, or recruiter tools. Consumer app only.
- **Scraping LinkedIn/Indeed** — they have no public APIs (partner-only licensing); reached indirectly via aggregators (Adzuna, Jooble, JSearch), never scraped.
- **Native mobile app** — web-first; search starts on Google, and SEO is the growth engine.
- **AI career-coach chat** — the wedge is ranking quality, not conversation.

## 6. Core concept — how it works

The UI is deliberately **boring and familiar** (LinkedIn/StepStone patterns). The differentiation is the **system underneath**:

1. **Aggregate** jobs from many sources behind one adapter interface.
2. **Deduplicate** across sources using a bilingual fingerprint (`Softwareentwickler` == `Software Developer`), keeping the richest copy.
3. **Score** every job against the user's resume-derived profile, transparently.
4. **Explain** each top match in one plain-language sentence.
5. **Translate** any posting between EN and DE on demand.

The resume *is* the search query.

## 7. Features (current build)

### Aggregation — 7 sources, one feed
| Source | Type | Notes |
|---|---|---|
| Arbeitsagentur | Direct (official API) | German Federal Employment Agency |
| Arbeitnow | Direct (free) | |
| Remotive | Direct (free) | Remote roles |
| Jobicy | Direct (free) | Remote, Germany geo |
| The Muse | Direct (free) | Location-based |
| Adzuna | Aggregator (keyed) | Deepest German coverage; EUR salaries |
| Jooble | Aggregator (keyed) | Forced to Germany; global endpoint |
| JSearch | Aggregator (keyed, optional) | Indexes Indeed/XING/StepStone/etc. |

Adding a source is a single file implementing `{ name, fetch, normalize }`. Cross-source duplicates are merged by fingerprint. All results are constrained + filtered to **German locations only**.

### Discover (search) — "you search"
LinkedIn-style search over the whole pool:
- **Title-anchored relevance ranking** — "product owner" returns product owners, not engineers who merely mention one. Description-only matches are dropped.
- **EN↔DE synonym expansion** — "developer" also matches "Entwickler", "Munich" also matches "München"; plurals handled.
- **German-city dropdown** (country fixed to Germany), filters (workplace / salary / source / date posted), sort, and pagination.
- **Live aggregator results** merged into the feed on the first page and **persisted** into the shared pool (real IDs, clickable, scoreable).

### AI Matches — "we did the work"
- A **"Run AI matching"** button ingests fresh jobs for the user's target titles × locations **on demand** (solves cold-start), records run stats, and ranks the top matches.
- Free tier: **5 runs/day, top 10 results** (the future paywall lever).
- Each card shows a **score breakdown** (skills / title / location / salary / recency) and a plain-language reason.

### Application pipeline
- **Save**, **mark applied**, and **hide** any job.
- Dedicated `/saved` page with Saved / Applied / Hidden sections.

### Resume-driven profile
- Upload **PDF / DOCX** → skills, target titles, and seniority are prefilled (Claude when an API key is set, free offline keyword extraction otherwise — never crashes).

### Bilingual (EN/DE)
- Header language toggle. Job postings translated on the detail page (free Google endpoint → offline dictionary fallback), cached per job/language.

### GDPR baseline
- One-click **JSON data export**, **account deletion**, consent-aware CV storage, and Impressum / Privacy / Terms pages.
- **Row-level security** scopes every user to their own data.

### SEO
- Programmatic landing pages (`/jobs/[slug]`) for organic discovery.

## 8. Scoring model

Transparent, weighted, shown on every match:

| Signal | Weight |
|---|---|
| Skills overlap | 40% |
| Title match | 20% |
| Location fit | 15% |
| Salary vs. floor | 15% |
| Recency | 10% |

Skill matching uses a bilingual alias taxonomy (JS ↔ JavaScript, Pflege ↔ nursing) so it's not brittle string matching.

## 9. Information architecture

| Route | Purpose |
|---|---|
| `/` | Marketing (logged out) / AI-matches dashboard (logged in) |
| `/discover` | Search + filters + sort over all jobs |
| `/job/[id]` | Job detail: score breakdown, full description, EN/DE translation |
| `/onboarding` | Profile setup |
| `/profile` | Resume upload, profile edit, GDPR export/delete |
| `/saved` | Saved / applied / hidden pipeline |
| `/jobs/[slug]` | SEO landing pages |
| `/login` | Auth |
| `/impressum`, `/privacy`, `/terms` | Legal |

## 10. Technical architecture

```
packages/core/   Shared engine (pure TS): types, scoring, dedupe fingerprinting,
                 source adapters, ingestion pipeline, bilingual synonym + relevance
                 search, Germany filter. Reused by BOTH web and worker.
web/             Next.js 15 App Router (React 19). Server components + plain
                 GET/POST forms — no client state libraries.
worker/          One-shot ingestion runner (tsx) reusing the core engine.
supabase/        SQL migrations: schema, RLS, self-service policies, CV storage,
                 match-run history, translation cache.
```

**Stack:** TypeScript end-to-end · Next.js 15 · React 19 · Supabase (Postgres + Auth + Storage + Row-Level Security) · Tailwind · npm workspaces monorepo.

The matching engine lives in `packages/core`, so the *same code* ranks jobs in the web app (on-demand runs) and the background worker (scheduled ingestion) — no duplicated logic.

## 11. Data model (Supabase Postgres)

- `jobs` — canonical deduplicated jobs, unique `fingerprint`, status active/stale/expired.
- `job_sources` — per-source raw payloads.
- `profiles` — user matching profile (skills, target titles, locations, remote pref, salary floor, seniority, CV metadata).
- `matches` — (user, job) with score, breakdown, reason, status (new/seen/saved/applied/hidden).
- `search_segments` — (keyword, location) ingestion units.
- `match_runs` — one row per user-triggered AI run.
- `job_translations` — cached machine translations.
- Storage bucket `cvs` (private, per-user RLS).

## 12. Monetization

- **Free:** 5 AI-matching runs/day, top 10 results, full Discover search, save/apply/hide.
- **Paid (future, Stripe):** unlimited runs, email alert digests.
- The free cap is the paywall lever — the limit exists in code today; payments are a later phase.

## 13. Roadmap

**Shipped:** aggregation (7 sources) + dedup + scoring, Discover (relevance search, filters, pagination, live results, Germany filter, city dropdown), AI Match Runs, dashboard, application pipeline, resume parsing, EN/DE translation, GDPR baseline, SEO pages.

**Next (optional polish):**
1. Standardized skill/title dropdown taxonomy in onboarding (free-text works today).
2. Full UI-string i18n (job *content* already translates; UI chrome is English).
3. Email alert digests (`alert_threshold` + `email_frequency` columns already exist).
4. Payments (Stripe) to unlock the paid tier.
5. Native mobile app (Phase 3) for push-based retention.

## 14. Design principles

- **Boring UI, smart system.** Familiar patterns; the intelligence is invisible.
- **Transparent, never a black box.** Every score is explained.
- **Graceful degradation.** No aggregator keys → runs on free sources. No `ANTHROPIC_API_KEY` → offline resume parsing. A slow source → timed out, never blocks a search.
- **Bilingual by default.** EN/DE bridged in dedup, search, translation, and city names.
- **Privacy first.** RLS everywhere; one-click export and deletion.
