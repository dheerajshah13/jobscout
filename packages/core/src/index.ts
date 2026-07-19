export type RemoteMode = "none" | "hybrid" | "full";
export type JobStatus = "active" | "stale" | "expired";
export type MatchStatus = "new" | "seen" | "saved" | "applied" | "hidden";

export type Job = {
  id: string;
  fingerprint: string;
  title: string;
  company: string;
  location: string;
  remote: RemoteMode;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: "EUR";
  description: string;
  applyUrl: string;
  sourceNames: string[];
  postedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: JobStatus;
};

export type Profile = {
  userId: string;
  skills: string[];
  targetTitles: string[];
  locations: string[];
  remotePref: RemoteMode | "remote_de";
  salaryFloor: number | null;
  seniority?: string;
};

export type ScoreBreakdown = {
  skills: number;
  title: number;
  location: number;
  salary: number;
  recency: number;
};

export type Match = {
  userId: string;
  jobId: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string | null;
  status: MatchStatus;
  createdAt: string;
};

export type SearchSegment = {
  keyword: string;
  location: string;
  activeUserCount: number;
  lastFetchedAt: string | null;
};

// ---------------------------------------------------------------------------
// Normalization primitives
// ---------------------------------------------------------------------------

const legalSuffixes = /\b(gmbh|ug|ag|se|kg|ohg|inc|ltd|llc|corp|corporation)\b/g;
const genderSuffixes = /\((m\/w\/d|w\/m\/d|m\/w\/x|gn|all genders|d\/m\/w)\)/gi;
const seniorityTokens = new Set(["junior", "senior", "lead", "principal", "staff"]);

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wraps normalized text in single spaces so whole-word/phrase lookups via `.includes(" x ")` can't match inside a longer word. */
function padded(value: string): string {
  return ` ${normalizeText(value)} `;
}

function containsPhrase(paddedHaystack: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return paddedHaystack.includes(` ${normalizedPhrase} `);
}

// ---------------------------------------------------------------------------
// Title synonyms (bilingual DE/EN) — shared by dedupe fingerprinting AND scoring
// ---------------------------------------------------------------------------

const titleSynonyms = new Map<string, string>([
  ["softwareentwickler", "software developer"],
  ["softwareentwicklerin", "software developer"],
  ["entwickler", "developer"],
  ["entwicklerin", "developer"],
  ["frontend entwickler", "frontend developer"],
  ["backend entwickler", "backend developer"],
  ["full stack entwickler", "full stack developer"],
  ["webentwickler", "web developer"],
  ["anwendungsentwickler", "application developer"],
  ["systemadministrator", "system administrator"],
  ["projektmanager", "project manager"],
  ["produktmanager", "product manager"],
  ["datenanalyst", "data analyst"],
  ["datenwissenschaftler", "data scientist"],
  ["pflegefachkraft", "nurse"],
  ["pflegefachmann", "nurse"],
  ["pflegefachfrau", "nurse"],
  ["krankenpfleger", "nurse"],
  ["krankenschwester", "nurse"],
  ["altenpfleger", "elderly care nurse"],
  ["gesundheits und krankenpfleger", "registered nurse"],
  ["lagerhelfer", "warehouse assistant"],
  ["lagerarbeiter", "warehouse worker"],
  ["kommissionierer", "picker"],
  ["fahrer", "driver"],
  ["lkw fahrer", "truck driver"],
  ["vertrieb", "sales"],
  ["vertriebsmitarbeiter", "sales representative"],
  ["kundenberater", "customer advisor"],
  ["kundendienstmitarbeiter", "customer service representative"],
  ["buchhalter", "accountant"],
  ["personalreferent", "hr specialist"],
  ["personalsachbearbeiter", "hr administrator"],
  ["sachbearbeiter", "administrative specialist"],
  ["empfangsmitarbeiter", "receptionist"],
  ["werkstudent", "working student"],
  ["praktikant", "intern"],
  ["auszubildender", "apprentice"],
  ["teamleiter", "team lead"],
  ["abteilungsleiter", "department head"]
]);

function applySeniorityOrdering(tokens: string[]): string[] {
  const seniority = tokens.filter((token) => seniorityTokens.has(token)).sort();
  const rest = tokens.filter((token) => !seniorityTokens.has(token));
  return [...seniority, ...rest];
}

export function normalizeTitle(title: string): string {
  const normalized = normalizeText(title.replace(genderSuffixes, ""));
  const mapped = titleSynonyms.get(normalized) ?? normalized;
  return applySeniorityOrdering(mapped.split(" ")).join(" ");
}

// ---------------------------------------------------------------------------
// Location synonyms — German city name variants
// ---------------------------------------------------------------------------

const locationSynonyms = new Map<string, string>([
  ["munich", "munchen"],
  ["muenchen", "munchen"],
  ["münchen", "munchen"],
  ["cologne", "koln"],
  ["koeln", "koln"],
  ["köln", "koln"],
  ["nuremberg", "nurnberg"],
  ["nuernberg", "nurnberg"],
  ["nürnberg", "nurnberg"],
  ["duesseldorf", "dusseldorf"],
  ["düsseldorf", "dusseldorf"],
  ["frankfurt am main", "frankfurt"],
  ["hannover", "hanover"]
]);

const GERMANY_WIDE_LOCATION_TOKENS = new Set(["germany", "deutschland", "bundesweit", "nationwide", "deutschlandweit"]);

export function normalizeCompany(company: string): string {
  return normalizeText(company).replace(legalSuffixes, "").replace(/\s+/g, " ").trim();
}

export function normalizeLocation(location: string, remote: RemoteMode = "none"): string {
  if (remote === "full") return "remote";
  const normalized = normalizeText(location);
  return locationSynonyms.get(normalized) ?? normalized;
}

export function makeFingerprint(job: Pick<Job, "company" | "title" | "location" | "remote">): string {
  return [normalizeCompany(job.company), normalizeTitle(job.title), normalizeLocation(job.location, job.remote)].join("|");
}

// ---------------------------------------------------------------------------
// Skill taxonomy — canonical skill -> known aliases/variants (bilingual).
// This is what lets "JS" match "JavaScript", "Pflege" match "nursing", etc.
// instead of relying on the exact string the user typed matching the exact
// string in the job description.
// ---------------------------------------------------------------------------

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ["js", "java script", "ecmascript", "es6", "es2015"],
  typescript: ["ts"],
  react: ["react js", "reactjs", "react.js"],
  "vue": ["vue js", "vuejs"],
  angular: ["angular js", "angularjs"],
  "node.js": ["node", "nodejs", "node js"],
  "next.js": ["nextjs", "next js"],
  python: ["python3", "python 3"],
  java: ["java se", "java ee"],
  "c#": ["csharp", "c sharp", "dotnet", ".net", "dot net"],
  "c++": ["cpp", "c plus plus"],
  go: ["golang"],
  php: [],
  ruby: ["ruby on rails", "rails"],
  postgres: ["postgresql", "psql"],
  mysql: [],
  mongodb: ["mongo"],
  redis: [],
  sql: ["structured query language"],
  graphql: [],
  docker: ["containerization"],
  kubernetes: ["k8s"],
  aws: ["amazon web services"],
  azure: ["microsoft azure"],
  gcp: ["google cloud", "google cloud platform"],
  terraform: ["iac", "infrastructure as code"],
  "ci/cd": ["ci cd", "continuous integration", "continuous deployment", "continuous delivery"],
  git: ["github", "gitlab", "version control"],
  html: ["html5"],
  css: ["css3", "scss", "sass", "tailwind", "tailwindcss"],
  "api design": ["api development", "rest api", "restful api", "rest apis", "api integration"],
  "system design": ["software architecture", "systemarchitektur"],
  accessibility: ["a11y", "barrierefreiheit", "wcag"],
  agile: ["scrum", "kanban"],
  "data analysis": ["datenanalyse", "data analytics"],
  "machine learning": ["ml", "maschinelles lernen"],
  excel: ["ms excel", "microsoft excel"],
  sap: ["sap erp"],
  salesforce: ["crm"],
  german: ["deutsch", "deutschkenntnisse", "german language"],
  english: ["englisch", "english language"],
  nursing: ["pflege", "krankenpflege", "pflegefachkraft", "altenpflege", "patientenversorgung", "patient care"],
  "wound care": ["wundversorgung"],
  "medication administration": ["medikamentengabe"],
  logistics: ["logistik"],
  warehouse: ["lager", "lagerhaltung", "lagerlogistik"],
  "forklift operation": ["staplerschein", "gabelstapler"],
  sales: ["vertrieb", "verkauf"],
  "customer service": ["kundenservice", "kundenbetreuung", "kundendienst"],
  accounting: ["buchhaltung", "rechnungswesen"],
  "project management": ["projektmanagement", "projektleitung"],
  "product management": ["produktmanagement"],
  "hr": ["human resources", "personalwesen", "personalmanagement"],
  recruiting: ["personalbeschaffung", "rekrutierung"],
  communication: ["kommunikation", "kommunikationsstark"],
  teamwork: ["teamfahigkeit", "teamarbeit"]
};

const SKILL_ALIAS_INDEX: Map<string, string> = (() => {
  const index = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    index.set(normalizeText(canonical), canonical);
    for (const alias of aliases) index.set(normalizeText(alias), canonical);
  }
  return index;
})();

function canonicalSkillKey(skill: string): string | null {
  return SKILL_ALIAS_INDEX.get(normalizeText(skill)) ?? null;
}

function skillVariants(skill: string): string[] {
  const canonical = canonicalSkillKey(skill);
  if (canonical) return [canonical, ...(SKILL_ALIASES[canonical] ?? [])];
  return [skill];
}

function bigrams(value: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < value.length - 1; i++) set.add(value.slice(i, i + 2));
  return set;
}

/** Dice coefficient over character bigrams — cheap, dependency-free fuzzy string similarity (0..1). */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (!bigramsA.size || !bigramsB.size) return 0;
  let intersection = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

const FUZZY_MATCH_THRESHOLD = 0.82;
const TITLE_MENTION_BONUS = 0.15;
const FUZZY_MATCH_WEIGHT = 0.6;

type SkillMatch = {
  skill: string;
  weight: number; // 0 (no match), FUZZY_MATCH_WEIGHT (fuzzy), 1..1+bonus (exact/alias, boosted if also in title)
  matchedVia: "exact" | "fuzzy" | "none";
};

/**
 * Scores each profile skill against the job's title+description using the
 * alias taxonomy first, then a fuzzy character-similarity fallback for
 * skills we don't have in the taxonomy (typos, niche tools, etc). Skills
 * that also appear in the job title get a small bonus since a title mention
 * signals it's central to the role, not incidental.
 */
function matchSkills(job: Job, profile: Profile): { score: number; matches: SkillMatch[] } {
  if (!profile.skills.length) return { score: 0, matches: [] };

  const paddedDescription = padded(`${job.title} ${job.description}`);
  const paddedTitle = padded(job.title);
  const descriptionTokens = Array.from(new Set(normalizeText(job.description).split(" ").filter(Boolean)));

  const matches: SkillMatch[] = profile.skills.map((skill) => {
    const variants = skillVariants(skill);
    const exactHit = variants.some((variant) => containsPhrase(paddedDescription, variant));

    if (exactHit) {
      const inTitle = variants.some((variant) => containsPhrase(paddedTitle, variant));
      return { skill, weight: inTitle ? 1 + TITLE_MENTION_BONUS : 1, matchedVia: "exact" };
    }

    const normalizedSkill = normalizeText(skill);
    if (!normalizedSkill.includes(" ") && normalizedSkill.length >= 3) {
      let bestSimilarity = 0;
      for (const token of descriptionTokens) {
        if (Math.abs(token.length - normalizedSkill.length) > 3) continue;
        const similarity = diceCoefficient(normalizedSkill, token);
        if (similarity > bestSimilarity) bestSimilarity = similarity;
      }
      if (bestSimilarity >= FUZZY_MATCH_THRESHOLD) {
        return { skill, weight: FUZZY_MATCH_WEIGHT, matchedVia: "fuzzy" };
      }
    }

    return { skill, weight: 0, matchedVia: "none" };
  });

  const totalWeight = matches.reduce((sum, match) => sum + match.weight, 0);
  const score = Math.min(1, totalWeight / profile.skills.length);

  return { score, matches };
}

// ---------------------------------------------------------------------------
// Title + seniority fit
// ---------------------------------------------------------------------------

const SENIORITY_LEVELS: Array<{ rank: number; tokens: string[] }> = [
  { rank: 0, tokens: ["intern", "internship", "werkstudent", "working student", "praktikant", "praktikum"] },
  { rank: 1, tokens: ["junior", "entry level", "berufseinsteiger", "trainee", "auszubildender", "apprentice"] },
  { rank: 2, tokens: ["mid level", "intermediate"] },
  { rank: 3, tokens: ["senior", "erfahren", "fachkraft"] },
  { rank: 4, tokens: ["lead", "principal", "staff", "head of", "teamlead", "team lead", "leitung", "manager"] }
];

const PROFILE_SENIORITY_RANK: Record<string, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4
};

function inferSeniorityRank(text: string): number | null {
  const normalized = normalizeText(text);
  for (const { rank, tokens } of SENIORITY_LEVELS) {
    if (tokens.some((token) => normalized.includes(normalizeText(token)))) return rank;
  }
  return null;
}

function tokenOverlap(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

/** Blends token overlap and whole-string fuzzy similarity, taking the best signal per candidate target title. */
function roleSimilarity(jobTitle: string, targetTitles: string[]): number {
  if (!targetTitles.length) return 0;
  const normalizedJobTitle = normalizeTitle(jobTitle);
  return Math.max(
    0,
    ...targetTitles.map((target) => {
      const normalizedTarget = normalizeTitle(target);
      // Token overlap carries the semantic weight (do the role words actually match?);
      // bigram dice is a supporting signal only — two short titles can share a lot of
      // characters ("developer") while describing very different roles.
      return 0.7 * tokenOverlap(normalizedJobTitle, normalizedTarget) + 0.3 * diceCoefficient(normalizedJobTitle, normalizedTarget);
    })
  );
}

function seniorityFit(job: Job, profile: Profile): number {
  if (!profile.seniority) return 1; // no stated preference — don't penalize
  const profileRank = PROFILE_SENIORITY_RANK[normalizeText(profile.seniority)];
  if (profileRank === undefined) return 1;

  const jobRank = inferSeniorityRank(`${job.title} ${job.description}`);
  if (jobRank === null) return 0.85; // job doesn't signal a level — mild neutral credit, not a penalty

  const diff = Math.abs(jobRank - profileRank);
  if (diff === 0) return 1;
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.4;
  return 0.15;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreJob(job: Job, profile: Profile, now = new Date()): ScoreBreakdown {
  const { score: skills } = matchSkills(job, profile);

  const title = clamp01(0.8 * roleSimilarity(job.title, profile.targetTitles) + 0.2 * seniorityFit(job, profile));

  const jobLocation = normalizeLocation(job.location, job.remote);
  const profileLocations = profile.locations.map((location) => normalizeLocation(location));
  const remoteFriendly = profile.remotePref === "full" || profile.remotePref === "remote_de";
  const location =
    job.remote === "full" && remoteFriendly
      ? 1
      : profileLocations.includes(jobLocation)
        ? 1
        : job.remote === "hybrid" && profileLocations.includes(jobLocation)
          ? 0.75
          : GERMANY_WIDE_LOCATION_TOKENS.has(jobLocation) && remoteFriendly
            ? 0.6
            : 0;

  const effectiveSalary = job.salaryMax ?? job.salaryMin;
  const salary =
    profile.salaryFloor === null || effectiveSalary === null
      ? 0.5
      : effectiveSalary >= profile.salaryFloor
        ? 1
        : Math.max(0, effectiveSalary / profile.salaryFloor);

  const ageDays = Math.max(0, (now.getTime() - new Date(job.postedAt).getTime()) / 86_400_000);
  const recency = Math.max(0, 1 - ageDays / 21);

  return { skills, title, location, salary, recency };
}

export function totalScore(breakdown: ScoreBreakdown): number {
  return Math.round(breakdown.skills * 45 + breakdown.title * 25 + breakdown.location * 15 + breakdown.salary * 15);
}

export function explainMatch(job: Job, profile: Profile, breakdown: ScoreBreakdown): string {
  const { matches } = matchSkills(job, profile);
  const matchedSkills = matches.filter((match) => match.weight > 0);
  const namedSkills = matchedSkills
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((match) => match.skill);

  const skillsBit = matchedSkills.length
    ? `matches ${matchedSkills.length} of your ${profile.skills.length} skills (${namedSkills.join(", ")})`
    : profile.skills.length
      ? "shares none of your listed skills yet"
      : "add skills to your profile to see skill matches";

  const locationBit =
    breakdown.location >= 1
      ? "fits your location preference exactly"
      : breakdown.location >= 0.75
        ? "is hybrid in a city you listed"
        : breakdown.location >= 0.6
          ? "is nationwide/remote-flexible in Germany"
          : "is outside your preferred locations";

  const effectiveSalary = job.salaryMax ?? job.salaryMin;
  const salaryBit =
    effectiveSalary && profile.salaryFloor
      ? effectiveSalary >= profile.salaryFloor
        ? `pays at or above your ${profile.salaryFloor.toLocaleString("de-DE")} EUR floor`
        : `pays below your ${profile.salaryFloor.toLocaleString("de-DE")} EUR floor`
      : "has limited salary data";

  return `${capitalize(skillsBit)}, ${locationBit}, and ${salaryBit}.`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Exposed for the resume-parsing fallback (packages/core has no external
// deps, so this doubles as a free, offline skill-extraction helper when the
// Claude API isn't available).
export function extractKnownSkillsFromText(text: string): string[] {
  const paddedTarget = padded(text);
  const found = new Set<string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if ([canonical, ...aliases].some((variant) => containsPhrase(paddedTarget, variant))) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

export * from "./adapters/types.js";
export { arbeitnowAdapter } from "./adapters/arbeitnow.js";
export { arbeitsagenturAdapter } from "./adapters/arbeitsagentur.js";
export { remotiveAdapter } from "./adapters/remotive.js";
export { jobicyAdapter } from "./adapters/jobicy.js";
export { theMuseAdapter } from "./adapters/themuse.js";
export { createJSearchAdapter, fetchJSearchRows } from "./adapters/jsearch.js";
export { createAdzunaAdapter } from "./adapters/adzuna.js";
export { createJoobleAdapter } from "./adapters/jooble.js";
export {
  DIRECT_JOB_SOURCES,
  DISCOVER_SOURCE_OPTIONS,
  JSEARCH_FILTER_SOURCES,
  JSEARCH_PUBLISHER_SOURCES,
  LEGACY_JSEARCH_SOURCE,
  buildJSearchQuery,
  buildJSearchQueries,
  displaySourceNames,
  hasDiscoverSearch,
  isDirectJobSource,
  isJSearchBackedSource,
  jobMatchesDiscoverQuery,
  scoreDiscoverRelevance,
  parseDiscoverTerms,
  publisherFromApplyUrl,
  publisherToSourceName,
  resolveJobSourceName
} from "./job-sources.js";
export * from "./pipeline.js";
export * from "./persist.js";
export { expandSearchTerm, expandLocationTerm } from "./search-expansion.js";
export { GERMAN_CITIES } from "./german-cities.js";
