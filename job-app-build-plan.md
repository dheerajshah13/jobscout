# Build plan — job aggregator & recommendation app

**Working title:** JobScout (placeholder — rename freely)
**Platform:** Web-first (Next.js) · native mobile app in Phase 3
**Market:** Germany (all role categories)
**Status:** Draft v1.2 · July 2026

---

## 1. Problem statement

Job seekers check 4–6 different boards, see the same listings repeatedly, and have no good way to know which of hundreds of postings are actually worth their time. Every board optimizes for volume, not relevance. The cost of the status quo: hours wasted per week, missed postings on boards the user doesn't check, and application fatigue.

**One-liner:** One feed that aggregates jobs from many sources, removes duplicates, and ranks every listing against *your* profile — with a plain-language reason why each top match fits.

**Target users (v1):** Active job seekers in Germany, across role categories. Germany is the geographic anchor: launch segments are German cities plus remote-within-Germany. Since recommendation quality depends on tuning per category, seed the first segments with a handful of high-coverage fields (IT, engineering, healthcare/Pflege, logistics, office & sales) and let user demand create the rest — the segment model in §5 already supports this.

---

## 2. Goals

1. A user who completes onboarding sees a ranked feed of relevant jobs within 60 seconds of finishing their profile.
2. ≥ 70% of signups complete profile onboarding (skills, target titles, location, salary floor).
3. ≥ 25% of weekly active users tap through to apply on at least one job per week (apply-out CTR is also the revenue event for CPC feeds).
4. Duplicate rate in the feed under 3% (same job shown twice counts as a duplicate).
5. Infrastructure + data costs stay under ~€150/month up to the first ~2,000 users.

## 3. Non-goals (v1)

- **In-app applications / ATS integration.** Apply always links out to the original posting. Native apply is a large, separate project.
- **Employer side.** No job posting, employer accounts, or recruiter tools. Consumer app only.
- **LinkedIn scraping.** Excluded from the core product for legal and reliability reasons (see §4). May be revisited later as an isolated, clearly-flagged enrichment source.
- **Native mobile app (v1).** Web-first: job search starts on Google, and programmatic SEO is the growth engine — app stores offer an unknown brand no discovery. The Expo app arrives in Phase 3, when push alerts earn their keep as the retention/premium channel.
- **Chat / messaging / AI career coach.** Tempting scope creep. The wedge is ranking quality, not conversation.

---

## 4. Data sourcing strategy

### Core sources (launch)

| Source | Type | Cost | Notes |
|---|---|---|---|
| JSearch (RapidAPI) | API | Free tier, then ~tens of €/mo | Pulls from Google for Jobs → indirectly covers LinkedIn, Indeed, Glassdoor postings. Widest net. |
| Adzuna | Official API | Free with attribution | Requires visible attribution/backlink. Good salary data. |
| Jooble | Official API | Free (request key) | Broad aggregator, EU coverage good. |
| Remotive | Public API | Free | Remote tech jobs. No key needed. |
| Arbeitnow | Public API | Free | EU/Germany-focused board. No key needed. |
| Arbeitsagentur Jobsuche | Unofficial API | Free | Bundesagentur für Arbeit — the largest German job database. Community-documented (jobsuche.api.bund.dev, github.com/bundesAPI/jobsuche-api), simple `X-API-Key: jobboerse-jobsuche` header. **Caveat:** not officially supported and the BA has objected to mass automated access — lower risk than LinkedIn scraping (public government data, no login), but treat it as a switchable enrichment adapter, not the backbone. Throttle politely. |

### Publisher / affiliate feeds (Phase 3)

Talent.com, Careerjet, and WhatJobs run publisher programs: they provide job feeds and **pay per click** on outbound applies. This is both a data source and the first revenue stream. Apply for publisher accounts early — approval can take weeks.

### Why not the Apify LinkedIn scraper

Scraping LinkedIn violates its terms of service, and LinkedIn actively blocks scrapers and litigates against commercial use of scraped data. For a product with real users, that means supply that can vanish overnight and legal exposure. JSearch already surfaces most of the same postings via Google for Jobs. Decision: **not in the core pipeline.** If ever added, it runs as an isolated adapter that can be switched off without touching anything else.

### Germany-market specifics

- **Gender suffixes break dedupe.** Nearly every German posting carries "(m/w/d)", "(w/m/d)", "(m/w/x)" or "(gn)" in the title. `norm(title)` must strip these before fingerprinting, or the same job from two sources never matches.
- **Bilingual titles and skills.** German postings mix languages: "Softwareentwickler" ≡ "Software Developer", "Pflegefachkraft" ≡ "Nurse". Maintain a German↔English synonym table for titles and skills (generate per category with the Claude API, review manually). Both matching and dedupe use the mapped form.
- **Location normalization.** Handle umlauts and city name variants ("München"/"Munich", "Köln"/"Cologne") in `loc_bucket`. One canonical German spelling internally.
- **Remote means remote-in-Germany.** Most German remote roles require residence in Germany. Model as `remote_de`, distinct from globally remote.
- **Low salary transparency.** Many German postings omit salary — the neutral 0.5 salary subscore (§8) will fire often; use Adzuna salary estimates where available and label them as estimates in the UI.
- **Legal:** a product targeting Germany needs an Impressum (provider identification) in the app and on the website, on top of the GDPR items in §11.

### Source adapter rule

Every source is implemented behind the same interface: `fetch(segment) → RawJob[]` plus a `normalize(RawJob) → Job`. Adding or dropping a source must never require changes outside its adapter. This is the main defense against API pricing changes and shutdowns.

---

## 5. System architecture

```
[Source APIs] → [Ingestion worker (cron)] → [Postgres (Supabase)]
                     fetch → normalize                │
                     dedupe → score                   │
                                                      ▼
[Claude API]  ← "why this fits" for top matches  [Next.js app]
[Email alerts] ← new high-score match digests        feed, detail,
                                                 saved, profile, SEO pages
```

**Components**

- **Next.js web app** — App Router, TypeScript, Tailwind, Supabase Auth; deployed on Vercel. Public SEO pages rendered statically/ISR; the logged-in feed rendered per user. Mobile-responsive from day one — most job seekers will browse on their phone's browser.
- **Supabase** — Postgres, Auth, Storage (CV files), Row Level Security. Extensions: `pg_trgm` (fuzzy dedupe), `pgvector` (Phase 2 embeddings).
- **Ingestion worker** — small Node/TypeScript service on a cron (e.g. every 4h), deployable on Railway/Fly.io or as Supabase scheduled Edge Functions at MVP scale.
- **Email** — Resend or Postmark for match-alert digests and transactional mail. Email is the retention channel until the mobile app brings push (Phase 3).
- **Claude API** — generates one-line match explanations; also CV parsing in Phase 2.

### SEO as the distribution engine

The web app doubles as the acquisition machine. Programmatic landing pages per (role × city) — "Pflegefachkraft Jobs Köln", "React Developer Jobs Berlin" — generated from the segments table, each listing fresh ranked jobs with a signup prompt. Rules: only index pages with enough live jobs (noindex thin pages), sitemap generated from segments, German-language URLs and copy for German queries, fast static rendering. This is how Indeed and Adzuna grew; it costs nothing but discipline.

### The cost rule: segment-based ingestion

**Never call source APIs per user.** Jobs are fetched per *search segment* — a (role keyword × location) pair like `("react developer", "Berlin")` — into one shared `jobs` table. User profiles map to segments; scoring runs against the shared pool. New segments are created on demand when a user's profile isn't covered, then reused by everyone. This keeps API cost roughly proportional to distinct segments, not to user count.

---

## 6. Data model

### `jobs` — canonical listings

| Field | Notes |
|---|---|
| id | uuid |
| fingerprint | dedupe key, unique (see below) |
| title, company, location | normalized |
| remote | none / hybrid / full |
| salary_min, salary_max, currency | nullable |
| description | text |
| apply_url | best available original link |
| posted_at, first_seen_at, last_seen_at | freshness tracking |
| status | active / stale / expired |
| embedding | vector, Phase 2 |

### `job_sources`

One row per (job, source): source name, source's own id, source URL, raw payload (jsonb). Preserves provenance and attribution requirements.

### `profiles`

user_id, skills[], target_titles[], locations[], remote_pref, salary_floor, seniority, cv_storage_path (Phase 2), notification prefs.

### `matches`

user_id, job_id, score (0–100), score_breakdown (jsonb), reason (Claude one-liner, nullable), status: new / seen / saved / applied / hidden, created_at. Unique on (user_id, job_id).

### `search_segments`

keyword, location, last_fetched_at, active user count. Drives the ingestion scheduler.

### Dedupe fingerprint

```
fingerprint = norm(company) + "|" + norm(title) + "|" + loc_bucket
```

- `norm(company)`: lowercase, trim, strip legal suffixes (gmbh, inc, ltd, ag…).
- `norm(title)`: lowercase, strip punctuation, sort seniority tokens so "Senior Backend Engineer" ≡ "Backend Engineer, Senior".
- `loc_bucket`: city name or `remote`.

Exact fingerprint match → same job (merge sources, keep richest record). No exact match → fuzzy pass: same normalized company + `pg_trgm` title similarity > 0.6 + same location bucket → treat as same job. Log fuzzy merges for the first weeks to tune the threshold.

---

## 7. Ingestion pipeline

Runs per active segment every ~4 hours (stagger to respect rate limits):

1. **Fetch** — each enabled source adapter pulls listings for the segment.
2. **Normalize** — map to the canonical `jobs` schema; parse salaries, locations, remote flags.
3. **Dedupe** — fingerprint upsert + fuzzy pass; merge sources into `job_sources`; refresh `last_seen_at`.
4. **Freshness** — jobs not seen by any source for 14 days → `stale`; stale for 14 more → `expired` (hidden from feeds). Before including a job in an alert email, re-check the apply URL returns 200.
5. **Score** — compute/refresh `matches` for users whose profiles map to this segment; only re-score changed or new jobs.
6. **Explain** — for each user's top ~10 *new* matches above a score threshold, generate the one-line reason via Claude API. Cache on the match row; never regenerate.
7. **Notify** — queue new matches above the user's alert threshold into an email digest (default daily, instant for exceptional scores; always ≤ 1–2 mails/day, one-click unsubscribe).

Idempotency: every step is an upsert keyed on fingerprint or (user_id, job_id); re-running a segment is always safe.

---

## 8. Ranking & recommendations

### v1 — transparent weighted score (ship this)

```
score = 40·skills + 20·title + 15·location + 15·salary + 10·recency
```

- **skills**: alias/synonym-aware weighted overlap (packages/core `SKILL_ALIASES` — bilingual DE/EN, ~60 canonical
  skills with variants) between profile skills and the job's title+description, with a fuzzy bigram-similarity
  fallback for typos/unlisted skills and a bonus when a skill is mentioned in the job title specifically.
- **title**: blend of token overlap and bigram similarity across the user's target titles, combined with a seniority
  fit sub-score (job title/description seniority level inferred bilingually vs. the profile's stated seniority).
- **location**: 1.0 exact city or remote-compatible; partial credit for hybrid/commutable; soft credit for
  nationwide/"Germany-wide" postings when the profile is remote-friendly.
- **salary**: 1.0 if range ≥ floor; scaled down if below; 0.5 neutral when unlisted; uses whichever of min/max is
  available rather than requiring both.
- **recency**: decays from 1.0 (posted today) to 0 over 21 days.

Store the breakdown in `matches.score_breakdown` and show it in the UI — transparency builds trust and makes tuning debuggable. This is still v1 (no embeddings) — deliberately, to get the rule-based engine as strong as possible before paying for semantic matching infrastructure.

### v2 — semantic matching

Embed job descriptions and the user's CV/profile; blend cosine similarity into the score (e.g. 60% rules / 40% semantic to start). `pgvector` keeps this inside Postgres.

### v3 — behavioral signals

Saves, applies, hides, and dwell time feed back into per-user weight adjustments. Only worth it with real usage data.

### "Why this fits" (Claude API)

One sentence per top match, e.g. *"Matches 6 of your 8 skills, fully remote, and pays above your floor."* Generated only for top-N new matches, cached forever, batched. This is the signature feature — it should appear on every card in the top section of the feed.

---

## 9. Web app (Next.js)

**Stack:** Next.js App Router (TypeScript), Tailwind, Supabase JS client + Auth helpers, deployed on Vercel. Server components for public/SEO pages; client interactivity only where needed (feed actions, onboarding). Fully responsive — treat the phone browser as the primary viewport.

**Pages (MVP):**

1. **Landing + SEO pages** — home page plus programmatic (role × city) pages from §5, each with live jobs and a signup prompt.
2. **Onboarding** — 3–4 steps: target titles → skills (chip picker with suggestions) → location + remote pref → salary floor. Completable in under 2 minutes.
3. **Feed** — ranked matches; card = title, company, location, salary, score badge, reason line (when available), source logos. Actions: save, hide, open.
4. **Job detail** — full description, score breakdown, all source links, apply-out button (tracked). Public URL per job — every detail page is a potential search-engine entry point.
5. **Saved / applied** — simple tracker with status chips.
6. **Profile & settings** — edit profile, alert threshold + email frequency, data export & account deletion.

---

## 10. Requirements

### Must-have (P0)

- [x] Email/OAuth signup, onboarding, editable profile — onboarding now saves to `profiles`, home/profile feed scores against it
- [x] Ingestion from ≥ 2 sources with adapter interface, dedupe < 3% visible duplicates
- [x] Rule-based scoring + ranked feed with score breakdown
- [x] Job detail with working apply-out links; save/hide — wired to `matches` via server actions
- [x] Stale-job expiry so users don't apply to dead listings — worker sweeps 14d stale / 28d expired after every ingestion run
- [x] Account deletion + data export — `/api/account/export` (JSON download) + admin-API delete on `/profile`
- [x] Given a completed profile, when the user opens the feed, then ≥ 20 ranked jobs appear (or an honest "expanding your search" state for thin segments)

### Nice-to-have (P1)

- [ ] Email alerts: daily digest of new high-score matches, one-click unsubscribe
- [ ] Programmatic SEO pages beyond the initial seed set
- [ ] Claude "why this fits" lines — still rule-based `explainMatch`, not an LLM call per match
- [x] CV upload + parsing to prefill skills — PDF/DOCX/TXT upload on `/profile`, Claude API (tool-use) extracts
      skills/titles/seniority with an offline keyword-extraction fallback when no API key is set
- [ ] Feedback controls ("more like this / not relevant")

### Future (P2 — design for, don't build)

- Native mobile app (Expo) on the same backend — push alerts as the retention/premium channel
- Embedding-based matching (schema already has the vector column)
- Affiliate/CPC feed integration and click attribution
- Premium tier: instant alerts, advanced filters, multiple profiles
- Application status reminders

---

## 11. Privacy & compliance

- CVs and profiles are personal data. **GDPR baseline from day one:** explicit consent at upload, purpose limitation, in-app export and deletion, EU region for Supabase project, delete CV files from Storage on account deletion.
- Privacy policy, terms, and Impressum (§4) required before public launch; cookie/consent handling for analytics.
- Respect source API terms: Adzuna attribution displayed on cards/detail; keep raw payloads only as long as needed.
- Sending job descriptions to the Claude API is fine; avoid sending the raw CV with each request — extract a skills/summary once, reuse that.

## 12. Cost estimate (MVP scale, ~first 2k users)

Rough monthly figures — verify current pricing before committing:

| Item | Est. €/mo |
|---|---|
| JSearch (RapidAPI paid tier) | 25–50 |
| Adzuna / Jooble / Remotive / Arbeitnow | 0 |
| Supabase Pro | ~25 |
| Vercel | 0–20 |
| Worker hosting (Railway/Fly) | 5–10 |
| Email (Resend/Postmark) | 0–10 |
| Claude API (cached one-liners) | 10–30 |
| **Total** | **~65–145** |

One-time: just a domain (~€10/yr). Apple Developer (~€99/yr) and Google Play (~€25) fees move to Phase 3 with the mobile app.

## 13. Success metrics

**Leading (first 30 days):** onboarding completion ≥ 70%; median time-to-first-feed < 60s; saves per active user per week ≥ 3; duplicate reports < 3%; email digest open rate ≥ 30%.
**Lagging (by month 3):** D7 retention ≥ 20% (stretch 30%); weekly apply-out CTR ≥ 25% of WAU; share of signups from organic search trending up month over month; if CPC feeds live, revenue per WAU > data cost per WAU.
Instrument from day one (PostHog or similar) — these numbers decide Phase 3 priorities.

## 14. Roadmap

| Phase | Weeks | Scope |
|---|---|---|
| 0 — Setup | 1 | Repo (monorepo: `web/`, `worker/`, `supabase/`), Supabase project + schema, Next.js scaffold on Vercel, API keys, apply for publisher feeds |
| 1 — MVP | 2–5 | 2–3 source adapters, pipeline, rule scoring, core pages, SEO foundations (metadata, sitemap, seed role×city pages), soft launch |
| 2 — Smart | 6–9 | CV upload + parsing, pgvector matching, Claude reasons, email alerts, programmatic SEO rollout, feedback signals, public launch |
| 3 — Grow | 10+ | Expo mobile app + push alerts, more sources + CPC feeds, premium tier, analytics-driven tuning |

## 15. Risks & mitigations

- **Source dependency** (pricing/API changes) → adapter isolation, ≥ 3 sources live, publisher feeds as fallback supply.
- **Dedupe quality** → log fuzzy merges, tune threshold with real data, in-app "duplicate" report button.
- **Cold start for niche profiles** → auto-broaden segments (nearby cities, related titles) with honest UI messaging.
- **Stale listings** → TTL + URL re-check before alerts; "verified today" badge on fresh jobs.
- **Cost blowup with growth** → segment model, per-source rate budgets, alerting on API spend.
- **SEO dependence** → Google algorithm changes can cut acquisition overnight; capture email from the first visit, build the digest habit, diversify with direct traffic and (later) the app.
- **Email deliverability** → warmed domain, double opt-in, clean list hygiene; deliverability problems kill the retention channel silently.

## 16. Open questions

- **Launch niche — resolved:** Germany, all role categories; seed segments from the high-coverage fields in §1 and expand from user demand.
- **Platform — resolved:** web-first (Next.js on Vercel); Expo mobile app in Phase 3 once push earns its keep.
- **App language:** German-only, English-only, or bilingual at launch? SEO pulls strongly toward German — that's what the market searches; bilingual roughly doubles copy and support effort. (Owner: you.) *Decide before Phase 1 UI work.*
- **Name & branding.** Slightly more urgent now — the domain is the product. *Decide during Phase 0–1.*
- **Monetization order:** CPC feeds first (passive) vs premium tier (needs traction)? *Decide during Phase 2.*

## 17. Immediate next steps

1. Create the monorepo + Supabase project (EU region) and apply the schema from §6.
2. Register API keys: RapidAPI (JSearch), Adzuna, Jooble; submit publisher applications (Talent.com, Careerjet).
3. Build the first source adapter (JSearch) + normalize + fingerprint dedupe end-to-end for one hardcoded segment.
4. Scaffold the Next.js app on Vercel with Supabase auth + onboarding.
5. Wire the feed to real scored data, then ship the first seed of SEO pages. Everything after that is iteration.
