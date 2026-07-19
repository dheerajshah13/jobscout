import { makeFingerprint, type Job } from "../index.js";
import type { RawJob, SourceAdapter } from "./types.js";

const BASE_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const SOURCE = "Arbeitsagentur";

export const arbeitsagenturAdapter: SourceAdapter = {
  name: SOURCE,
  async fetch(segment) {
    const url = new URL(`${BASE_URL}/pc/v6/jobs`);
    url.searchParams.set("was", segment.keyword);
    url.searchParams.set("wo", segment.location);
    url.searchParams.set("page", "1");
    url.searchParams.set("size", "50");
    url.searchParams.set("angebotsart", "1");
    url.searchParams.set("veroeffentlichtseit", "30");

    const response = await fetch(url, {
      headers: {
        "X-API-Key": "jobboerse-jobsuche",
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Arbeitsagentur fetch failed: ${response.status}`);
    }

    const json = (await response.json()) as { stellenangebote?: unknown[]; ergebnisliste?: unknown[] };
    return (json.ergebnisliste ?? json.stellenangebote ?? []).map((payload, index) => {
      const refnr = getString(payload, "referenznummer") ?? getString(payload, "refnr") ?? `arbeitsagentur-${index}`;
      const externalUrl = getString(payload, "externeURL") ?? getString(payload, "externeUrl");

      return {
        source: SOURCE,
        sourceId: refnr,
        sourceUrl: externalUrl ?? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(refnr)}`,
        payload
      };
    });
  },
  normalize(raw): Job {
    const payload = raw.payload;
    const location =
      getNestedString(payload, ["stellenlokationen", "0", "adresse", "ort"]) ??
      getNestedString(payload, ["arbeitsort", "ort"]) ??
      getNestedString(payload, ["arbeitsort", "region"]) ??
      "Deutschland";
    const title = getString(payload, "stellenangebotsTitel") ?? getString(payload, "beruf") ?? "Untitled role";
    const company = getString(payload, "firma") ?? getString(payload, "arbeitgeber") ?? "Unknown employer";
    const description = [
      title,
      company,
      getString(payload, "hauptberuf"),
      getArrayStrings(payload, "alleBerufe").join(", "),
      getNestedString(payload, ["arbeitsort", "region"]),
      getString(payload, "stellenbeschreibung"),
      getString(payload, "modifikationsTimestamp")
    ]
      .filter(Boolean)
      .join("\n\n");

    const job: Job = {
      id: crypto.randomUUID(),
      fingerprint: "",
      title,
      company,
      location,
      remote: inferRemote(payload),
      salaryMin: null,
      salaryMax: null,
      currency: "EUR",
      description,
      applyUrl: raw.sourceUrl,
      sourceNames: [raw.source],
      postedAt: toDate(
        getString(payload, "datumErsteVeroeffentlichung") ??
          getNestedString(payload, ["veroeffentlichungszeitraum", "von"]) ??
          getString(payload, "aktuelleVeroeffentlichungsdatum")
      ),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: "active"
    };

    return { ...job, fingerprint: makeFingerprint(job) };
  }
};

function inferRemote(payload: unknown): "none" | "hybrid" | "full" {
  const text = JSON.stringify(payload).toLowerCase();
  if (text.includes("homeoffice") || text.includes("telearbeit") || text.includes("remote")) {
    return "hybrid";
  }
  return "none";
}

function getString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function getNestedString(value: unknown, path: string[]): string | null {
  let current = value;
  for (const part of path) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index)) return null;
      current = current[index];
      continue;
    }

    if (typeof current !== "object" || current === null || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" && current.trim() ? current : null;
}

function getArrayStrings(value: unknown, key: string): string[] {
  if (typeof value !== "object" || value === null || !(key in value)) return [];
  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
}

function toDate(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
