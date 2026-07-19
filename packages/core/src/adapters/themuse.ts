import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

/**
 * The Muse public API (no key required for the public endpoint). It has no
 * free-text keyword parameter, so we fetch by location and filter results
 * against the segment keyword ourselves.
 */
export const theMuseAdapter: SourceAdapter = {
  name: "The Muse",
  async fetch(segment) {
    const url = new URL("https://www.themuse.com/api/public/jobs");
    url.searchParams.set("page", "1");
    const location = segment.location && segment.location !== "Germany" ? `${segment.location}, Germany` : "Germany";
    url.searchParams.set("location", location);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`The Muse fetch failed: ${response.status}`);
    const json = (await response.json()) as { results?: unknown[] };

    const terms = segment.keyword.toLowerCase().split(/\s+/).filter(Boolean);
    return (json.results ?? [])
      .filter((payload) => {
        if (!terms.length) return true;
        const haystack = `${getString(payload, "name") ?? ""} ${getString(payload, "contents") ?? ""}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .map((payload, index) => ({
        source: "The Muse",
        sourceId: String(getValue(payload, "id") ?? `themuse-${index}`),
        sourceUrl: getNested(payload, "refs", "landing_page") ?? "https://www.themuse.com",
        payload
      }));
  },
  normalize(raw): Job {
    const payload = raw.payload;
    const locations = getValue(payload, "locations");
    const locationNames = Array.isArray(locations)
      ? locations.map((entry) => getString(entry, "name")).filter((name): name is string => Boolean(name))
      : [];
    const isRemote = locationNames.some((name) => /remote|flexible/i.test(name));
    const germanCity = locationNames.find((name) => name.includes("Germany"));

    const job: Job = {
      id: crypto.randomUUID(),
      fingerprint: "",
      title: getString(payload, "name") ?? "Untitled role",
      company: getNested(payload, "company", "name") ?? "Unknown company",
      location: germanCity?.replace(", Germany", "") ?? locationNames[0] ?? "Germany",
      remote: isRemote ? "full" : "none",
      salaryMin: null,
      salaryMax: null,
      currency: "EUR",
      description: stripHtml(getString(payload, "contents") ?? ""),
      applyUrl: raw.sourceUrl,
      sourceNames: [raw.source],
      postedAt: toIso(getString(payload, "publication_date")),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "active"
    };
    return { ...job, fingerprint: makeFingerprint(job) };
  }
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getString(value: unknown, key: string): string | null {
  const raw = getValue(value, key);
  return typeof raw === "string" ? raw : null;
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
