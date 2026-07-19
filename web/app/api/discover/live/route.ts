import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchDiscoverJSearchJobs, shouldFetchDiscoverJSearch } from "../../../../lib/jsearch-discover";
import { fetchDiscoverAdzunaJobs, shouldFetchDiscoverAdzuna } from "../../../../lib/adzuna-discover";
import { fetchDiscoverJoobleJobs, shouldFetchDiscoverJooble } from "../../../../lib/jooble-discover";
import { persistLiveJobs } from "../../../../lib/persist-live-jobs";
import type { DiscoverFilters } from "../../../../lib/jobs";

function parseFilters(searchParams: URLSearchParams): DiscoverFilters {
  const remote = searchParams.get("remote") ?? "";
  const posted = searchParams.get("posted") ?? "";
  const minSalary = Number.parseInt(searchParams.get("salary") ?? "", 10);

  return {
    q: searchParams.get("q") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    remote: remote === "none" || remote === "hybrid" || remote === "full" ? remote : undefined,
    minSalary: Number.isFinite(minSalary) && minSalary > 0 ? minSalary : undefined,
    source: searchParams.get("source") ?? undefined,
    postedWithin:
      posted === "1h" || posted === "12h" || posted === "24h" || posted === "3d" || posted === "7d" ? posted : undefined
  };
}

export async function GET(request: Request) {
  const filters = parseFilters(new URL(request.url).searchParams);

  const wantAdzuna = shouldFetchDiscoverAdzuna(filters);
  const wantJooble = shouldFetchDiscoverJooble(filters);
  const wantJSearch = shouldFetchDiscoverJSearch(filters);
  if (!wantAdzuna && !wantJooble && !wantJSearch) {
    return NextResponse.json({ jobs: [] });
  }

  const key = JSON.stringify(filters);
  // Persist inside the cached block so live jobs land in the shared pool with
  // real DB ids (clickable detail pages + descriptions) at most once per 300s.
  const jobs = await unstable_cache(
    async () => {
      const [adzuna, jooble, jsearch] = await Promise.all([
        wantAdzuna ? fetchDiscoverAdzunaJobs(filters) : Promise.resolve([]),
        wantJooble ? fetchDiscoverJoobleJobs(filters) : Promise.resolve([]),
        wantJSearch ? fetchDiscoverJSearchJobs(filters) : Promise.resolve([])
      ]);
      return persistLiveJobs([...adzuna, ...jooble, ...jsearch]);
    },
    ["discover-live", key],
    { revalidate: 300 }
  )();

  return NextResponse.json({ jobs });
}
