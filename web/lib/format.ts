import type { JobLanguage } from "./translate";

export function formatPostedAt(value: string, lang: JobLanguage, style: "short" | "long") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return lang === "de" ? "Datum unbekannt" : "date unknown";
  }

  return date.toLocaleString(lang === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: lang === "en"
  });
}

export function postedLabel(lang: JobLanguage) {
  return lang === "de" ? "Veröffentlicht" : "Posted";
}
