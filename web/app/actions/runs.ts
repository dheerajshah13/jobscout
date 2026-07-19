"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  arbeitnowAdapter,
  arbeitsagenturAdapter,
  createAdzunaAdapter,
  createJoobleAdapter,
  createJSearchAdapter,
  ingestSegment,
  jobicyAdapter,
  persistSegmentRun,
  remotiveAdapter,
  theMuseAdapter,
  type SourceAdapter,
  type SearchSegment
} from "@jobscout/core";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getProfile } from "../../lib/profile";
import { FREE_RUNS_PER_DAY } from "../../lib/plan";

/** External-API cost control: one run fetches at most this many title×location segments. */
const MAX_SEGMENTS_PER_RUN = 3;
/** A job counts as "matched" in run stats when it scores at least this. */
const MATCH_THRESHOLD = 50;

/** Free direct sources plus any keyed aggregators (Adzuna, JSearch) that are configured. */
function buildAdapters(): SourceAdapter[] {
  const adapters: SourceAdapter[] = [
    arbeitsagenturAdapter,
    arbeitnowAdapter,
    remotiveAdapter,
    jobicyAdapter,
    theMuseAdapter
  ];

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    adapters.push(createAdzunaAdapter({ appId: process.env.ADZUNA_APP_ID, appKey: process.env.ADZUNA_APP_KEY }));
  }
  if (process.env.JOOBLE_API_KEY) {
    adapters.push(createJoobleAdapter({ apiKey: process.env.JOOBLE_API_KEY }));
  }
  if (process.env.JSEARCH_API_KEY) {
    adapters.push(createJSearchAdapter({ apiKey: process.env.JSEARCH_API_KEY }));
  }

  return adapters;
}

export type RunSummary = {
  ranAt: string;
  jobsScanned: number;
  jobsMatched: number;
  segments: Array<{ keyword: string; location: string }>;
};

export async function getRunUsage(userId: string): Promise<{ lastRun: RunSummary | null; usedToday: number }> {
  const supabase = await createSupabaseServerClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: last }, { count }] = await Promise.all([
    supabase
      .from("match_runs")
      .select("ran_at,jobs_scanned,jobs_matched,segments")
      .eq("user_id", userId)
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("match_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("ran_at", startOfDay.toISOString())
  ]);

  return {
    usedToday: count ?? 0,
    lastRun: last
      ? {
          ranAt: last.ran_at as string,
          jobsScanned: last.jobs_scanned as number,
          jobsMatched: last.jobs_matched as number,
          segments: (last.segments as RunSummary["segments"]) ?? []
        }
      : null
  };
}

/**
 * One user-triggered AI matching pass: fetch fresh jobs from every source for
 * the user's configured titles × locations, persist them into the shared job
 * pool, and record the run. The dashboard feed then rescores on revalidation.
 */
export async function runAiMatching() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/");

  const supabase = await createSupabaseServerClient();
  const profile = await getProfile(supabase, user.id);
  if (!profile || !profile.targetTitles.length) redirect("/onboarding");

  const { usedToday } = await getRunUsage(user.id);
  if (usedToday >= FREE_RUNS_PER_DAY) {
    redirect("/?runError=limit");
  }

  const locations = profile.locations.length ? profile.locations : ["Germany"];
  const segments: SearchSegment[] = profile.targetTitles
    .flatMap((title) => locations.map((location) => ({ keyword: title, location, activeUserCount: 1, lastFetchedAt: null })))
    .slice(0, MAX_SEGMENTS_PER_RUN);

  const admin = createSupabaseAdminClient();
  const adapters = buildAdapters();
  let jobsScanned = 0;
  let jobsMatched = 0;
  const sourceErrors: Array<{ source: string; message: string }> = [];

  for (const segment of segments) {
    const result = await ingestSegment(segment, adapters, [profile]);
    await persistSegmentRun(admin, segment, result.uniqueJobs, result.sourceJobs);
    jobsScanned += result.fetched;
    jobsMatched += result.matches.filter((match) => match.score >= MATCH_THRESHOLD).length;
    sourceErrors.push(...result.sourceErrors);
  }

  await supabase.from("match_runs").insert({
    user_id: user.id,
    segments: segments.map(({ keyword, location }) => ({ keyword, location })),
    jobs_scanned: jobsScanned,
    jobs_matched: jobsMatched,
    source_errors: sourceErrors
  });

  revalidatePath("/");
  redirect("/");
}
