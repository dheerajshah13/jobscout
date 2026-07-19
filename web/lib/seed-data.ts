import { explainMatch, scoreJob, totalScore, type Job, type Profile } from "@jobscout/core";

export const demoProfile: Profile = {
  userId: "demo",
  skills: ["TypeScript", "React", "Postgres", "API design", "German"],
  targetTitles: ["Frontend Developer", "Full Stack Developer", "Software Developer"],
  locations: ["Berlin", "Munich"],
  remotePref: "remote_de",
  salaryFloor: 65000,
  seniority: "mid"
};

export const jobs: Job[] = [
  {
    id: "job-1",
    fingerprint: "klarwerk|frontend developer|berlin",
    title: "Frontend Developer (m/w/d)",
    company: "Klarwerk GmbH",
    location: "Berlin",
    remote: "hybrid",
    salaryMin: 62000,
    salaryMax: 78000,
    currency: "EUR",
    description:
      "Build hiring tools with React, TypeScript, accessibility standards, API design, and Postgres-backed product analytics.",
    applyUrl: "https://example.com/apply/klarwerk-frontend",
    sourceNames: ["Adzuna", "Arbeitnow"],
    postedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    status: "active"
  },
  {
    id: "job-2",
    fingerprint: "medix|software developer|remote",
    title: "Softwareentwickler Remote (gn)",
    company: "Medix SE",
    location: "Germany",
    remote: "full",
    salaryMin: null,
    salaryMax: null,
    currency: "EUR",
    description:
      "Remote-in-Germany team building healthcare workflows with TypeScript, Node.js, React, and clean API integrations.",
    applyUrl: "https://example.com/apply/medix-softwareentwickler",
    sourceNames: ["JSearch"],
    postedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    status: "active"
  },
  {
    id: "job-3",
    fingerprint: "nordcloud|full stack engineer|munich",
    title: "Full Stack Engineer",
    company: "Nordcloud AG",
    location: "München",
    remote: "hybrid",
    salaryMin: 70000,
    salaryMax: 90000,
    currency: "EUR",
    description:
      "Own product surfaces in React and TypeScript, design APIs, and improve Postgres query performance for logistics teams.",
    applyUrl: "https://example.com/apply/nordcloud-fullstack",
    sourceNames: ["Jooble", "Adzuna"],
    postedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    status: "active"
  },
  {
    id: "job-4",
    fingerprint: "stadtpflege|pflegefachkraft|koln",
    title: "Pflegefachkraft (w/m/d)",
    company: "Stadtpflege Köln",
    location: "Köln",
    remote: "none",
    salaryMin: 42000,
    salaryMax: 52000,
    currency: "EUR",
    description:
      "Patient care role with digital documentation, German communication, shift planning, and continuing education budget.",
    applyUrl: "https://example.com/apply/stadtpflege",
    sourceNames: ["Arbeitsagentur"],
    postedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    status: "active"
  }
];

export const rankedMatches = jobs
  .map((job) => {
    const scoreBreakdown = scoreJob(job, demoProfile);
    return {
      job,
      scoreBreakdown,
      score: totalScore(scoreBreakdown),
      reason: explainMatch(job, demoProfile, scoreBreakdown)
    };
  })
  .sort((a, b) => b.score - a.score);
