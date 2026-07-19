/**
 * EN↔DE query expansion for job search. German job boards post the same role
 * under either language ("Frontend Developer" vs "Frontend Entwickler
 * (m/w/d)"), so every search term is expanded into its synonym group before
 * matching — the way Indeed.de and StepStone handle bilingual recall.
 */

/** Each group is one concept; a term matching any member expands to all members. */
const TERM_SYNONYM_GROUPS: string[][] = [
  ["developer", "entwickler", "programmierer"],
  ["engineer", "ingenieur", "engineering"],
  ["software", "softwareentwickler"],
  ["frontend", "front-end", "frontendentwickler"],
  ["backend", "back-end", "backendentwickler"],
  ["fullstack", "full-stack", "full stack"],
  ["data", "daten"],
  ["scientist", "wissenschaftler"],
  ["analyst", "analystin", "analyse"],
  ["manager", "leiter", "leitung", "management"],
  ["consultant", "berater", "beratung", "consulting"],
  ["designer", "design"],
  ["architect", "architekt"],
  ["administrator", "admin", "administration"],
  ["intern", "internship", "praktikant", "praktikum"],
  ["working student", "werkstudent", "werkstudent/in"],
  ["student", "werkstudent"],
  ["junior", "einsteiger"],
  ["senior", "erfahren"],
  ["sales", "vertrieb", "verkauf"],
  ["marketing", "marketingmanager"],
  ["accountant", "buchhalter", "buchhaltung", "accounting"],
  ["finance", "finanzen", "finanz"],
  ["lawyer", "jurist", "rechtsanwalt"],
  ["nurse", "pflegekraft", "pflegefachkraft", "krankenpfleger"],
  ["teacher", "lehrer", "lehrkraft"],
  ["driver", "fahrer", "kraftfahrer"],
  ["warehouse", "lager", "lagerist"],
  ["electrician", "elektriker", "elektroniker"],
  ["mechanic", "mechaniker", "mechatroniker"],
  ["technician", "techniker"],
  ["support", "kundenservice", "kundensupport"],
  ["customer", "kunden", "kundenbetreuer"],
  ["hr", "human resources", "personal", "personalreferent"],
  ["security", "sicherheit"],
  ["research", "forschung"],
  ["assistant", "assistent", "assistenz"],
  ["freelance", "freiberuflich", "freelancer"],
  ["remote", "homeoffice", "home office"]
];

/** German city names and their English/ASCII spellings. */
const CITY_SYNONYM_GROUPS: string[][] = [
  ["munich", "münchen", "muenchen"],
  ["cologne", "köln", "koeln"],
  ["nuremberg", "nürnberg", "nuernberg"],
  ["dusseldorf", "düsseldorf", "duesseldorf"],
  ["hanover", "hannover"],
  ["frankfurt", "frankfurt am main"],
  ["wurzburg", "würzburg", "wuerzburg"],
  ["munster", "münster", "muenster"],
  ["saarbrucken", "saarbrücken", "saarbruecken"],
  ["gottingen", "göttingen", "goettingen"],
  ["lubeck", "lübeck", "luebeck"],
  ["zurich", "zürich", "zuerich"]
];

function buildLookup(groups: string[][]): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const group of groups) {
    for (const member of group) {
      const existing = lookup.get(member.toLowerCase());
      const merged = existing ? Array.from(new Set([...existing, ...group])) : group;
      lookup.set(member.toLowerCase(), merged);
    }
  }
  return lookup;
}

const TERM_LOOKUP = buildLookup(TERM_SYNONYM_GROUPS);
const CITY_LOOKUP = buildLookup(CITY_SYNONYM_GROUPS);

function singularize(term: string): string {
  if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

/**
 * Expands one search term into every variant worth matching: itself, its
 * singular form, and all synonyms of either. Result always includes the
 * original term and is lowercase + deduplicated.
 */
export function expandSearchTerm(term: string): string[] {
  const lower = term.toLowerCase().trim();
  if (!lower) return [];

  const singular = singularize(lower);
  const variants = new Set<string>([lower]);
  if (singular !== lower) variants.add(singular);

  for (const key of [lower, singular]) {
    for (const synonym of TERM_LOOKUP.get(key) ?? []) variants.add(synonym.toLowerCase());
  }

  return Array.from(variants);
}

/** Expands a city/location term into its EN/DE/ASCII spellings. */
export function expandLocationTerm(location: string): string[] {
  const lower = location.toLowerCase().trim();
  if (!lower) return [];

  const variants = new Set<string>([lower]);
  for (const synonym of CITY_LOOKUP.get(lower) ?? []) variants.add(synonym.toLowerCase());
  return Array.from(variants);
}
