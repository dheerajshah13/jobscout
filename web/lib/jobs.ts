import type { SupabaseClient } from "@supabase/supabase-js";
import {
  explainMatch,
  scoreJob,
  totalScore,
  expandLocationTerm,
  expandSearchTerm,
  hasDiscoverSearch,
  parseDiscoverTerms,
  scoreDiscoverRelevance,
  LEGACY_JSEARCH_SOURCE,
  resolveJobSourceName,
  type Job,
  type MatchStatus,
  type Profile,
  type ScoreBreakdown
} from "@jobscout/core";
import { demoProfile, rankedMatches } from "./seed-data";
import { getProfile } from "./profile";

const EMPTY_BREAKDOWN: ScoreBreakdown = { skills: 0, title: 0, location: 0, salary: 0, recency: 0 };

type JobRow = {
  id: string;
  fingerprint: string;
  title: string;
  company: string;
  location: string;
  remote: Job["remote"];
  salary_min: number | null;
  salary_max: number | null;
  currency: "EUR";
  description: string;
  apply_url: string;
  posted_at: string;
  first_seen_at: string;
  last_seen_at: string;
  status: Job["status"];
  job_sources?: Array<{ source_name: string }>;
};

const JOB_COLUMNS =
  "id,fingerprint,title,company,location,remote,salary_min,salary_max,currency,description,apply_url,posted_at,first_seen_at,last_seen_at,status,job_sources(source_name)";

export type RankedJob = {
  job: Job;
  score: number;
  scoreBreakdown: ReturnType<typeof scoreJob>;
  reason: string;
  matchStatus: MatchStatus | null;
};

export type Feed = {
  matches: RankedJob[];
  profile: Profile;
  /** true when there's no saved profile for this user yet, so we fell back to a demo profile for the preview. */
  isDemoProfile: boolean;
};

function rank(jobs: Job[], profile: Profile, statusByJobId: Map<string, MatchStatus>): RankedJob[] {
  return jobs.map((job) => {
    const scoreBreakdown = scoreJob(job, profile);
    return {
      job,
      scoreBreakdown,
      score: totalScore(scoreBreakdown),
      reason: explainMatch(job, profile, scoreBreakdown),
      matchStatus: statusByJobId.get(job.id) ?? null
    };
  });
}

async function loadStatusByJobId(
  supabase: SupabaseClient,
  userId: string | null,
  jobIds: string[]
): Promise<Map<string, MatchStatus>> {
  const statusByJobId = new Map<string, MatchStatus>();
  if (!userId || !jobIds.length) return statusByJobId;

  const { data } = await supabase.from("matches").select("job_id,status").eq("user_id", userId).in("job_id", jobIds);

  data?.forEach((row) => statusByJobId.set(row.job_id as string, row.status as MatchStatus));
  return statusByJobId;
}

/** Best-effort persistence so save/hide has a row to act on. Never throws — a failed write (e.g. RLS not yet migrated) shouldn't break the feed. */
async function persistMatches(supabase: SupabaseClient, userId: string, matches: RankedJob[]): Promise<void> {
  if (!matches.length) return;

  const rows = matches.map((match) => ({
    user_id: userId,
    job_id: match.job.id,
    score: match.score,
    score_breakdown: match.scoreBreakdown,
    reason: match.reason,
    status: match.matchStatus ?? "new"
  }));

  await supabase.from("matches").upsert(rows, { onConflict: "user_id,job_id" });
}

/**
 * The main ranked feed for a user. Falls back to the bundled demo profile
 * (marketing preview) when the visitor is anonymous or hasn't completed
 * onboarding yet. Hidden jobs are excluded; saved/new status carries through
 * so the UI can reflect it.
 */
export async function getFeed(supabase: SupabaseClient, userId: string | null, limit = 20): Promise<Feed> {
  const savedProfile = userId ? await getProfile(supabase, userId) : null;
  const profile = savedProfile ?? demoProfile;
  const isDemoProfile = !savedProfile;

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("status", "active")
    .order("posted_at", { ascending: false })
    .limit(Math.max(limit * 4, 80));

  const jobs: Job[] = error || !data?.length ? rankedMatches.map((match) => match.job) : (data as JobRow[]).map(toJob);

  const statusByJobId = await loadStatusByJobId(supabase, userId, jobs.map((job) => job.id));
  const ranked = rank(jobs, profile, statusByJobId)
    .filter((match) => match.matchStatus !== "hidden")
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (userId) {
    await persistMatches(supabase, userId, ranked);
  }

  return { matches: ranked, profile, isDemoProfile };
}

export type DiscoverFilters = {
  q?: string;
  location?: string;
  remote?: Job["remote"];
  minSalary?: number;
  source?: string;
  postedWithin?: "1h" | "12h" | "24h" | "3d" | "7d";
  sort?: "newest" | "salary";
};

export type DiscoverResult = {
  matches: RankedJob[];
  total: number;
  page: number;
  pageCount: number;
  /** True when the strict all-terms search found nothing and results come from the any-term fallback. */
  broadened: boolean;
};

export const DISCOVER_PAGE_SIZE = 20;

/** Strips characters that PostgREST or-filter strings can't contain safely. */
function sanitizeFilterTerm(term: string): string {
  return term.replace(/[,()%.*]/g, "").trim();
}

/** One PostgREST or-group: the term (or any EN↔DE synonym variant) appears in one of the fields. */
function termOrGroup(term: string, fields: string[]): string {
  const variants = expandSearchTerm(term)
    .map(sanitizeFilterTerm)
    .filter(Boolean);
  return variants.flatMap((variant) => fields.map((field) => `${field}.ilike.*${variant}*`)).join(",");
}

/** Upper bound on candidate rows pulled from Postgres before relevance ranking. */
const SEARCH_CANDIDATE_LIMIT = 400;

/**
 * Powers the /discover page. Requires a keyword or city — returns nothing until
 * the user searches. Precision matters more than raw recall here:
 * - Postgres does a broad synonym-expanded fetch (EN↔DE: "developer"↔
 *   "Entwickler", "Munich"↔"München") to gather candidates;
 * - results are then ranked by TITLE-anchored relevance (`scoreDiscoverRelevance`)
 *   so a "product owner" search returns product-owner roles, not engineering
 *   jobs that merely mention a product owner in the description;
 * - description-only matches are dropped (score 0);
 * - ranking + pagination happen in JS over the candidate set (small pool),
 *   so counts stay accurate.
 * Results always display newest postings first by default; relevance is used
 * to filter out description-only noise, not to move older jobs above newer ones.
 */
export async function searchJobs(
  supabase: SupabaseClient,
  userId: string | null,
  filters: DiscoverFilters,
  page = 1,
  pageSize = DISCOVER_PAGE_SIZE
): Promise<DiscoverResult> {
  if (!hasDiscoverSearch(filters)) {
    return { matches: [], total: 0, page: 1, pageCount: 0, broadened: false };
  }

  const terms = parseDiscoverTerms(filters.q ?? "").slice(0, 6);

  const columns = filters.source ? JOB_COLUMNS.replace("job_sources(", "job_sources!inner(") : JOB_COLUMNS;
  let query = supabase.from("jobs").select(columns).eq("status", "active");

  // Broad candidate net: any term (synonym-expanded) in title/company/description.
  if (terms.length) {
    query = query.or(terms.map((term) => termOrGroup(term, ["title", "company", "description"])).join(","));
  }

  const location = filters.location ? sanitizeFilterTerm(filters.location) : "";
  if (location) {
    const variants = expandLocationTerm(location).map(sanitizeFilterTerm).filter(Boolean);
    query = query.or(variants.map((variant) => `location.ilike.*${variant}*`).join(","));
  }

  if (filters.remote) query = query.eq("remote", filters.remote);
  if (filters.minSalary) query = query.or(`salary_min.gte.${filters.minSalary},salary_max.gte.${filters.minSalary}`);
  if (filters.source) query = query.eq("job_sources.source_name", filters.source);
  if (filters.postedWithin) query = query.gte("posted_at", postedSince(filters.postedWithin));

  const { data, error } = await query
    .order("posted_at", { ascending: false })
    .limit(SEARCH_CANDIDATE_LIMIT);

  const candidates: Job[] = error || !data ? [] : (data as unknown as JobRow[]).map(toJob);

  // Rank by title-anchored relevance; drop description-only (score 0) matches.
  let scored = candidates
    .map((job) => ({ job, relevance: terms.length ? scoreDiscoverRelevance(job, filters.q ?? "") : 1 }))
    .filter((entry) => entry.relevance > 0);

  // A keyword that only matched descriptions leaves nothing — fall back to the
  // raw candidate set (recency-ordered) so the user still sees related jobs.
  let broadened = false;
  if (terms.length && scored.length === 0 && candidates.length > 0) {
    scored = candidates.map((job) => ({ job, relevance: 1 }));
    broadened = true;
  }

  scored.sort((a, b) => {
    if (filters.sort === "salary") {
      const bSalary = b.job.salaryMax ?? b.job.salaryMin ?? 0;
      const aSalary = a.job.salaryMax ?? a.job.salaryMin ?? 0;
      if (bSalary !== aSalary) return bSalary - aSalary;
    }
    return Date.parse(b.job.postedAt) - Date.parse(a.job.postedAt);
  });

  const total = scored.length;
  const from = (Math.max(1, page) - 1) * pageSize;
  const pageJobs = scored.slice(from, from + pageSize).map((entry) => entry.job);

  const statusByJobId = await loadStatusByJobId(supabase, userId, pageJobs.map((job) => job.id));
  const matches = toDiscoverMatches(pageJobs, statusByJobId);

  return { matches, total, page: Math.max(1, page), pageCount: Math.max(1, Math.ceil(total / pageSize)), broadened };
}

function toDiscoverMatches(jobs: Job[], statusByJobId: Map<string, MatchStatus>): RankedJob[] {
  return jobs.map((job) => ({
    job,
    score: 0,
    scoreBreakdown: EMPTY_BREAKDOWN,
    reason: "",
    matchStatus: statusByJobId.get(job.id) ?? null
  }));
}

function postedSince(value: NonNullable<DiscoverFilters["postedWithin"]>): string {
  const hoursByValue = {
    "1h": 1,
    "12h": 12,
    "24h": 24,
    "3d": 72,
    "7d": 168
  } satisfies Record<NonNullable<DiscoverFilters["postedWithin"]>, number>;

  return new Date(Date.now() - hoursByValue[value] * 60 * 60 * 1000).toISOString();
}

/** Distinct recent job titles for the search box's native suggestion dropdown. */
export async function getTitleSuggestions(supabase: SupabaseClient, limit = 40): Promise<string[]> {
  const { data } = await supabase
    .from("jobs")
    .select("title")
    .eq("status", "active")
    .order("posted_at", { ascending: false })
    .limit(300);

  const seen = new Set<string>();
  const titles: string[] = [];
  for (const row of data ?? []) {
    const title = (row.title as string).trim();
    const key = title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      titles.push(title);
      if (titles.length >= limit) break;
    }
  }
  return titles;
}

export async function getJobById(supabase: SupabaseClient, userId: string | null, id: string): Promise<RankedJob | null> {
  const savedProfile = userId ? await getProfile(supabase, userId) : null;
  const profile = savedProfile ?? demoProfile;

  const { data, error } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).eq("status", "active").single();

  if (error || !data) {
    const fallback = rankedMatches.find((match) => match.job.id === id);
    return fallback ? { ...fallback, matchStatus: null } : null;
  }

  const job = toJob(data as JobRow);
  const statusByJobId = await loadStatusByJobId(supabase, userId, [job.id]);
  const [ranked] = rank([job], profile, statusByJobId);

  if (userId) {
    await persistMatches(supabase, userId, [ranked]);
  }

  return ranked;
}

export type SavedMatch = RankedJob & { status: MatchStatus };

/** Powers the /saved page: everything the user has explicitly saved, applied to, or hidden. */
export async function getSavedAndHidden(supabase: SupabaseClient, userId: string): Promise<SavedMatch[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(`status,score,score_breakdown,reason,job:jobs(${JOB_COLUMNS})`)
    .eq("user_id", userId)
    .in("status", ["saved", "applied", "hidden"])
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => row.job)
    .map((row) => {
      const job = toJob(row.job as unknown as JobRow);
      return {
        job,
        score: row.score as number,
        scoreBreakdown: row.score_breakdown as ReturnType<typeof scoreJob>,
        reason: (row.reason as string) ?? "",
        matchStatus: row.status as MatchStatus,
        status: row.status as MatchStatus
      };
    });
}

export type ExportMatch = {
  jobTitle: string;
  company: string;
  score: number;
  status: MatchStatus;
};

/** Full match history for a user, for the GDPR data export — every status, not just saved/hidden. */
export async function getAllMatchesForExport(supabase: SupabaseClient, userId: string): Promise<ExportMatch[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("status,score,job:jobs(title,company)")
    .eq("user_id", userId)
    .order("score", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => row.job)
    .map((row) => {
      const job = row.job as unknown as { title: string; company: string };
      return {
        jobTitle: job.title,
        company: job.company,
        score: row.score as number,
        status: row.status as MatchStatus
      };
    });
}

export function toJob(row: JobRow): Job {
  const rawSourceNames = Array.from(new Set(row.job_sources?.map((source) => source.source_name) ?? []));
  const sourceNames = enrichSourceNames(rawSourceNames, row.apply_url);

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: row.title,
    company: row.company,
    location: row.location,
    remote: row.remote,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    currency: row.currency,
    description: row.description,
    applyUrl: row.apply_url,
    sourceNames,
    postedAt: row.posted_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    status: row.status
  };
}

function enrichSourceNames(sourceNames: string[], applyUrl: string): string[] {
  const onlyLegacy =
    sourceNames.length > 0 && sourceNames.every((name) => name === LEGACY_JSEARCH_SOURCE);
  if (!onlyLegacy) return sourceNames;

  const inferred = resolveJobSourceName(null, applyUrl);
  return inferred !== LEGACY_JSEARCH_SOURCE ? [inferred] : sourceNames;
}
