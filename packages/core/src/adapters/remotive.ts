import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

export const remotiveAdapter: SourceAdapter = {
  name: "Remotive",
  async fetch(segment) {
    const url = new URL("https://remotive.com/api/remote-jobs");
    url.searchParams.set("search", segment.keyword);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Remotive fetch failed: ${response.status}`);
    const json = (await response.json()) as { jobs?: unknown[] };

    return (json.jobs ?? []).map((payload, index) => ({
      source: "Remotive",
      sourceId: getString(payload, "id") ?? `remotive-${index}`,
      sourceUrl: getString(payload, "url") ?? "https://remotive.com",
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
        location: getString(payload, "candidate_required_location") ?? getString(payload, "location") ?? "Remote",
        remote: "full",
      salaryMin: null,
      salaryMax: null,
      currency: "EUR",
      description: getString(payload, "description") ?? "",
      applyUrl: raw.sourceUrl,
      sourceNames: [raw.source],
      postedAt: getString(payload, "publication_date") ?? new Date().toISOString(),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "active"
    };
    return { ...job, fingerprint: makeFingerprint(job) };
  }
};

function getString(value: unknown, key: string): string | null {
  return typeof value === "object" && value !== null && key in value
    ? String(value[key as keyof typeof value] ?? "") || null
    : null;
}
