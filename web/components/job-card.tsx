import { Bookmark, CalendarDays, CheckCircle2, ExternalLink, EyeOff, MapPin, Wallet } from "lucide-react";
import { displaySourceNames, type Job, type MatchStatus, type ScoreBreakdown } from "@jobscout/core";
import { setMatchStatus } from "../app/actions/matches";
import { formatPostedAt, postedLabel } from "../lib/format";
import type { JobLanguage } from "../lib/translate";

type Props = {
  job: Job;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  matchStatus?: MatchStatus | null;
  /** Path to revalidate after save/hide so the button state updates. */
  currentPath?: string;
  /** Signed-in users get working save/hide buttons; signed-out visitors are prompted to sign in. */
  signedIn?: boolean;
  /** "match" shows score badge + reason + breakdown (AI Matches); "plain" is a normal job-board card (Discover). */
  variant?: "match" | "plain";
  lang?: JobLanguage;
};

export function JobCard({ job, score, scoreBreakdown, reason, matchStatus, currentPath = "/", signedIn = false, variant = "match", lang = "en" }: Props) {
  const isSaved = matchStatus === "saved";
  const isHidden = matchStatus === "hidden";
  const isApplied = matchStatus === "applied";
  const showScore = variant === "match";
  const sources = displaySourceNames(job.sourceNames);
  const primarySource = sources[0];

  return (
    <article className="rounded-lg border border-line bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <a className="block hover:text-pine" href={`/job/${job.id}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-ink">{job.title}</h3>
            {showScore ? (
              <span className="rounded-full bg-pine px-3 py-1 text-sm font-semibold text-white">{score}%</span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/70">
            <span>{job.company}</span>
            {primarySource ? (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-ink/55">
                via {primarySource}
              </span>
            ) : null}
          </p>
        </a>
        <div className="flex gap-2">
          {signedIn ? (
            <>
              <MatchActionButton
                job={job}
                score={score}
                scoreBreakdown={scoreBreakdown}
                reason={reason}
                currentPath={currentPath}
                nextStatus={isSaved ? "new" : "saved"}
                label={isSaved ? "Unsave job" : "Save job"}
                active={isSaved}
              >
                <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
              </MatchActionButton>
              <MatchActionButton
                job={job}
                score={score}
                scoreBreakdown={scoreBreakdown}
                reason={reason}
                currentPath={currentPath}
                nextStatus={isApplied ? "saved" : "applied"}
                label={isApplied ? "Mark as not applied" : "Mark as applied"}
                active={isApplied}
              >
                <CheckCircle2 size={18} fill={isApplied ? "currentColor" : "none"} />
              </MatchActionButton>
              <MatchActionButton
                job={job}
                score={score}
                scoreBreakdown={scoreBreakdown}
                reason={reason}
                currentPath={currentPath}
                nextStatus={isHidden ? "new" : "hidden"}
                label={isHidden ? "Unhide job" : "Hide job"}
                active={isHidden}
              >
                <EyeOff size={18} />
              </MatchActionButton>
            </>
          ) : (
            <a
              aria-label="Sign in to save or hide jobs"
              title="Sign in to save or hide jobs"
              className="rounded-md border border-line p-2 text-ink/40"
              href={`/login?next=${encodeURIComponent(currentPath)}`}
            >
              <Bookmark size={18} />
            </a>
          )}
          <a
            aria-label="Open application"
            className="rounded-md bg-coral p-2 text-white hover:bg-coral/90"
            href={job.applyUrl}
            target="_blank"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      <a className="mt-4 block text-base text-ink hover:text-pine" href={`/job/${job.id}`}>
        {showScore ? reason : excerpt(job.description)}
      </a>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink/70">
        <span className="inline-flex items-center gap-1">
          <MapPin size={16} />
          {job.remote === "full" ? "Remote in Germany" : `${job.location} · ${job.remote}`}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wallet size={16} />
          {job.salaryMax ? `${job.salaryMin?.toLocaleString("de-DE")}–${job.salaryMax.toLocaleString("de-DE")} EUR` : "Salary not listed"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={16} />
          {postedLabel(lang)} {formatPostedAt(job.postedAt, lang, showScore ? "long" : "short")}
        </span>
      </div>

      {sources.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {sources.map((source) => (
            <span key={source} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink/60">
              {source}
            </span>
          ))}
        </div>
      ) : null}

      {showScore ? (
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
      ) : null}
    </article>
  );
}

function visibleScoreBreakdown(scoreBreakdown: ScoreBreakdown) {
  return Object.entries(scoreBreakdown).filter(([label]) => label !== "recency");
}

/** Plain-card summary line: first ~180 chars of the description with any HTML stripped. */
function excerpt(description: string): string {
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 180)}…` : text || "No description provided.";
}

type MatchActionButtonProps = {
  job: Job;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  currentPath: string;
  nextStatus: MatchStatus;
  label: string;
  active: boolean;
  children: React.ReactNode;
};

function MatchActionButton({ job, score, scoreBreakdown, reason, currentPath, nextStatus, label, active, children }: MatchActionButtonProps) {
  return (
    <form action={setMatchStatus}>
      <input type="hidden" name="jobId" value={job.id} />
      <input type="hidden" name="score" value={score} />
      <input type="hidden" name="scoreBreakdown" value={JSON.stringify(scoreBreakdown)} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="status" value={nextStatus} />
      <input type="hidden" name="redirectPath" value={currentPath} />
      <button
        aria-label={label}
        title={label}
        type="submit"
        className={`rounded-md border p-2 ${active ? "border-pine bg-pine/10 text-pine" : "border-line text-ink hover:bg-paper"}`}
      >
        {children}
      </button>
    </form>
  );
}
