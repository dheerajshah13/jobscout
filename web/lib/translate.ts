import type { Job } from "@jobscout/core";
import { createSupabaseAdminClient } from "./supabase/admin";

export type JobLanguage = "en" | "de";

export type TranslationResult =
  | { state: "translated"; title: string; description: string; from: JobLanguage; quality: "google" | "offline" | "cached" }
  | { state: "not-needed" }
  | { state: "unavailable"; from: JobLanguage };

const GERMAN_MARKERS = /\b(und|der|die|das|für|mit|wir|sie|bei|nicht|eine|einen|sind|haben|werden|über|auch|oder|dich|deine|unsere)\b|[äöüß]/gi;
const ENGLISH_MARKERS = /\b(the|and|you|our|with|for|are|will|have|team|work|your|this|that|skills|experience)\b/gi;
const CACHE_MARKER = "[[jobscout-google-v1]]";

const DE_TO_EN_PHRASES: Array<[RegExp, string]> = [
  [/\b(m\/w\/d|w\/m\/d|gn)\b/gi, "all genders"],
  [/\bSoftwareentwickler\/in\b/gi, "Software Developer"],
  [/\bSoftwareentwickler\b/gi, "Software Developer"],
  [/\bFrontend Entwickler\b/gi, "Frontend Developer"],
  [/\bBackend Entwickler\b/gi, "Backend Developer"],
  [/\bFullstack Entwickler\b/gi, "Full Stack Developer"],
  [/\bPrüfstandsingenieur\b/gi, "Test Bench Engineer"],
  [/\bProduktionsmanager\b/gi, "Production Manager"],
  [/\bMontagetechniker\b/gi, "Assembly Technician"],
  [/\bAufgaben\b/gi, "Responsibilities"],
  [/\bQualifikation\b/gi, "Qualifications"],
  [/\bBenefits\b/gi, "Benefits"],
  [/\bDein Profil\b/gi, "Your profile"],
  [/\bDeine Mission\b/gi, "Your mission"],
  [/\bDeine Aufgaben\b/gi, "Your responsibilities"],
  [/\bBerufserfahrung\b/gi, "professional experience"],
  [/\bKenntnisse\b/gi, "knowledge"],
  [/\bErfahrung\b/gi, "experience"],
  [/\bAbgeschlossenes Studium\b/gi, "completed degree"],
  [/\bAusbildung\b/gi, "training"],
  [/\bVollzeit\b/gi, "full time"],
  [/\bTeilzeit\b/gi, "part time"],
  [/\bHomeoffice\b/gi, "home office"],
  [/\bunbefristet\b/gi, "permanent"],
  [/\bbefristet\b/gi, "fixed-term"],
  [/\bDeutschkenntnisse\b/gi, "German skills"],
  [/\bEnglischkenntnisse\b/gi, "English skills"],
  [/\bMitarbeitenden\b/gi, "employees"],
  [/\bTeamfähigkeit\b/gi, "teamwork"],
  [/\bZusammenarbeit\b/gi, "collaboration"],
  [/\bEntwicklung\b/gi, "development"],
  [/\bProduktion\b/gi, "production"],
  [/\bQualitätsstandards\b/gi, "quality standards"],
  [/\bArbeitsweise\b/gi, "working style"],
  [/\bVerantwortung\b/gi, "responsibility"],
  [/\bSicherstellung\b/gi, "ensuring"],
  [/\bDurchführung\b/gi, "execution"],
  [/\bPlanung\b/gi, "planning"]
];

const EN_TO_DE_PHRASES: Array<[RegExp, string]> = [
  [/\ball genders\b/gi, "alle Geschlechter"],
  [/\bSoftware Developer\b/gi, "Softwareentwickler/in"],
  [/\bFrontend Developer\b/gi, "Frontend Entwickler/in"],
  [/\bBackend Developer\b/gi, "Backend Entwickler/in"],
  [/\bFull Stack Developer\b/gi, "Fullstack Entwickler/in"],
  [/\bTest Bench Engineer\b/gi, "Prüfstandsingenieur/in"],
  [/\bProduction Manager\b/gi, "Produktionsmanager/in"],
  [/\bAssembly Technician\b/gi, "Montagetechniker/in"],
  [/\bResponsibilities\b/gi, "Aufgaben"],
  [/\bQualifications\b/gi, "Qualifikationen"],
  [/\bBenefits\b/gi, "Benefits"],
  [/\bYour profile\b/gi, "Dein Profil"],
  [/\bYour mission\b/gi, "Deine Mission"],
  [/\bprofessional experience\b/gi, "Berufserfahrung"],
  [/\bknowledge\b/gi, "Kenntnisse"],
  [/\bexperience\b/gi, "Erfahrung"],
  [/\bcompleted degree\b/gi, "abgeschlossenes Studium"],
  [/\btraining\b/gi, "Ausbildung"],
  [/\bfull time\b/gi, "Vollzeit"],
  [/\bpart time\b/gi, "Teilzeit"],
  [/\bhome office\b/gi, "Homeoffice"],
  [/\bpermanent\b/gi, "unbefristet"],
  [/\bfixed-term\b/gi, "befristet"],
  [/\bGerman skills\b/gi, "Deutschkenntnisse"],
  [/\bEnglish skills\b/gi, "Englischkenntnisse"],
  [/\bteamwork\b/gi, "Teamfähigkeit"],
  [/\bcollaboration\b/gi, "Zusammenarbeit"],
  [/\bdevelopment\b/gi, "Entwicklung"],
  [/\bproduction\b/gi, "Produktion"],
  [/\bquality standards\b/gi, "Qualitätsstandards"],
  [/\bworking style\b/gi, "Arbeitsweise"],
  [/\bresponsibility\b/gi, "Verantwortung"],
  [/\bplanning\b/gi, "Planung"]
];

/** Cheap stopword-based language detection — good enough to decide whether a posting needs translating. */
export function detectJobLanguage(text: string): JobLanguage {
  const sample = text.slice(0, 2000);
  const german = sample.match(GERMAN_MARKERS)?.length ?? 0;
  const english = sample.match(ENGLISH_MARKERS)?.length ?? 0;
  return german > english ? "de" : "en";
}

/**
 * Returns the job in the user's language. Uses Google's free web translate
 * endpoint first, then falls back to a local phrase dictionary if the request
 * fails. No Anthropic or paid translation key is required.
 */
export async function getJobTranslation(job: Job, target: JobLanguage): Promise<TranslationResult> {
  const detected = detectJobLanguage(`${job.title} ${job.description}`);
  if (detected === target) return { state: "not-needed" };

  const admin = createSupabaseAdminClient();
  const { data: cached } = await admin
    .from("job_translations")
    .select("title,description")
    .eq("job_id", job.id)
    .eq("lang", target)
    .maybeSingle();

  if (cached && isVersionedGoogleCache(cached.description) && isUsableCachedTranslation(`${cached.title}\n${cached.description}`, target)) {
    return {
      state: "translated",
      title: cached.title,
      description: removeCacheMarker(cached.description),
      from: detected,
      quality: "cached"
    };
  }

  try {
    const translated = await googleTranslate(job, detected, target);

    if (translated) {
      await admin.from("job_translations").upsert(
        { job_id: job.id, lang: target, title: translated.title, description: `${CACHE_MARKER}\n${translated.description}` },
        { onConflict: "job_id,lang" }
      );

      return {
        state: "translated",
        title: translated.title,
        description: translated.description,
        from: detected,
        quality: translated.quality
      };
    }

    const fallback = offlineTranslate(job, target);
    return { state: "translated", title: fallback.title, description: fallback.description, from: detected, quality: fallback.quality };
  } catch {
    return { state: "unavailable", from: detected };
  }
}

async function googleTranslate(job: Job, source: JobLanguage, target: JobLanguage) {
  const [title, description] = await Promise.all([
    translateText(stripHtml(job.title), source, target),
    translateText(stripHtml(job.description), source, target)
  ]);

  if (!title || !description) return null;
  return { title, description, quality: "google" as const };
}

async function translateText(text: string, source: JobLanguage, target: JobLanguage): Promise<string | null> {
  const chunks = chunkText(text, 900);
  const translated: string[] = [];

  for (const chunk of chunks) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", source);
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", chunk);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 JobScout MVP"
      },
      next: { revalidate: 60 * 60 * 24 * 30 }
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    const text = readGooglePayload(payload);
    if (!text) return null;
    translated.push(text);
  }

  return translated.join("\n\n").trim();
}

function offlineTranslate(job: Job, target: JobLanguage) {
  const dictionary = target === "en" ? DE_TO_EN_PHRASES : EN_TO_DE_PHRASES;
  return {
    title: applyDictionary(stripHtml(job.title), dictionary),
    description: applyDictionary(stripHtml(job.description), dictionary),
    quality: "offline" as const
  };
}

function applyDictionary(value: string, dictionary: Array<[RegExp, string]>): string {
  return dictionary.reduce((translated, [pattern, replacement]) => translated.replace(pattern, replacement), value);
}

export function stripHtml(value: string): string {
  return value
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, "\n")
    .replace(/<\/ul>|<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x26;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&szlig;/g, "ß")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isUsableCachedTranslation(text: string, target: JobLanguage): boolean {
  if (/[<>][a-z/]/i.test(text)) return false;
  const germanMarkers = text.match(GERMAN_MARKERS)?.length ?? 0;
  const englishMarkers = text.match(ENGLISH_MARKERS)?.length ?? 0;

  if (target === "en") {
    return germanMarkers <= 2 && englishMarkers >= 2;
  }

  return englishMarkers <= 4 && germanMarkers >= 2;
}

function isVersionedGoogleCache(description: string): boolean {
  return description.startsWith(CACHE_MARKER);
}

function removeCacheMarker(description: string): string {
  return description.startsWith(CACHE_MARKER) ? description.slice(CACHE_MARKER.length).trim() : description;
}

function chunkText(text: string, maxLength: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length > maxLength && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = [current, paragraph].filter(Boolean).join("\n\n");
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxLength)];
}

function readGooglePayload(payload: unknown): string | null {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;
  return payload[0]
    .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
    .join("")
    .trim();
}
