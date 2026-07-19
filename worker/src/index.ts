import {
  arbeitnowAdapter,
  arbeitsagenturAdapter,
  createAdzunaAdapter,
  createJoobleAdapter,
  createJSearchAdapter,
  ingestSegment,
  jobicyAdapter,
  persistSegmentRun,
  sweepNonGermanyJobs,
  remotiveAdapter,
  sweepJobFreshness,
  theMuseAdapter,
  type Profile,
  type SearchSegment
} from "@jobscout/core";
import { loadEnvFile } from "./lib/env.js";
import { createSupabaseAdmin } from "./lib/supabase.js";

loadEnvFile();

const segment: SearchSegment = {
  keyword: "react developer",
  location: "Berlin",
  activeUserCount: 1,
  lastFetchedAt: null
};

const profile: Profile = {
  userId: "demo",
  skills: ["TypeScript", "React", "Postgres", "API design", "German"],
  targetTitles: ["Frontend Developer", "Full Stack Developer"],
  locations: ["Berlin"],
  remotePref: "remote_de",
  salaryFloor: 65000
};

const adapters = [arbeitsagenturAdapter, arbeitnowAdapter, remotiveAdapter, jobicyAdapter, theMuseAdapter];
const jsearchApiKey = process.env.JSEARCH_API_KEY;
if (jsearchApiKey) {
  adapters.push(createJSearchAdapter({ apiKey: jsearchApiKey }));
}

const adzunaAppId = process.env.ADZUNA_APP_ID;
const adzunaAppKey = process.env.ADZUNA_APP_KEY;
if (adzunaAppId && adzunaAppKey) {
  adapters.push(createAdzunaAdapter({ appId: adzunaAppId, appKey: adzunaAppKey }));
}

const joobleApiKey = process.env.JOOBLE_API_KEY;
if (joobleApiKey) {
  adapters.push(createJoobleAdapter({ apiKey: joobleApiKey }));
}

const result = await ingestSegment(segment, adapters, [profile]);
const supabase = createSupabaseAdmin();
const persisted = await persistSegmentRun(supabase, segment, result.uniqueJobs, result.sourceJobs);
const country = await sweepNonGermanyJobs(supabase);
const freshness = await sweepJobFreshness(supabase);

console.log({
  segment,
  fetched: result.fetched,
  normalized: result.normalized,
  sourceCounts: result.sourceCounts,
  sourceErrors: result.sourceErrors,
  uniqueJobs: result.uniqueJobs.length,
  persisted,
  country,
  freshness,
  topMatches: result.matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((match) => ({
      title: match.job.title,
      company: match.job.company,
      score: match.score,
      reason: match.reason
    }))
});
