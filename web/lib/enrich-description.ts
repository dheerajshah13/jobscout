import type { Job } from "@jobscout/core";
import { createSupabaseAdminClient } from "./supabase/admin";

/** Aggregator snippets are short and usually end in an ellipsis; below this we try to fetch the full posting. */
const TRUNCATED_MAX = 900;
const ENRICHED_MIN_GAIN = 400;

/**
 * Sources whose job pages return only API snippets AND block bot fetches (403)
 * with no JobPosting JSON-LD — enrichment can't help, so skip the wasted
 * request and surface a "read full posting" link instead.
 */
const UNSCRAPEABLE_SOURCES = new Set(["Adzuna", "Jooble"]);

/** True when the stored text is a short aggregator snippet rather than a full posting. */
export function isLikelyTruncated(description: string): boolean {
  const text = description.trim();
  if (text.length < TRUNCATED_MAX) return true;
  return /[…]$|\.\.\.$/.test(text);
}

function fetchWouldBeBlocked(job: Job): boolean {
  return job.sourceNames.length > 0 && job.sourceNames.every((source) => UNSCRAPEABLE_SOURCES.has(source));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pull the JobPosting description out of any schema.org JSON-LD block on the page. */
function extractJsonLdDescription(html: string): string | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed, ...toGraph(parsed)];
    for (const node of candidates) {
      if (isJobPosting(node) && typeof node.description === "string" && node.description.trim()) {
        return stripHtml(node.description);
      }
    }
  }
  return null;
}

function toGraph(node: unknown): unknown[] {
  return typeof node === "object" && node !== null && Array.isArray((node as { "@graph"?: unknown[] })["@graph"])
    ? ((node as { "@graph": unknown[] })["@graph"] ?? [])
    : [];
}

function isJobPosting(node: unknown): node is { description?: string } {
  if (typeof node !== "object" || node === null) return false;
  const type = (node as { "@type"?: unknown })["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

/**
 * Best-effort full-text for aggregator jobs (Adzuna/Jooble return only
 * snippets). Fetches the posting's page and extracts the schema.org JobPosting
 * description most boards embed as JSON-LD, then caches it back onto the job
 * row. Never throws — falls back to the existing description. Runs only on the
 * detail page, on demand, so it's not bulk scraping.
 */
export async function enrichJobDescription(job: Job): Promise<string> {
  if (!isLikelyTruncated(job.description) || !/^https?:\/\//.test(job.applyUrl) || fetchWouldBeBlocked(job)) {
    return job.description;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(job.applyUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScoutBot/1.0; +https://jobscout.example)",
        Accept: "text/html"
      }
    });
    if (!response.ok) return job.description;

    const html = await response.text();
    const full = extractJsonLdDescription(html);
    if (!full || full.length < job.description.length + ENRICHED_MIN_GAIN) {
      return job.description;
    }

    // Persist so future opens are instant and the pool improves.
    try {
      const admin = createSupabaseAdminClient();
      await admin.from("jobs").update({ description: full }).eq("id", job.id);
    } catch {
      // ignore write failures — we still return the richer text this request
    }

    return full;
  } catch {
    return job.description;
  } finally {
    clearTimeout(timeout);
  }
}
