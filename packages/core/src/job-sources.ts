import { expandSearchTerm } from "./search-expansion.js";

export const DIRECT_JOB_SOURCES = [
  "Arbeitsagentur",
  "Arbeitnow",
  "Remotive",
  "Jobicy",
  "The Muse",
  "Adzuna",
  "Jooble"
] as const;

/** All publishers we recognize from JSearch `job_publisher` (used for badges + filter matching). */
export const JSEARCH_PUBLISHER_SOURCES = [
  "Indeed",
  "XING",
  "LinkedIn",
  "Stepstone",
  "Stellenanzeigen.de",
  "IT-Jobs.de",
  "GermanTechJobs",
  "Glassdoor",
  "Monster"
] as const;

/** Publishers shown in the Discover source filter. */
export const JSEARCH_FILTER_SOURCES = ["Indeed", "XING", "Stepstone", "GermanTechJobs"] as const;

/** Legacy label for rows ingested before publisher-level tagging. */
export const LEGACY_JSEARCH_SOURCE = "JSearch" as const;

export const DISCOVER_SOURCE_OPTIONS = [
  "",
  "Adzuna",
  "Jooble",
  "Arbeitsagentur",
  "Arbeitnow",
  "Remotive",
  "Jobicy",
  ...JSEARCH_FILTER_SOURCES
] as const;

/** Builds a Google-for-Jobs style query, e.g. "product jobs" or "developer jobs in berlin". */
export function buildJSearchQuery(keyword: string, location = ""): string {
  const term = keyword.trim();
  const city = location.trim();
  if (!term && !city) return "";
  if (!term) return `jobs in ${city}`;
  const role = /\bjobs?\b/i.test(term) ? term : `${term} jobs`;
  if (!city) return role;
  return `${role} in ${city}`;
}

export function buildJSearchQueries(keyword: string, location = ""): string[] {
  const primary = buildJSearchQuery(keyword, location);
  if (!primary) return [];

  const localized = localizedJSearchTerms(keyword)
    .map((term) => buildJSearchQuery(term, location))
    .filter(Boolean);
  return Array.from(new Set([primary, ...localized])).slice(0, 4);
}

function localizedJSearchTerms(keyword: string): string[] {
  const term = keyword.trim();
  if (!term) return [];

  const replacements: Array<[RegExp, string]> = [
    [/\bfrontend developer\b/gi, "frontend entwickler"],
    [/\bbackend developer\b/gi, "backend entwickler"],
    [/\bfull stack developer\b/gi, "full stack entwickler"],
    [/\bfullstack developer\b/gi, "fullstack entwickler"],
    [/\bsoftware developer\b/gi, "softwareentwickler"],
    [/\bsoftware engineer\b/gi, "softwareentwickler"],
    [/\bdeveloper\b/gi, "entwickler"],
    [/\bengineer\b/gi, "ingenieur"]
  ];

  const variants = new Set<string>();
  for (const [pattern, replacement] of replacements) {
    const next = term.replace(pattern, replacement);
    if (next !== term) variants.add(next);
  }
  return Array.from(variants);
}

/** Maps JSearch `job_publisher` to the source badge shown in the UI. */
export function publisherToSourceName(publisher: string | null | undefined): string {
  if (!publisher?.trim()) return LEGACY_JSEARCH_SOURCE;

  const lower = publisher.toLowerCase().trim();
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("xing")) return "XING";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("stepstone")) return "Stepstone";
  if (lower.includes("glassdoor")) return "Glassdoor";
  if (lower.includes("monster")) return "Monster";
  if (lower.includes("stellenanzeigen")) return "Stellenanzeigen.de";
  if (lower.includes("it-jobs")) return "IT-Jobs.de";
  if (lower.includes("germantechjobs")) return "GermanTechJobs";
  if (lower.includes("get-in-it") || lower.includes("get in it")) return "Get in IT";
  if (lower.includes("devjobs")) return "DEVjobs.de";

  return publisher.trim();
}

/** Infer the job board from an apply URL when `job_publisher` is missing or generic. */
export function publisherFromApplyUrl(applyUrl: string | null | undefined): string | null {
  if (!applyUrl?.trim()) return null;

  const lower = applyUrl.toLowerCase();
  const rules: Array<[string, string]> = [
    ["indeed.", "Indeed"],
    ["xing.com", "XING"],
    ["new-work.", "XING"],
    ["linkedin.com", "LinkedIn"],
    ["stepstone.", "Stepstone"],
    ["germantechjobs", "GermanTechJobs"],
    ["it-jobs.de", "IT-Jobs.de"],
    ["stellenanzeigen.de", "Stellenanzeigen.de"],
    ["get-in-it", "Get in IT"],
    ["getin.it", "Get in IT"],
    ["devjobs.de", "DEVjobs.de"],
    ["arbeitnow.com", "Arbeitnow"],
    ["arbeitsagentur.de", "Arbeitsagentur"],
    ["jobicy.com", "Jobicy"],
    ["themuse.com", "The Muse"]
  ];

  for (const [needle, name] of rules) {
    if (lower.includes(needle)) return name;
  }

  try {
    const host = new URL(applyUrl).hostname.replace(/^www\./, "");
    if (!host || host.includes("google.com") || host.includes("google.de")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Best source label for a job card — publisher field first, then apply URL, never generic JSearch when we can do better. */
export function resolveJobSourceName(publisher: string | null | undefined, applyUrl?: string | null): string {
  const fromPublisher = publisher?.trim() ? publisherToSourceName(publisher) : null;
  if (fromPublisher && fromPublisher !== LEGACY_JSEARCH_SOURCE) return fromPublisher;

  const fromUrl = publisherFromApplyUrl(applyUrl);
  if (fromUrl) return fromUrl;

  return fromPublisher ?? LEGACY_JSEARCH_SOURCE;
}

/** Source badges for the UI — hides generic JSearch when a specific publisher is known. */
export function displaySourceNames(sourceNames: string[]): string[] {
  const specific = sourceNames.filter((name) => name !== LEGACY_JSEARCH_SOURCE);
  return specific.length ? specific : sourceNames;
}

export function isDirectJobSource(source: string): boolean {
  return (DIRECT_JOB_SOURCES as readonly string[]).includes(source);
}

export function isJSearchBackedSource(source: string): boolean {
  return (
    source === LEGACY_JSEARCH_SOURCE ||
    (JSEARCH_PUBLISHER_SOURCES as readonly string[]).includes(source)
  );
}

export type DiscoverSearchFilters = {
  q?: string;
  location?: string;
};

export function hasDiscoverSearch(filters: DiscoverSearchFilters): boolean {
  return Boolean(filters.q?.trim() || filters.location?.trim());
}

export function parseDiscoverTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, "").trim())
    .filter(Boolean);
}

/**
 * Title-anchored relevance score (0 = not a match, higher = more relevant).
 * Modeled on how Indeed/LinkedIn rank job-title searches: the TITLE is what
 * matters. Description text is used only to confirm a term is present, never
 * to anchor a result — otherwise a "Backend Engineer" whose description says
 * "work with the Product Owner" wrongly matches a "product owner" search.
 *
 * Rules (terms are EN↔DE synonym-expanded, so "developer"↔"Entwickler"):
 * - every query term must appear somewhere (title, company, or description);
 * - at least one term must appear in the title or company (the anchor) —
 *   description-only matches score 0 and are dropped;
 * - single-word queries must match the title or company.
 * Score rewards title matches and exact-phrase title hits.
 */
export function scoreDiscoverRelevance(
  job: { title: string; company: string; description?: string },
  query: string
): number {
  const terms = parseDiscoverTerms(query);
  if (!terms.length) return 1;

  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const description = (job.description ?? "").toLowerCase();
  const titleCompany = `${title} ${company}`;

  const phrase = terms.join(" ");
  const phraseInTitle = title.includes(phrase);

  let titleHits = 0;
  let companyHits = 0;
  let anywhereHits = 0;

  for (const term of terms) {
    const variants = expandSearchTerm(term);
    const inTitle = variants.some((v) => title.includes(v));
    const inCompany = variants.some((v) => company.includes(v));
    const inDescription = variants.some((v) => description.includes(v));

    if (inTitle) titleHits += 1;
    if (inCompany) companyHits += 1;
    if (inTitle || inCompany || inDescription) anywhereHits += 1;
  }

  // Every term must be present somewhere, and the result must be anchored to
  // the title/company — not matched purely on description text.
  if (anywhereHits < terms.length) return 0;
  if (titleHits === 0 && companyHits === 0) return 0;
  if (terms.length === 1 && titleHits === 0 && companyHits === 0) return 0;

  let score = 0;
  if (phraseInTitle) score += 100;
  score += (titleHits / terms.length) * 60;
  if (titleHits === terms.length) score += 20; // all terms in the title
  score += (companyHits / terms.length) * 10;
  return Math.max(score, 1);
}

/** Boolean form for filtering live-API results. */
export function jobMatchesDiscoverQuery(
  job: { title: string; company: string; description?: string },
  query: string
): boolean {
  return scoreDiscoverRelevance(job, query) > 0;
}
