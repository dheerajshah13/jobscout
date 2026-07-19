import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata = { title: "Privacy policy - JobScout" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="text-3xl font-bold text-ink">Privacy policy</h1>
        <div className="mt-6 space-y-5 rounded-lg border border-line bg-white p-6 text-sm leading-7 text-ink/80 shadow-soft">
          <p className="rounded-md border border-dashed border-coral/60 bg-coral/5 p-4 text-coral">
            Placeholder — have this reviewed by someone qualified in German/EU data protection law before public launch.
            It should reflect exactly what the product does once CV upload, email alerts, and analytics ship.
          </p>
          <section>
            <h2 className="text-lg font-semibold text-ink">What we collect</h2>
            <p className="mt-2">
              Account email and password (via Supabase Auth), your matching profile (skills, target titles, locations,
              salary floor), and your interactions with job listings (saved, hidden, applied). If you upload a CV in a
              future version, that file and any extracted skills are also stored.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Why we collect it</h2>
            <p className="mt-2">
              Solely to rank job listings against your profile and, if enabled, send you match-alert emails. We do not
              sell personal data or share it with employers or third parties beyond the infrastructure providers needed
              to run the service (Supabase for hosting/auth, Anthropic for generating match explanations from job text).
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Your rights</h2>
            <p className="mt-2">
              You can export your data or delete your account at any time from the Profile page. Deletion removes your
              profile, matches, and (if applicable) uploaded CV files immediately.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Data location</h2>
            <p className="mt-2">Data is stored in an EU Supabase region. Job listing data itself is sourced from public job board APIs and does not identify job seekers.</p>
          </section>
          <p>Contact: [privacy contact email]</p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
