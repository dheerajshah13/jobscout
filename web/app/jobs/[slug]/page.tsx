import { Metadata } from "next";
import { JobCard } from "../../../components/job-card";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";
import { getFeed } from "../../../lib/jobs";
import { createSupabaseServerClient, getCurrentUser } from "../../../lib/supabase/server";
import { getLanguage } from "../../actions/language";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "React Developer Jobs Berlin - JobScout",
  description: "Fresh React Developer jobs in Berlin, ranked by fit."
};

export default async function SeoJobsPage() {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const lang = await getLanguage();
  const { matches } = await getFeed(supabase, user?.id ?? null, 30);
  const currentPath = "/jobs/react-developer-berlin";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <h1 className="text-4xl font-bold text-ink">React Developer Jobs Berlin</h1>
        <p className="mt-3 max-w-2xl text-ink/70">
          Seed programmatic SEO page for a role and city segment. Thin pages should be marked noindex until enough
          active jobs exist.
        </p>
        <div className="mt-8 space-y-4">
          {matches.length ? (
            matches.map((match) => (
              <JobCard key={match.job.id} {...match} signedIn={Boolean(user)} currentPath={currentPath} lang={lang} />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-white/70 p-8 text-center text-ink/65">
              No active listings for this segment yet.
            </p>
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
