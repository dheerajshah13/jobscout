"use client";

import { useEffect, useState } from "react";
import type { Job, MatchStatus, ScoreBreakdown } from "@jobscout/core";
import type { JobLanguage } from "../lib/translate";
import { JobCard } from "./job-card";

export type DiscoverMatch = {
  job: Job;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  matchStatus: MatchStatus | null;
};

type Props = {
  initialMatches: DiscoverMatch[];
  initialTotal: number;
  liveApiQuery: string;
  liveEnabled: boolean;
  signedIn: boolean;
  lang: JobLanguage;
  pageCount: number;
  page: number;
};

const emptyBreakdown = { skills: 0, title: 0, location: 0, salary: 0, recency: 0 };

export function DiscoverSearchResults({
  initialMatches,
  initialTotal,
  liveApiQuery,
  liveEnabled,
  signedIn,
  lang,
  pageCount,
  page
}: Props) {
  const [liveJobs, setLiveJobs] = useState<Job[]>([]);
  const [liveLoading, setLiveLoading] = useState(liveEnabled);

  useEffect(() => {
    if (!liveEnabled || !liveApiQuery) {
      setLiveJobs([]);
      setLiveLoading(false);
      return;
    }

    let cancelled = false;
    setLiveLoading(true);

    fetch(`/api/discover/live?${liveApiQuery}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { jobs?: Job[] };
        if (cancelled) return;
        const seen = new Set(initialMatches.map((match) => match.job.fingerprint));
        setLiveJobs((payload.jobs ?? []).filter((job) => !seen.has(job.fingerprint)));
      })
      .catch(() => {
        if (!cancelled) setLiveJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [liveApiQuery, liveEnabled, initialMatches]);

  const liveCount = page === 1 ? liveJobs.length : 0;
  const displayTotal = page === 1 ? initialTotal + liveCount : initialTotal;
  const waitingForLive = liveEnabled && liveLoading;
  const hasAnyResults = initialMatches.length > 0 || liveJobs.length > 0;
  const displayedMatches =
    page === 1
      ? [
          ...initialMatches,
          ...liveJobs.map((job) => ({
            job,
            score: 0,
            scoreBreakdown: emptyBreakdown,
            reason: "",
            matchStatus: null
          }))
        ].sort((a, b) => Date.parse(b.job.postedAt) - Date.parse(a.job.postedAt))
      : initialMatches;

  return (
    <>
      <p className="mt-6 text-sm font-semibold text-ink/60">
        {waitingForLive ? "Searching job boards…" : `${displayTotal} job${displayTotal === 1 ? "" : "s"} found`}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
        {!waitingForLive && liveCount > 0 ? ` · includes ${liveCount} live` : ""}
      </p>

      <div className="mt-3 space-y-4">
        {displayedMatches.map((match) => (
          <JobCard key={match.job.id} {...match} variant="plain" signedIn={signedIn} currentPath="/discover" lang={lang} />
        ))}

        {waitingForLive ? (
          <p className="py-6 text-center text-sm font-semibold text-ink/50">Loading live listings from Adzuna, Jooble, Indeed…</p>
        ) : null}

        {!waitingForLive && !hasAnyResults ? (
          <div className="rounded-lg border border-dashed border-line bg-white/70 p-8 text-center">
            <p className="text-lg font-semibold text-ink">No jobs match these filters.</p>
            <p className="mt-2 text-sm text-ink/65">
              Try different keywords — search matches role titles and descriptions, like LinkedIn, not exact phrases.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
