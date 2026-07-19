import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata = { title: "Terms of service - JobScout" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="text-3xl font-bold text-ink">Terms of service</h1>
        <div className="mt-6 space-y-5 rounded-lg border border-line bg-white p-6 text-sm leading-7 text-ink/80 shadow-soft">
          <p className="rounded-md border border-dashed border-coral/60 bg-coral/5 p-4 text-coral">
            Placeholder — have real terms drafted before public launch, especially the liability and third-party listing
            disclaimers below.
          </p>
          <section>
            <h2 className="text-lg font-semibold text-ink">What JobScout is</h2>
            <p className="mt-2">
              JobScout aggregates publicly available job listings from third-party sources, deduplicates them, and ranks
              them against a profile you provide. We do not employ, recruit for, or vet any listed employer.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Applying</h2>
            <p className="mt-2">
              All "Apply" buttons link out to the original posting on the source site. We are not a party to your
              application, interview, or employment relationship with any listed company.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">No guarantee of accuracy</h2>
            <p className="mt-2">
              Listings and salary estimates come from external APIs and may be stale, incomplete, or inaccurate. Job
              status ("active" vs "stale" vs "expired") is a best-effort freshness signal, not a guarantee the position
              is still open.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Account</h2>
            <p className="mt-2">You may delete your account and associated data at any time from the Profile page.</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
