import { makeFingerprint, type Job } from "../index.js";
import { buildJSearchQueries, resolveJobSourceName } from "../job-sources.js";
import type { RawJob, SourceAdapter } from "./types.js";

type JSearchAdapterOptions = {
  apiKey: string;
};

export function createJSearchAdapter({ apiKey }: JSearchAdapterOptions): SourceAdapter {
  return {
    name: "JSearch",
    async fetch(segment) {
      const queries = buildJSearchQueries(segment.keyword, segment.location);
      const rows: RawJob[] = [];
      for (const query of queries) {
        rows.push(...(await fetchJSearchRows(apiKey, query, "all")));
        if (rows.length) break;
      }
      return rows;
    },
    normalize(raw): Job {
      const payload = raw.payload;
      const currency = getString(payload, "job_salary_currency");
      const eurSalary = !currency || currency === "EUR";
      const job: Job = {
        id: crypto.randomUUID(),
        fingerprint: "",
        title: getString(payload, "job_title") ?? "Untitled role",
        company: getString(payload, "employer_name") ?? "Unknown company",
        location: location(payload),
        remote: getBoolean(payload, "job_is_remote") ? "full" : "none",
        salaryMin: eurSalary ? getNumber(payload, "job_min_salary") : null,
        salaryMax: eurSalary ? getNumber(payload, "job_max_salary") : null,
        currency: "EUR",
        description: getString(payload, "job_description") ?? "",
        applyUrl: raw.sourceUrl,
        sourceNames: [resolveJobSourceName(getString(payload, "job_publisher"), raw.sourceUrl)],
        postedAt: postedAt(payload),
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: "active"
      };
      return { ...job, fingerprint: makeFingerprint(job) };
    }
  };
}

export async function fetchJSearchRows(apiKey: string, query: string, datePosted = "all", workFromHome = false): Promise<RawJob[]> {
      const url = new URL("https://jsearch.p.rapidapi.com/search-v2");
      url.searchParams.set("query", query);
      url.searchParams.set("country", "de");
      url.searchParams.set("page", "1");
      url.searchParams.set("num_pages", "1");
      url.searchParams.set("date_posted", datePosted);
      if (workFromHome) url.searchParams.set("work_from_home", "true");

      const response = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
        }
      });
      if (!response.ok) {
        const hint =
          response.status === 403
            ? " Check that the RapidAPI JSearch subscription is active and worker/.env has the full X-RapidAPI-Key."
            : "";
        throw new Error(`JSearch fetch failed: ${response.status}.${hint}`);
      }
      const json = (await response.json()) as { data?: { jobs?: unknown[] } };

      return (json.data?.jobs ?? []).map((payload, index) => ({
        source: "JSearch",
        sourceId: getString(payload, "job_id") ?? `jsearch-${index}`,
        sourceUrl: applyUrl(payload),
        payload
      }));
}

function applyUrl(payload: unknown): string {
  return (
    getString(payload, "job_apply_link") ??
    getString(payload, "job_google_link") ??
    "https://www.google.com/search?q=jobs"
  );
}

function location(payload: unknown): string {
  const city = getString(payload, "job_city");
  const state = getString(payload, "job_state");
  const country = getString(payload, "job_country");
  return [city, state, country].filter(Boolean).join(", ") || "Germany";
}

function postedAt(payload: unknown): string {
  const value =
    getString(payload, "job_posted_at_datetime_utc") ??
    getString(payload, "job_posted_at_datetime");
  const timestamp = getNumber(payload, "job_posted_at_timestamp");
  if (timestamp) {
    const millis = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    return new Date(millis).toISOString();
  }

  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function getString(value: unknown, key: string): string | null {
  const raw = getValue(value, key);
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number") return String(raw);
  return null;
}

function getNumber(value: unknown, key: string): number | null {
  const raw = getValue(value, key);
  return typeof raw === "number" ? raw : null;
}

function getBoolean(value: unknown, key: string): boolean {
  return getValue(value, key) === true;
}

function getValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? value[key as keyof typeof value] : null;
}
