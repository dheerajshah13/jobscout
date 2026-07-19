import type { JobLanguage } from "./translate";

// Pin the timezone so server and client render the same wall-clock time
// regardless of where each runs. Germany-focused app → Berlin time.
const TIME_ZONE = "Europe/Berlin";

/**
 * Formats a posting timestamp deterministically. We build the string from
 * `formatToParts` with our own separators instead of `toLocaleString`, because
 * different ICU versions (Node on the server vs. the browser) pick different
 * date/time separators ("Jul 19 at 8:05 PM" vs "Jul 19, 8:05 PM") and that
 * causes React hydration mismatches.
 */
export function formatPostedAt(value: string, lang: JobLanguage, style: "short" | "long") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return lang === "de" ? "Datum unbekannt" : "date unknown";
  }

  const parts = new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: lang === "en"
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const time = `${get("hour")}:${get("minute")}`;

  if (lang === "de") {
    return style === "long" ? `${day}. ${month} ${year}, ${time}` : `${day}. ${month}, ${time}`;
  }

  const enTime = `${time} ${get("dayPeriod")}`.trim();
  return style === "long" ? `${month} ${day}, ${year} at ${enTime}` : `${month} ${day}, ${enTime}`;
}

export function postedLabel(lang: JobLanguage) {
  return lang === "de" ? "Veröffentlicht" : "Posted";
}
