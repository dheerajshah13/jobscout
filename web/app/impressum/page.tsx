import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata = { title: "Impressum - JobScout" };

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="text-3xl font-bold text-ink">Impressum</h1>
        <div className="mt-6 space-y-4 rounded-lg border border-line bg-white p-6 text-sm leading-7 text-ink/80 shadow-soft">
          <p className="rounded-md border border-dashed border-coral/60 bg-coral/5 p-4 text-coral">
            Placeholder — German law (§5 TMG) requires a provider identification page before public launch. Replace the
            fields below with your real legal entity details.
          </p>
          <p>
            <strong>Provider:</strong> [Legal name of operator]
            <br />
            [Street address]
            <br />
            [Postal code, city, Germany]
          </p>
          <p>
            <strong>Contact:</strong> [Email address] · [Phone number, optional]
          </p>
          <p>
            <strong>Represented by:</strong> [Managing director / owner name]
          </p>
          <p>
            <strong>Register entry:</strong> [Commercial register, if applicable — register court, registration number]
          </p>
          <p>
            <strong>VAT ID:</strong> [VAT identification number, if applicable]
          </p>
          <p>
            <strong>Responsible for content (§ 18 Abs. 2 MStV):</strong> [Name, address as above]
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
