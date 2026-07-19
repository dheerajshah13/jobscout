import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, CalendarDays, ExternalLink, EyeOff, Languages, MapPin, Wallet } from "lucide-react";
import type { ScoreBreakdown } from "@jobscout/core";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";
import { JobDescription } from "../../../components/job-description";
import { formatPostedAt, postedLabel } from "../../../lib/format";
import { getJobById } from "../../../lib/jobs";
import { enrichJobDescription, isLikelyTruncated } from "../../../lib/enrich-description";
import { getJobTranslation } from "../../../lib/translate";
import { createSupabaseServerClient, getCurrentUser } from "../../../lib/supabase/server";
import { getLanguage } from "../../actions/language";
import { setMatchStatus } from "../../actions/matches";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const match = await getJobById(supabase, user?.id ?? null, id);

  if (!match) {
    notFound();
  }

  const { job, score, scoreBreakdown, reason, matchStatus } = match;
  const lang = await getLanguage();
  // Aggregator postings arrive as short snippets — fetch the full text on demand.
  const fullDescription = await enrichJobDescription(job);
  const enrichedJob = { ...job, description: fullDescription };
  const translation = await getJobTranslation(enrichedJob, lang);
  const displayTitle = translation.state === "translated" ? translation.title : job.title;
  const displayDescription = translation.state === "translated" ? translation.description : fullDescription;
  const currentPath = `/job/${id}`;
  const isSaved = matchStatus === "saved";
  const isHidden = matchStatus === "hidden";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader showLanguageToggle />
      <div className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <a className="inline-flex items-center gap-2 text-sm font-semibold text-pine" href="/">
          <ArrowLeft size={16} />
          Back to feed
        </a>

        <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold leading-tight text-ink">{displayTitle}</h1>
                <span className="rounded-full bg-pine px-3 py-1 text-sm font-semibold text-white">{score}%</span>
              </div>
              <p className="mt-2 text-lg text-ink/70">{job.company}</p>
            </div>
            <div className="flex gap-2">
              {user ? (
                <>
                  <ActionForm
                    jobId={job.id}
                    score={score}
                    scoreBreakdown={scoreBreakdown}
                    reason={reason}
                    status={isSaved ? "new" : "saved"}
                    redirectPath={currentPath}
                    active={isSaved}
                    label={isSaved ? "Unsave" : "Save"}
                  >
                    <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                  </ActionForm>
                  <ActionForm
                    jobId={job.id}
                    score={score}
                    scoreBreakdown={scoreBreakdown}
                    reason={reason}
                    status={isHidden ? "new" : "hidden"}
                    redirectPath={currentPath}
                    active={isHidden}
                    label={isHidden ? "Unhide" : "Hide"}
                  >
                    <EyeOff size={18} />
                  </ActionForm>
                </>
              ) : null}
              <a
                className="inline-flex items-center justify-center gap-2 rounded-md bg-coral px-5 py-3 font-semibold text-white"
                href={job.applyUrl}
                target="_blank"
              >
                Apply <ExternalLink size={18} />
              </a>
            </div>
          </div>

          <p className="mt-6 text-lg text-ink">{reason}</p>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-ink/70">
            <span className="inline-flex items-center gap-1">
              <MapPin size={16} />
              {job.remote === "full" ? "Remote in Germany" : `${job.location} · ${job.remote}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet size={16} />
              {job.salaryMax
                ? `${job.salaryMin?.toLocaleString("de-DE")}–${job.salaryMax.toLocaleString("de-DE")} EUR`
                : "Salary not listed"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={16} />
              {postedLabel(lang)} {formatPostedAt(job.postedAt, lang, "long")}
            </span>
          </div>

          {job.sourceNames.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {job.sourceNames.map((source) => (
                <span key={source} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink/60">
                  {source}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-ink">Match breakdown</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {visibleScoreBreakdown(scoreBreakdown).map(([label, value]) => (
              <div key={label} className="rounded-md bg-paper p-3">
                <div className="text-xs uppercase tracking-wide text-ink/55">{label}</div>
                <div className="mt-1 text-lg font-semibold text-ink">{Math.round(value * 100)}%</div>
              </div>
            ))}
            <div className="rounded-md bg-paper p-3">
              <div className="text-xs uppercase tracking-wide text-ink/55">{postedLabel(lang)}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-ink">{formatPostedAt(job.postedAt, lang, "short")}</div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-ink">Description</h2>
            {translation.state === "translated" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pine/10 px-3 py-1 text-xs font-semibold text-pine">
                <Languages size={14} />
                {translation.quality === "google" ? "Google translated" : "Free offline translation"} from{" "}
                {translation.from === "de" ? "German" : "English"}
              </span>
            ) : null}
            {translation.state === "unavailable" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/55">
                <Languages size={14} />
                {translation.from === "de"
                  ? "Posting is in German — free translation is unavailable"
                  : "Posting is in English — free translation is unavailable"}
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            <JobDescription value={displayDescription} />
          </div>
          {isLikelyTruncated(fullDescription) ? (
            <a
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-pine/30 bg-pine/5 px-4 py-2.5 text-sm font-semibold text-pine hover:bg-pine/10"
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read the full posting on {job.sourceNames[0] ?? "the original site"}
              <ExternalLink size={15} />
            </a>
          ) : null}
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function visibleScoreBreakdown(scoreBreakdown: ScoreBreakdown): Array<[string, number]> {
  return Object.entries(scoreBreakdown).filter(([label]) => label !== "recency");
}

type ActionFormProps = {
  jobId: string;
  score: number;
  scoreBreakdown: unknown;
  reason: string;
  status: string;
  redirectPath: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
};

function ActionForm({ jobId, score, scoreBreakdown, reason, status, redirectPath, active, label, children }: ActionFormProps) {
  return (
    <form action={setMatchStatus}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="score" value={score} />
      <input type="hidden" name="scoreBreakdown" value={JSON.stringify(scoreBreakdown)} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <button
        aria-label={label}
        title={label}
        type="submit"
        className={`inline-flex items-center justify-center rounded-md border p-3 ${
          active ? "border-pine bg-pine/10 text-pine" : "border-line text-ink hover:bg-paper"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
