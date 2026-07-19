import type { Job, RawJob } from "@jobscout/core";
import { createSupabaseAdminClient } from "./supabase/admin";

export type LiveJob = { raw: RawJob; job: Job };

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
    last_seen_at: new Date().toISOString(),
    status: "active" as const
  };
}

/**
 * Persists live-fetched Discover jobs (Adzuna/Jooble/JSearch) into the shared
 * `jobs` pool and returns them carrying their REAL database UUIDs. Without this
 * the cards link to synthetic ids (`adzuna-…`) that 404 on the detail page and
 * have no stored description. Idempotent (upsert by fingerprint) and
 * best-effort — a write failure just returns the jobs with their original ids
 * so search still renders.
 */
export async function persistLiveJobs(liveJobs: LiveJob[]): Promise<Job[]> {
  if (!liveJobs.length) return [];

  // Collapse cross-source duplicates by fingerprint before writing.
  const byFingerprint = new Map<string, LiveJob>();
  for (const entry of liveJobs) {
    if (!byFingerprint.has(entry.job.fingerprint)) byFingerprint.set(entry.job.fingerprint, entry);
  }
  const unique = [...byFingerprint.values()];

  try {
    const admin = createSupabaseAdminClient();

    const { data: persisted, error } = await admin
      .from("jobs")
      .upsert(unique.map((entry) => toJobRow(entry.job)), { onConflict: "fingerprint" })
      .select("id,fingerprint");

    if (error || !persisted) return unique.map((entry) => entry.job);

    const idByFingerprint = new Map<string, string>(
      persisted.map((row) => [String(row.fingerprint), String(row.id)])
    );

    const sourceRows = unique.flatMap((entry) => {
      const jobId = idByFingerprint.get(entry.job.fingerprint);
      if (!jobId) return [];
      const sourceNames = Array.from(new Set([entry.raw.source, ...entry.job.sourceNames]));
      return sourceNames.map((sourceName) => ({
        job_id: jobId,
        source_name: sourceName,
        source_job_id: entry.raw.sourceId,
        source_url: entry.raw.sourceUrl,
        raw_payload: entry.raw.payload
      }));
    });
    if (sourceRows.length) {
      await admin.from("job_sources").upsert(sourceRows, { onConflict: "source_name,source_job_id" });
    }

    return unique.map((entry) => ({
      ...entry.job,
      id: idByFingerprint.get(entry.job.fingerprint) ?? entry.job.id
    }));
  } catch {
    return unique.map((entry) => entry.job);
  }
}
