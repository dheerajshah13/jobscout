import {
  buildJSearchQueries,
  buildJSearchQuery,
  createJSearchAdapter,
  fetchJSearchRows,
  isDirectJobSource,
  isGermanyJob,
  isJSearchBackedSource,
  jobMatchesDiscoverQuery,
  type Job
} from "@jobscout/core";
import type { DiscoverFilters } from "./jobs";
import type { LiveJob } from "./persist-live-jobs";

function jsearchApiKey(): string | undefined {
  return process.env.JSEARCH_API_KEY ?? process.env.RAPIDAPI_KEY;
}

function mapDatePosted(postedWithin: DiscoverFilters["postedWithin"]): string {
  if (!postedWithin) return "all";
  if (postedWithin === "1h" || postedWithin === "12h" || postedWithin === "24h") return "today";
  if (postedWithin === "3d") return "3days";
  if (postedWithin === "7d") return "week";
  return "all";
}

function postedSince(value: NonNullable<DiscoverFilters["postedWithin"]>): number {
  const hours = { "1h": 1, "12h": 12, "24h": 24, "3d": 72, "7d": 168 } as const;
  return Date.now() - hours[value] * 60 * 60 * 1000;
}

function applyDiscoverFilters(entries: LiveJob[], filters: DiscoverFilters): LiveJob[] {
  let filtered = entries;

  if (filters.q?.trim()) {
    filtered = filtered.filter((entry) => jobMatchesDiscoverQuery(entry.job, filters.q!));
  }

  if (filters.remote === "full" || filters.remote === "none" || filters.remote === "hybrid") {
    filtered = filtered.filter((entry) => entry.job.remote === filters.remote);
  }

  if (filters.minSalary) {
    filtered = filtered.filter(
      (entry) =>
        (entry.job.salaryMax ?? entry.job.salaryMin ?? 0) >= filters.minSalary! ||
        (entry.job.salaryMin == null && entry.job.salaryMax == null)
    );
  }

  if (filters.source) {
    filtered = filtered.filter((entry) => entry.job.sourceNames.includes(filters.source!));
  }

  if (filters.postedWithin) {
    const cutoff = postedSince(filters.postedWithin);
    filtered = filtered.filter((entry) => Date.parse(entry.job.postedAt) >= cutoff);
  }

  return filtered;
}

export function shouldFetchDiscoverJSearch(filters: DiscoverFilters): boolean {
  if (!jsearchApiKey()) return false;
  if (!buildJSearchQuery(filters.q ?? "", filters.location ?? "")) return false;
  if (filters.source && isDirectJobSource(filters.source)) return false;
  if (filters.source && !isJSearchBackedSource(filters.source)) return false;
  return true;
}

/** Live JSearch results (raw + normalized) to supplement the Supabase pool on Discover. */
export async function fetchDiscoverJSearchJobs(filters: DiscoverFilters): Promise<LiveJob[]> {
  const apiKey = jsearchApiKey();
  if (!apiKey || !shouldFetchDiscoverJSearch(filters)) return [];

  const adapter = createJSearchAdapter({ apiKey });
  const rows = [];
  for (const query of buildJSearchQueries(filters.q ?? "", filters.location ?? "")) {
    try {
      rows.push(...(await fetchJSearchRows(apiKey, query, mapDatePosted(filters.postedWithin), filters.remote === "full")));
      if (rows.length) break;
    } catch {
      return [];
    }
  }

  const segment = {
    keyword: filters.q?.trim() ?? "",
    location: filters.location?.trim() ?? "Germany",
    activeUserCount: 1,
    lastFetchedAt: null
  };

  const entries = rows
    .map((raw) => ({ raw, job: adapter.normalize(raw) }))
    .filter((entry) => isGermanyJob(entry.job, segment));

  return applyDiscoverFilters(entries, filters);
}
