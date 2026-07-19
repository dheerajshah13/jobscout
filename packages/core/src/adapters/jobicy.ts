import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

/**
 * Jobicy public API (no key required): remote jobs filtered to the Germany
 * geo. Attribution requirement: apply buttons must link the original job URL,
 * which we satisfy by using the feed's `url` as applyUrl.
 */
export const jobicyAdapter: SourceAdapter = {
  name: "Jobicy",
  async fetch(segment) {
    const url = new URL("https://jobicy.com/api/v2/remote-jobs");
    url.searchParams.set("count", "50");
    url.searchParams.set("geo", "germany");
    if (segment.keyword) url.searchParams.set("tag", segment.keyword);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Jobicy fetch failed: ${response.status}`);
    const json = (await response.json()) as { jobs?: unknown[] };

    return (json.jobs ?? []).map((payload, index) => ({
      source: "Jobicy",
      sourceId: String(getValue(payload, "id") ?? `jobicy-${index}`),
      sourceUrl: getString(payload, "url") ?? "https://jobicy.com",
      payload
    }));
  },
  normalize(raw): Job {
    const payload = raw.payload;
    const currency = getString(payload, "salaryCurrency");
    const eurSalary = !currency || currency === "EUR";
    const job: Job = {
      id: crypto.randomUUID(),
      fingerprint: "",
      title: getString(payload, "jobTitle") ?? "Untitled role",
      company: getString(payload, "companyName") ?? "Unknown company",
      location: getString(payload, "jobGeo") ?? "Remote",
      remote: "full",
      salaryMin: eurSalary ? getNumber(payload, "annualSalaryMin") : null,
      salaryMax: eurSalary ? getNumber(payload, "annualSalaryMax") : null,
      currency: "EUR",
      description: getString(payload, "jobexcerpt") ?? getString(payload, "jobDescription") ?? "",
      applyUrl: raw.sourceUrl,
      sourceNames: [raw.source],
      postedAt: toIso(getString(payload, "pubDate")),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "active"
    };
    return { ...job, fingerprint: makeFingerprint(job) };
  }
};

function getString(value: unknown, key: string): string | null {
  const raw = getValue(value, key);
  return typeof raw === "string" ? raw : null;
}

function getNumber(value: unknown, key: string): number | null {
  const raw = getValue(value, key);
  return typeof raw === "number" ? raw : null;
}

function getValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? value[key as keyof typeof value] : null;
}

function toIso(value: string | null): string {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
