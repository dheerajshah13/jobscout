import { DISCOVER_SOURCE_OPTIONS, GERMAN_CITIES, isDirectJobSource } from "@jobscout/core";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { DiscoverSearchResults } from "../../components/discover-search-results";
import { RoleSearchInput } from "../../components/role-search-input";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { DISCOVER_PAGE_SIZE, searchJobs, type DiscoverFilters } from "../../lib/jobs";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { getLanguage } from "../actions/language";

export const dynamic = "force-dynamic";

const REMOTE_OPTIONS = [
  { value: "", label: "Any workplace" },
  { value: "none", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "full", label: "Remote" }
] as const;

const SALARY_OPTIONS = [
  { value: "", label: "Any salary" },
  { value: "40000", label: "40.000+ EUR" },
  { value: "60000", label: "60.000+ EUR" },
  { value: "80000", label: "80.000+ EUR" },
  { value: "100000", label: "100.000+ EUR" }
] as const;

const SOURCE_OPTIONS = DISCOVER_SOURCE_OPTIONS;

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "React Developer",
  "Node.js Developer",
  "Python Developer",
  "Java Developer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Data Engineer",
  "Data Analyst",
  "Data Scientist",
  "Machine Learning Engineer",
  "QA Engineer",
  "Product Manager",
  "Project Manager",
  "UX Designer",
  "UI Designer",
  "Marketing Manager",
  "Sales Manager",
  "Customer Success Manager",
  "Business Analyst",
  "Werkstudent",
  "Praktikum",
  "Softwareentwickler",
  "Frontend Entwickler",
  "Backend Entwickler",
  "Full Stack Entwickler",
  "Datenanalyst",
  "Projektmanager"
] as const;

const POSTED_OPTIONS = [
  { value: "", label: "All time" },
  { value: "1h", label: "Last hour" },
  { value: "12h", label: "Last 12 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" }
] as const;

const fieldClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function buildLiveApiQuery(params: SearchParams): string {
  const q = first(params.q);
  const location = first(params.location);
  if (!q.trim() && !location.trim()) return "";

  const source = first(params.source);
  // Adzuna and Jooble have live paths; other direct sources are Supabase-only.
  if (source && source !== "Adzuna" && source !== "Jooble" && isDirectJobSource(source)) return "";

  const next = new URLSearchParams();
  if (q.trim()) next.set("q", q.trim());
  if (location.trim()) next.set("location", location.trim());
  const remote = first(params.remote);
  if (remote) next.set("remote", remote);
  const salary = first(params.salary);
  if (salary) next.set("salary", salary);
  if (source) next.set("source", source);
  const posted = first(params.posted);
  if (posted) next.set("posted", posted);
  return next.toString();
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const lang = await getLanguage();

  const remote = first(params.remote);
  const posted = first(params.posted);
  const minSalary = Number.parseInt(first(params.salary), 10);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const filters: DiscoverFilters = {
    q: first(params.q) || undefined,
    location: first(params.location) || undefined,
    remote: remote === "none" || remote === "hybrid" || remote === "full" ? remote : undefined,
    minSalary: Number.isFinite(minSalary) && minSalary > 0 ? minSalary : undefined,
    source: first(params.source) || undefined,
    postedWithin: posted === "1h" || posted === "12h" || posted === "24h" || posted === "3d" || posted === "7d" ? posted : undefined,
    sort: "newest"
  };

  const hasSearch = Boolean(filters.q?.trim() || filters.location?.trim());
  const { matches, total, pageCount, broadened } = hasSearch
    ? await searchJobs(supabase, user?.id ?? null, filters, page)
    : { matches: [], total: 0, pageCount: 0, broadened: false };
  const liveApiQuery = buildLiveApiQuery(params);

  const pageLink = (target: number) => {
    const next = new URLSearchParams();
    if (filters.q) next.set("q", filters.q);
    if (filters.location) next.set("location", filters.location);
    if (remote) next.set("remote", remote);
    if (first(params.salary)) next.set("salary", first(params.salary));
    if (filters.source) next.set("source", filters.source);
    if (posted) next.set("posted", posted);
    next.set("page", String(target));
    return `/discover?${next.toString()}`;
  };

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <SiteHeader />

      <div className="mx-auto max-w-4xl pt-6">
        <h1 className="text-3xl font-bold text-ink">Discover jobs</h1>
        <p className="mt-2 text-ink/70">Search by role or city — results load only after you search.</p>

        <form method="get" className="mt-6 rounded-lg border border-line bg-white/95 p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row">
            <RoleSearchInput className={fieldClass} defaultValue={filters.q ?? ""} suggestions={ROLE_SUGGESTIONS} />
            <select
              className={`${fieldClass} sm:max-w-52`}
              name="location"
              defaultValue={filters.location ?? ""}
              aria-label="City in Germany"
            >
              <option value="">All of Germany</option>
              {GERMAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-pine px-5 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              <Search size={16} />
              Search
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              Workplace
              <select className={`${fieldClass} mt-1 font-normal normal-case tracking-normal`} name="remote" defaultValue={remote}>
                {REMOTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              Salary
              <select className={`${fieldClass} mt-1 font-normal normal-case tracking-normal`} name="salary" defaultValue={first(params.salary)}>
                {SALARY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              Source
              <select className={`${fieldClass} mt-1 font-normal normal-case tracking-normal`} name="source" defaultValue={filters.source ?? ""}>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option || "All sources"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/55">
              Date posted
              <select className={`${fieldClass} mt-1 font-normal normal-case tracking-normal`} name="posted" defaultValue={posted}>
                {POSTED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        {!hasSearch ? (
          <div className="mt-6 rounded-lg border border-dashed border-line bg-white/70 p-8 text-center">
            <p className="text-lg font-semibold text-ink">Start with a search</p>
            <p className="mt-2 text-sm text-ink/65">Enter a job title, skill, or city, then click Search.</p>
          </div>
        ) : (
          <>
            {broadened ? (
              <p className="mt-6 rounded-md border border-pine/25 bg-pine/5 px-4 py-3 text-sm text-ink/75">
                No jobs matched all your search terms — showing jobs that match <strong>any</strong> of them instead.
              </p>
            ) : null}
            <DiscoverSearchResults
              initialMatches={matches}
              initialTotal={total}
            liveApiQuery={liveApiQuery}
            liveEnabled={page === 1 && Boolean(liveApiQuery)}
              signedIn={Boolean(user)}
              lang={lang}
              pageCount={pageCount}
              page={page}
            />
          </>
        )}

        {hasSearch && pageCount > 1 ? (
          <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
            {page > 1 ? (
              <a className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-pine" href={pageLink(page - 1)}>
                <ChevronLeft size={16} /> Previous
              </a>
            ) : (
              <span />
            )}
            <span className="text-sm font-semibold text-ink/55">
              {(page - 1) * DISCOVER_PAGE_SIZE + 1}–{Math.min(page * DISCOVER_PAGE_SIZE, total)} of {total}
            </span>
            {page < pageCount ? (
              <a className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-pine" href={pageLink(page + 1)}>
                Next <ChevronRight size={16} />
              </a>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}
