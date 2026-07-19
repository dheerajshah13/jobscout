import { createJoobleAdapter, isGermanyJob, jobMatchesDiscoverQuery } from "@jobscout/core";
import type { DiscoverFilters } from "./jobs";
import type { LiveJob } from "./persist-live-jobs";

function joobleApiKey(): string | undefined {
  return process.env.JOOBLE_API_KEY;
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
  if (filters.remote) {
    filtered = filtered.filter((entry) => entry.job.remote === filters.remote);
  }
  if (filters.minSalary) {
    filtered = filtered.filter(
      (entry) =>
        (entry.job.salaryMax ?? entry.job.salaryMin ?? 0) >= filters.minSalary! ||
        (entry.job.salaryMin == null && entry.job.salaryMax == null)
    );
  }
  if (filters.postedWithin) {
    const cutoff = postedSince(filters.postedWithin);
    filtered = filtered.filter((entry) => Date.parse(entry.job.postedAt) >= cutoff);
  }

  return filtered;
}

export function shouldFetchDiscoverJooble(filters: DiscoverFilters): boolean {
  if (!joobleApiKey()) return false;
  if (!filters.q?.trim() && !filters.location?.trim()) return false;
  if (filters.source && filters.source !== "Jooble") return false;
  return true;
}

/** Live Jooble results (raw + normalized) to supplement the Supabase pool on Discover. */
export async function fetchDiscoverJoobleJobs(filters: DiscoverFilters): Promise<LiveJob[]> {
  const apiKey = joobleApiKey();
  if (!apiKey || !shouldFetchDiscoverJooble(filters)) return [];

  const adapter = createJoobleAdapter({ apiKey });
  const segment = {
    keyword: filters.q?.trim() ?? "",
    location: filters.location?.trim() ?? "",
    activeUserCount: 1,
    lastFetchedAt: null
  };

  const timeout = new Promise<LiveJob[]>((resolve) => setTimeout(() => resolve([]), 5_000));

  const fetchJobs = (async () => {
    const raw = await adapter.fetch(segment);
    const entries = raw
      .map((row) => ({ raw: row, job: adapter.normalize(row) }))
      .filter((entry) => isGermanyJob(entry.job, segment));
    return applyDiscoverFilters(entries, filters);
  })().catch(() => [] as LiveJob[]);

  return Promise.race([fetchJobs, timeout]);
}
