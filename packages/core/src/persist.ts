import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, SearchSegment } from "./index.js";
import { isGermanyJob, type NormalizedSourceJob } from "./pipeline.js";

type PersistResult = {
  upsertedJobs: number;
  upsertedSources: number;
  segmentId: string | null;
};

export type FreshnessResult = {
  markedStale: number;
  markedExpired: number;
};

export type CountrySweepResult = {
  markedExpired: number;
};

const STALE_AFTER_DAYS = 14;
const EXPIRED_AFTER_DAYS = 28;

/**
 * Build plan §7 step 4: a job not seen by any source for 14 days moves to
 * "stale"; 14 more days with no sighting (28 total) moves it to "expired"
 * and it drops out of feeds. This runs against the whole table, not just
 * the segment that was just ingested, since a job can go quiet without any
 * segment re-fetching it.
 */
export async function sweepJobFreshness(supabase: SupabaseClient): Promise<FreshnessResult> {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_AFTER_DAYS * 86_400_000).toISOString();
  const expiredCutoff = new Date(now - EXPIRED_AFTER_DAYS * 86_400_000).toISOString();

  const { data: staled, error: staleError } = await supabase
    .from("jobs")
    .update({ status: "stale" })
    .eq("status", "active")
    .lt("last_seen_at", staleCutoff)
    .select("id");

  if (staleError) throw staleError;

  const { data: expired, error: expiredError } = await supabase
    .from("jobs")
    .update({ status: "expired" })
    .eq("status", "stale")
    .lt("last_seen_at", expiredCutoff)
    .select("id");

  if (expiredError) throw expiredError;

  return {
    markedStale: staled?.length ?? 0,
    markedExpired: expired?.length ?? 0
  };
}

export async function sweepNonGermanyJobs(supabase: SupabaseClient): Promise<CountrySweepResult> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,fingerprint,title,company,location,remote,salary_min,salary_max,currency,description,apply_url,posted_at,first_seen_at,last_seen_at,status")
    .eq("status", "active");

  if (error) throw error;

  const segment: SearchSegment = {
    keyword: "",
    location: "Germany",
    activeUserCount: 0,
    lastFetchedAt: null
  };
  const outsideGermanyIds = (data ?? [])
    .map((row) => ({ id: String(row.id), job: fromJobRow(row) }))
    .filter(({ job }) => !isGermanyJob(job, segment))
    .map(({ id }) => id);

  for (let index = 0; index < outsideGermanyIds.length; index += 100) {
    const ids = outsideGermanyIds.slice(index, index + 100);
    const { error: updateError } = await supabase.from("jobs").update({ status: "expired" }).in("id", ids);
    if (updateError) throw updateError;
  }

  return { markedExpired: outsideGermanyIds.length };
}

export async function persistSegmentRun(
  supabase: SupabaseClient,
  segment: SearchSegment,
  uniqueJobs: Job[],
  sourceJobs: NormalizedSourceJob[]
): Promise<PersistResult> {
  const { data: segmentRow, error: segmentError } = await supabase
    .from("search_segments")
    .upsert(
      {
        keyword: segment.keyword,
        location: segment.location,
        active_user_count: segment.activeUserCount,
        last_fetched_at: new Date().toISOString()
      },
      { onConflict: "keyword,location" }
    )
    .select("id")
    .single();

  if (segmentError) throw segmentError;

  const jobRows = uniqueJobs.map(toJobRow);
  const { data: persistedJobs, error: jobsError } = await supabase
    .from("jobs")
    .upsert(jobRows, { onConflict: "fingerprint" })
    .select("id,fingerprint");

  if (jobsError) throw jobsError;

  const jobIdByFingerprint = new Map<string, string>(
    (persistedJobs ?? []).map((job) => [String(job.fingerprint), String(job.id)])
  );

  const sourceRows = sourceJobs.flatMap(({ raw, job }) => {
    const jobId = jobIdByFingerprint.get(job.fingerprint);
    if (!jobId) return [];

    const sourceNames = Array.from(new Set(job.sourceNames.length ? job.sourceNames : [raw.source]));
    return sourceNames.map((sourceName) => ({
      job_id: jobId,
      source_name: sourceName,
      source_job_id: raw.sourceId,
      source_url: raw.sourceUrl,
      raw_payload: raw.payload
    }));
  });

  if (sourceRows.length) {
    const { error: sourcesError } = await supabase
      .from("job_sources")
      .upsert(sourceRows, { onConflict: "source_name,source_job_id" });

    if (sourcesError) throw sourcesError;
  }

  return {
    upsertedJobs: persistedJobs?.length ?? 0,
    upsertedSources: sourceRows.length,
    segmentId: segmentRow?.id ? String(segmentRow.id) : null
  };
}

function toJobRow(job: Job) {
  return {
    fingerprint: job.fingerprint,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    currency: job.currency,
    description: job.description,
    apply_url: job.applyUrl,
    posted_at: job.postedAt,
    first_seen_at: job.firstSeenAt,
    last_seen_at: job.lastSeenAt,
    status: job.status
  };
}

function fromJobRow(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location),
    remote: row.remote === "full" || row.remote === "hybrid" ? row.remote : "none",
    salaryMin: typeof row.salary_min === "number" ? row.salary_min : null,
    salaryMax: typeof row.salary_max === "number" ? row.salary_max : null,
    currency: "EUR",
    description: String(row.description ?? ""),
    applyUrl: String(row.apply_url),
    sourceNames: [],
    postedAt: String(row.posted_at),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    status: row.status === "stale" || row.status === "expired" ? row.status : "active"
  };
}
