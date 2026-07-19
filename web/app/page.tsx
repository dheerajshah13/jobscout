import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { JobCard } from "../components/job-card";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { getFeed } from "../lib/jobs";
import { FREE_MATCH_LIMIT, FREE_RUNS_PER_DAY } from "../lib/plan";
import { getRunUsage, runAiMatching } from "./actions/runs";
import { getLanguage } from "./actions/language";
import { createSupabaseServerClient, getCurrentUser } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<{ runError?: string }>;

export default async function HomePage({ searchParams }: { searchParams: HomeSearchParams }) {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const lang = await getLanguage();

  if (user) {
    const { runError } = await searchParams;
    return <Dashboard userId={user.id} runError={runError} lang={lang} />;
  }

  const { matches } = await getFeed(supabase, null, 3);

  return (
    <main>
      <section className="min-h-[92vh] px-5 py-6 sm:px-8">
        <SiteHeader />

        <div className="mx-auto grid max-w-6xl gap-8 pt-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="pt-4 lg:sticky lg:top-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-pine">Germany job feed</p>
            <h1 className="mt-3 max-w-2xl text-5xl font-bold leading-tight text-ink sm:text-6xl">
              Ranked jobs that explain why they fit.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-ink/75">
              JobScout pulls listings from multiple sources, removes duplicates, and scores every role against your
              skills, target titles, location, and salary floor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 rounded-md bg-pine px-5 py-3 font-semibold text-white"
                href="/onboarding"
              >
                Build my feed <ArrowRight size={18} />
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-md border border-ink/20 bg-white/80 px-5 py-3 font-semibold text-ink"
                href="/discover"
              >
                <Search size={18} />
                Browse all jobs
              </a>
            </div>
          </div>

          <div className="space-y-4">
            {matches.map((match) => (
              <JobCard key={match.job.id} {...match} signedIn={false} currentPath="/" lang={lang} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {featureCards.map(({ title, body, Icon }) => (
            <div key={title} className="rounded-lg border border-line p-5">
              <Icon className="text-pine" size={24} />
              <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

async function Dashboard({ userId, runError, lang }: { userId: string; runError?: string; lang: Awaited<ReturnType<typeof getLanguage>> }) {
  const supabase = await createSupabaseServerClient();

  const [{ matches, isDemoProfile }, savedCount, jobPoolCount, runUsage] = await Promise.all([
    getFeed(supabase, userId, FREE_MATCH_LIMIT),
    countMatches(supabase, userId, "saved"),
    countActiveJobs(supabase),
    getRunUsage(userId)
  ]);
  const runsLeft = Math.max(0, FREE_RUNS_PER_DAY - runUsage.usedToday);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <SiteHeader />

      <div className="mx-auto max-w-4xl pt-6">
        {isDemoProfile ? (
          <div className="rounded-lg border border-pine/30 bg-pine/5 p-5">
            <h1 className="text-2xl font-bold text-ink">Finish your profile to unlock AI matches</h1>
            <p className="mt-2 text-ink/70">
              The feed below is scored against a sample profile. Complete onboarding so scores reflect you.
            </p>
            <a
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-pine px-5 py-2.5 font-semibold text-white"
              href="/onboarding"
            >
              Complete onboarding <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <h1 className="text-3xl font-bold text-ink">Your matches today</h1>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard Icon={Sparkles} label="AI matches" value={matches.length} href="#matches" />
          <StatCard Icon={Bookmark} label="Saved" value={savedCount} href="/saved" />
          <StatCard Icon={Search} label="Jobs indexed" value={jobPoolCount} href="/discover" />
        </div>

        <div id="matches" className="mt-10 rounded-lg border border-line bg-white/95 p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-ink">AI Matches</h2>
              <p className="mt-1 text-sm text-ink/65">
                {runUsage.lastRun ? (
                  <>
                    Last run {formatRunTime(runUsage.lastRun.ranAt)} · scanned {runUsage.lastRun.jobsScanned} jobs from 5
                    sources · {runUsage.lastRun.jobsMatched} scored ≥50% for you
                  </>
                ) : (
                  <>Run your first AI matching pass — it fetches fresh jobs for your target roles right now.</>
                )}
              </p>
            </div>
            {isDemoProfile ? null : (
              <form action={runAiMatching}>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-pine px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={runsLeft === 0}
                >
                  <Sparkles size={16} />
                  Run AI matching
                </button>
              </form>
            )}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
            {runsLeft} of {FREE_RUNS_PER_DAY} runs left today (free plan) · top {FREE_MATCH_LIMIT} results shown
          </p>
          {runError === "limit" ? (
            <p className="mt-2 rounded-md bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
              You've used all {FREE_RUNS_PER_DAY} runs for today — your matches below stay fresh as the background worker
              ingests new jobs.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:underline" href="/discover">
            Search all jobs <ArrowRight size={15} />
          </a>
        </div>

        <div className="mt-4 space-y-4">
          {matches.length ? (
            matches.map((match) => (
              <JobCard key={match.job.id} {...match} signedIn currentPath="/" lang={lang} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-white/70 p-8 text-center">
              <p className="text-lg font-semibold text-ink">No matches yet.</p>
              <p className="mt-2 text-sm text-ink/65">
                New jobs are ingested continuously — check back soon, or{" "}
                <a className="font-semibold text-pine hover:underline" href="/discover">
                  search the full pool
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

function formatRunTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return today ? `today ${time}` : date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + ` ${time}`;
}

function StatCard({ Icon, label, value, href }: { Icon: LucideIcon; label: string; value: number; href: string }) {
  return (
    <a className="rounded-lg border border-line bg-white/95 p-4 shadow-soft hover:border-pine" href={href}>
      <Icon className="text-pine" size={18} />
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
    </a>
  );
}

async function countMatches(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  status: string
): Promise<number> {
  const { count } = await supabase
    .from("matches")
    .select("job_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);
  return count ?? 0;
}

async function countActiveJobs(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<number> {
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active");
  return count ?? 0;
}

const featureCards: Array<{ title: string; body: string; Icon: LucideIcon }> = [
  {
    title: "Adapter pipeline",
    body: "Every source implements fetch and normalize behind one interface.",
    Icon: BriefcaseBusiness
  },
  {
    title: "Transparent scoring",
    body: "Skills, title, location, salary, and posted time are shown on every match.",
    Icon: SlidersHorizontal
  },
  {
    title: "GDPR baseline",
    body: "Profile export, deletion, consent-aware CV storage, and Impressum-ready pages.",
    Icon: ShieldCheck
  }
];
