# JobScout — Product Plan (MVP)

## One-liner
Upload your resume once — JobScout pulls jobs from every major German source, dedupes them, and tells you *why* each one fits you, in English or German.

## Who it's for
Job seekers in Germany (locals + internationals). Internationals are underserved: fragmented sources, German-only listings, no idea which jobs actually match their background.

## Why we win (differentiators)
1. **Multi-source aggregation + dedup** — Arbeitsagentur, Arbeitnow, Remotive, Jobicy, The Muse, plus optional JSearch/RapidAPI when `JSEARCH_API_KEY` is set; one feed, no duplicates. LinkedIn/Indeed have no public APIs (partner-only licensing) — JSearch is the sanctioned aggregator path for broader market coverage.
2. **Transparent AI matching** — every job shows a score breakdown (skills 40%, title 20%, location 15%, salary 15%, recency 10%) and a plain-language reason. Not a black box.
3. **Resume-driven, zero typing** — upload CV, profile is prefilled. The resume IS the search query.
4. **Bilingual by design** — EN/DE toggle in the header; job postings are translated on the detail page with Google's free web translate endpoint and cached per job/language in `job_translations`, with an offline dictionary fallback. It avoids Anthropic/API-key dependency.

The UI is deliberately boring and clear (LinkedIn/StepStone patterns). The system underneath is the product.

## User journey
1. **Sign up** → email/password (works today).
2. **Onboard** → upload resume (PDF/DOCX) → parsed skills, target titles, seniority shown as editable chips → confirm locations + salary floor + remote pref via standardized dropdowns. No free-text walls.
3. **Land on Dashboard** → two sections:
   - **AI Matches** — "we did the work": top-ranked jobs against your resume, capped at **10 latest for free**.
   - **Discover** — "you search": keyword bar + filters (location, remote, salary min, seniority, source) + sort (best match / newest / salary). Standard list of cards.
4. **Act on a job** → each card: score badge, why-it-fits reason, Save / Hide / Apply (external link). Saved & applied tracked on /saved.
5. **Return loop** → come back daily, see what's new; upgrade when 10 matches isn't enough.

## Pages (information architecture)
| Page | Purpose | Status |
|---|---|---|
| `/` | Marketing (logged out) / Dashboard (logged in) | exists, needs dashboard split |
| `/onboarding` | Resume upload + dropdown profile setup | exists, resume step is on /profile — move it here |
| `/discover` | Search + filters + sort over all jobs | **new** (today it's just the raw feed on `/`) |
| `/profile` | Resume, parsed metadata, profile edit, GDPR export/delete | exists |
| `/saved` | Saved + applied pipeline | exists, needs "applied" status |
| `/login`, legal pages | Auth, Impressum/Privacy/Terms | done |

## Monetization
- **Free:** 10 latest AI matches, full Discover search, save/hide.
- **Paid (later, Stripe):** unlimited AI matches and alerts/email digest.
- The cap is the paywall lever — build the cap now, payments as a separate phase.

## MVP scope
**Already built:** auth, multi-source ingestion + dedup + scoring engine, resume parsing (Claude + offline fallback), profile CRUD, save/hide, GDPR export/delete, SEO pages, DB fully migrated.

**To build for MVP:**
1. ~~Discover page: filter bar + sort + server-side filtered query~~ ✅ shipped
2. ~~AI Match Runs: "Run AI matching" button ingests fresh jobs for the user's titles×locations on demand (solves cold start), records run stats, 5 runs/day free, top 10 results~~ ✅ shipped
3. Standardized dropdowns for skills/titles/seniority (taxonomy exists in `packages/core`) with an "other" escape hatch
4. Dashboard split of `/` (stats strip: new / saved / applied counts)
5. "Mark applied" action + applied view on /saved
6. EN/DE UI language toggle (profile-level, i18n strings only)

**Explicitly NOT in MVP:** payments integration, email alerts, mobile app, more sources.

## Build order
1. Discover (filters + sort) — biggest visible gap, cheapest to build on existing feed
2. AI Matches + free cap — creates the upgrade story
3. Dropdown taxonomy + onboarding polish — data quality
4. Dashboard split + applied tracking — retention loop
5. EN/DE UI toggle — reach
