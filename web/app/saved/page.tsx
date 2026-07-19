import { redirect } from "next/navigation";
import { Bookmark, CheckCircle2, EyeOff } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { JobCard } from "../../components/job-card";
import { getSavedAndHidden } from "../../lib/jobs";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { getLanguage } from "../actions/language";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/saved");
  }

  const supabase = await createSupabaseServerClient();
  const lang = await getLanguage();
  const all = await getSavedAndHidden(supabase, user.id);
  const saved = all.filter((match) => match.status === "saved");
  const applied = all.filter((match) => match.status === "applied");
  const hidden = all.filter((match) => match.status === "hidden");

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <h1 className="text-4xl font-bold text-ink">Your job pipeline</h1>
        <p className="mt-2 text-ink/70">Track everything you've saved, applied to, or hidden from your feed.</p>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Bookmark size={18} />
            Saved ({saved.length})
          </h2>
          <div className="mt-4 space-y-4">
            {saved.length ? (
              saved.map((match) => <JobCard key={match.job.id} {...match} signedIn currentPath="/saved" lang={lang} />)
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-white/70 p-6 text-center text-sm text-ink/60">
                Nothing saved yet — tap the bookmark icon on any job card.
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <CheckCircle2 size={18} />
            Applied ({applied.length})
          </h2>
          <div className="mt-4 space-y-4">
            {applied.length ? (
              applied.map((match) => <JobCard key={match.job.id} {...match} signedIn currentPath="/saved" lang={lang} />)
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-white/70 p-6 text-center text-sm text-ink/60">
                No applications tracked yet — tap the check icon on a job once you've applied.
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <EyeOff size={18} />
            Hidden ({hidden.length})
          </h2>
          <div className="mt-4 space-y-4">
            {hidden.length ? (
              hidden.map((match) => <JobCard key={match.job.id} {...match} signedIn currentPath="/saved" lang={lang} />)
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-white/70 p-6 text-center text-sm text-ink/60">
                Nothing hidden — hidden jobs stay out of your main feed but you can unhide them here anytime.
              </p>
            )}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
