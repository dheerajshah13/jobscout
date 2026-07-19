import { explainMatch, normalizeText, scoreJob, totalScore, type Job, type Profile, type SearchSegment } from "./index.js";
import type { RawJob, SourceAdapter } from "./adapters/types.js";
import { GERMAN_CITIES } from "./german-cities.js";
import { expandLocationTerm } from "./search-expansion.js";

export type NormalizedSourceJob = {
  raw: RawJob;
  job: Job;
};

export type IngestionResult = {
  fetched: number;
  normalized: number;
  sourceJobs: NormalizedSourceJob[];
  uniqueJobs: Job[];
  matches: Array<{ job: Job; score: number; reason: string }>;
  sourceErrors: Array<{ source: string; message: string }>;
  sourceCounts: Record<string, number>;
};

export async function ingestSegment(segment: SearchSegment, adapters: SourceAdapter[], profiles: Profile[]): Promise<IngestionResult> {
  const fetched = await Promise.allSettled(adapters.map((adapter) => adapter.fetch(segment)));
  const rawJobs = fetched.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const sourceCounts = adapters.reduce<Record<string, number>>((counts, adapter, index) => {
    const result = fetched[index];
    counts[adapter.name] = result.status === "fulfilled" ? result.value.length : 0;
    return counts;
  }, {});
  const sourceErrors = fetched.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ source: adapters[index].name, message: result.reason instanceof Error ? result.reason.message : String(result.reason) }]
      : []
  );
  const sourceJobs = rawJobs
    .map((raw) => {
      const adapter = adapters.find((candidate) => candidate.name === raw.source);
      if (!adapter) throw new Error(`No adapter for source ${raw.source}`);
      return { raw, job: adapter.normalize(raw) };
    })
    .filter(({ job }) => isGermanyJob(job, segment));
  const normalized = sourceJobs.map(({ job }) => job);

  const uniqueJobs = mergeDuplicates(normalized);
  const matches = uniqueJobs.flatMap((job) =>
    profiles.map((profile) => {
      const scoreBreakdown = scoreJob(job, profile);
      return {
        job,
        score: totalScore(scoreBreakdown),
        reason: explainMatch(job, profile, scoreBreakdown)
      };
    })
  );

  return {
    fetched: rawJobs.length,
    normalized: normalized.length,
    sourceJobs,
    uniqueJobs,
    matches,
    sourceErrors,
    sourceCounts
  };
}

const GERMANY_LOCATION_MARKERS = [
  "germany",
  "deutschland",
  "bundesweit",
  "deutschlandweit",
  "remote in germany",
  "remote deutschland"
] as const;

const GERMAN_LOCATION_TERMS = new Set(
  GERMAN_CITIES.flatMap((city) => [city, ...expandLocationTerm(city)])
    .map(normalizeText)
    .filter(Boolean)
);

export function isGermanyJob(job: Job, segment: SearchSegment): boolean {
  const location = normalizeText(job.location);
  const segmentLocation = normalizeText(segment.location);

  if (!location) return false;
  if (GERMANY_LOCATION_MARKERS.some((marker) => location.includes(normalizeText(marker)))) return true;
  if (/\bde\b/.test(location)) return true;
  if (segmentLocation && location.includes(segmentLocation)) return true;

  return Array.from(GERMAN_LOCATION_TERMS).some((term) => location.includes(term));
}

function mergeDuplicates(jobs: Job[]): Job[] {
  const byFingerprint = new Map<string, Job>();

  for (const job of jobs) {
    const existing = byFingerprint.get(job.fingerprint);
    if (!existing) {
      byFingerprint.set(job.fingerprint, job);
      continue;
    }

    byFingerprint.set(job.fingerprint, {
      ...existing,
      description: existing.description.length >= job.description.length ? existing.description : job.description,
      salaryMin: existing.salaryMin ?? job.salaryMin,
      salaryMax: existing.salaryMax ?? job.salaryMax,
      sourceNames: Array.from(new Set([...existing.sourceNames, ...job.sourceNames])),
      lastSeenAt: new Date().toISOString()
    });
  }

  return [...byFingerprint.values()];
}
