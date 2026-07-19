import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

export const arbeitnowAdapter: SourceAdapter = {
  name: "Arbeitnow",
  async fetch(segment) {
    const url = new URL("https://www.arbeitnow.com/api/job-board-api");
    url.searchParams.set("search", segment.keyword);
    url.searchParams.set("location", segment.location);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Arbeitnow fetch failed: ${response.status}`);
    const json = (await response.json()) as { data?: unknown[] };

    return (json.data ?? []).map((payload, index) => ({
      source: "Arbeitnow",
      sourceId: getString(payload, "slug") ?? `arbeitnow-${index}`,
      sourceUrl: getString(payload, "url") ?? "https://www.arbeitnow.com",
      payload
    }));
  },
  normalize(raw): Job {
    const payload = raw.payload;
    const job: Job = {
      id: crypto.randomUUID(),
      fingerprint: "",
      title: getString(payload, "title") ?? "Untitled role",
      company: getString(payload, "company_name") ?? "Unknown company",
      location: getString(payload, "location") ?? "Germany",
      remote: getBoolean(payload, "remote") ? "full" : "none",
      salaryMin: null,
      salaryMax: null,
      currency: "EUR",
      description: getString(payload, "description") ?? "",
      applyUrl: raw.sourceUrl,
      sourceNames: [raw.source],
      postedAt: fromUnix(getNumber(payload, "created_at")),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "active"
    };
    return { ...job, fingerprint: makeFingerprint(job) };
  }
};

function getString(value: unknown, key: string): string | null {
  return typeof value === "object" && value !== null && key in value && typeof value[key as keyof typeof value] === "string"
    ? String(value[key as keyof typeof value])
    : null;
}

function getBoolean(value: unknown, key: string): boolean {
  return typeof value === "object" && value !== null && key in value && value[key as keyof typeof value] === true;
}

function getNumber(value: unknown, key: string): number | null {
  return typeof value === "object" && value !== null && key in value && typeof value[key as keyof typeof value] === "number"
    ? Number(value[key as keyof typeof value])
    : null;
}

function fromUnix(value: number | null): string {
  return value ? new Date(value * 1000).toISOString() : new Date().toISOString();
}
