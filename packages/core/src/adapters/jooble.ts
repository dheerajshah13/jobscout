import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

type JoobleAdapterOptions = {
  apiKey: string;
};

const REMOTE_MARKERS = /\b(remote|homeoffice|home office|home-office|fully remote|100% remote|ortsunabh[äa]ngig)\b/i;
const HYBRID_MARKERS = /\b(hybrid|teilweise remote|remote möglich|remote possible)\b/i;

/**
 * Jooble aggregator (POST API on the global endpoint — the German subdomain is
 * IP-blocked, so we always call jooble.org and pass location as a parameter).
 * Apply links go through Jooble's `/jdp/` redirect. Salary is a free-text
 * string we best-effort parse into an EUR range.
 */
export function createJoobleAdapter({ apiKey }: JoobleAdapterOptions): SourceAdapter {
  return {
    name: "Jooble",
    async fetch(segment) {
      // The global endpoint returns worldwide results unless a location is set,
      // so always constrain to Germany (or the specific German city requested).
      const city = segment.location.trim();
      const body: Record<string, string> = {
        keywords: segment.keyword.trim(),
        location: city && city.toLowerCase() !== "germany" ? city : "Germany"
      };

      const response = await fetch(`https://jooble.org/api/${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const hint = response.status === 403 ? " Check JOOBLE_API_KEY — the global jooble.org endpoint must be used, not a country subdomain." : "";
        throw new Error(`Jooble fetch failed: ${response.status}.${hint}`);
      }
      const json = (await response.json()) as { jobs?: unknown[] };

      return (json.jobs ?? []).map((payload, index) => ({
        source: "Jooble",
        sourceId: getString(payload, "id") ?? `jooble-${index}`,
        sourceUrl: getString(payload, "link") ?? "https://jooble.org",
        payload
      }));
    },
    normalize(raw): Job {
      const payload = raw.payload;
      const text = `${getString(payload, "title") ?? ""} ${getString(payload, "snippet") ?? ""}`;
      const [salaryMin, salaryMax] = parseSalary(getString(payload, "salary"));
      const job: Job = {
        id: crypto.randomUUID(),
        fingerprint: "",
        title: getString(payload, "title") ?? "Untitled role",
        company: getString(payload, "company") ?? "Unknown company",
        location: (getString(payload, "location") ?? "Germany").replace(/,?\s*Deutschland$/i, "").trim() || "Germany",
        remote: REMOTE_MARKERS.test(text) ? "full" : HYBRID_MARKERS.test(text) ? "hybrid" : "none",
        salaryMin,
        salaryMax,
        currency: "EUR",
        description: stripHtml(getString(payload, "snippet") ?? ""),
        applyUrl: raw.sourceUrl,
        sourceNames: [raw.source],
        postedAt: toIso(getString(payload, "updated")),
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: "active"
      };
      return { ...job, fingerprint: makeFingerprint(job) };
    }
  };
}

/** Extracts up to two EUR figures from free-text salary like "€50,000 - €70,000" or "50.000 € / Jahr". */
function parseSalary(salary: string | null): [number | null, number | null] {
  if (!salary || !/[€]|eur/i.test(salary)) return [null, null];

  const numbers = salary
    .replace(/[.\s](?=\d{3}\b)/g, "") // strip thousands separators (dot or space)
    .replace(/,(?=\d{3}\b)/g, "") // strip comma thousands separators
    .match(/\d{4,7}/g)
    ?.map(Number)
    .filter((n) => n >= 10_000 && n <= 500_000);

  if (!numbers?.length) return [null, null];
  if (numbers.length === 1) return [numbers[0], null];
  return [Math.min(...numbers), Math.max(...numbers)];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getString(value: unknown, key: string): string | null {
  const raw = getValue(value, key);
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number") return String(raw);
  return null;
}

function getValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? value[key as keyof typeof value] : null;
}

function toIso(value: string | null): string {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
