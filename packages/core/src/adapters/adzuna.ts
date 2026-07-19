import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

type AdzunaAdapterOptions = {
  appId: string;
  appKey: string;
  /** Results per API page (Adzuna max is 50). */
  resultsPerPage?: number;
};

const REMOTE_MARKERS = /\b(remote|homeoffice|home office|home-office|fully remote|100% remote|ortsunabh[äa]ngig|remote-first)\b/i;
const HYBRID_MARKERS = /\b(hybrid|teilweise remote|remote möglich|remote possible|flexible working)\b/i;

/**
 * Adzuna aggregator (official REST API, EUR salaries on the /de/ endpoint).
 * Deep German coverage — the largest single source in the pool. Apply links
 * go through Adzuna's redirect (`redirect_url`), which is their attribution
 * requirement.
 */
export function createAdzunaAdapter({ appId, appKey, resultsPerPage = 50 }: AdzunaAdapterOptions): SourceAdapter {
  return {
    name: "Adzuna",
    async fetch(segment) {
      const url = new URL("https://api.adzuna.com/v1/api/jobs/de/search/1");
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("results_per_page", String(resultsPerPage));
      url.searchParams.set("content-type", "application/json");
      if (segment.keyword.trim()) url.searchParams.set("what", segment.keyword.trim());
      if (segment.location.trim() && segment.location.trim().toLowerCase() !== "germany") {
        url.searchParams.set("where", segment.location.trim());
      }

      const response = await fetch(url);
      if (!response.ok) {
        const hint =
          response.status === 401 || response.status === 403
            ? " Check ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment."
            : "";
        throw new Error(`Adzuna fetch failed: ${response.status}.${hint}`);
      }
      const json = (await response.json()) as { results?: unknown[] };

      return (json.results ?? []).map((payload, index) => ({
        source: "Adzuna",
        sourceId: getString(payload, "id") ?? `adzuna-${index}`,
        sourceUrl: getString(payload, "redirect_url") ?? "https://www.adzuna.de",
        payload
      }));
    },
    normalize(raw): Job {
      const payload = raw.payload;
      const text = `${getString(payload, "title") ?? ""} ${getString(payload, "description") ?? ""}`;
      const job: Job = {
        id: crypto.randomUUID(),
        fingerprint: "",
        title: getString(payload, "title") ?? "Untitled role",
        company: getNested(payload, "company", "display_name") ?? "Unknown company",
        location: location(payload),
        remote: REMOTE_MARKERS.test(text) ? "full" : HYBRID_MARKERS.test(text) ? "hybrid" : "none",
        salaryMin: getNumber(payload, "salary_min"),
        salaryMax: getNumber(payload, "salary_max"),
        currency: "EUR",
        description: getString(payload, "description") ?? "",
        applyUrl: raw.sourceUrl,
        sourceNames: [raw.source],
        postedAt: toIso(getString(payload, "created")),
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: "active"
      };
      return { ...job, fingerprint: makeFingerprint(job) };
    }
  };
}

function location(payload: unknown): string {
  const display = getNested(payload, "location", "display_name");
  if (display) return display.replace(/,?\s*Deutschland$/i, "").trim() || "Germany";
  const area = getValue(getValue(payload, "location"), "area");
  if (Array.isArray(area)) {
    const parts = area.filter((entry): entry is string => typeof entry === "string" && !/deutschland/i.test(entry));
    if (parts.length) return parts[parts.length - 1];
  }
  return "Germany";
}

function getString(value: unknown, key: string): string | null {
  const raw = getValue(value, key);
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number") return String(raw);
  return null;
}

function getNumber(value: unknown, key: string): number | null {
  const raw = getValue(value, key);
  return typeof raw === "number" ? Math.round(raw) : null;
}

function getNested(value: unknown, key: string, childKey: string): string | null {
  return getString(getValue(value, key), childKey);
}

function getValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? value[key as keyof typeof value] : null;
}

function toIso(value: string | null): string {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
