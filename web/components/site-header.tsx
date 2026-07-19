import { BriefcaseBusiness, Bookmark, Search } from "lucide-react";
import { getCurrentUser } from "../lib/supabase/server";
import { getLanguage, setLanguage } from "../app/actions/language";

const navLinkClass = "rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-white/70";

function LanguageToggle({ current }: { current: "en" | "de" }) {
  return (
    <div className="mr-1 flex overflow-hidden rounded-md border border-line text-xs font-bold">
      {(["en", "de"] as const).map((lang) => (
        <form key={lang} action={setLanguage}>
          <input type="hidden" name="lang" value={lang} />
          <button
            className={`px-2.5 py-1.5 uppercase ${current === lang ? "bg-ink text-white" : "bg-white/80 text-ink/60 hover:text-ink"}`}
            type="submit"
            aria-label={lang === "en" ? "Show job postings in English" : "Stellenanzeigen auf Deutsch anzeigen"}
          >
            {lang}
          </button>
        </form>
      ))}
    </div>
  );
}

export async function SiteHeader({ showLanguageToggle = false }: { showLanguageToggle?: boolean }) {
  const user = await getCurrentUser();
  const lang = await getLanguage();

  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
      <a className="flex items-center gap-2 text-xl font-bold text-ink" href="/">
        <BriefcaseBusiness className="text-pine" size={22} />
        JobScout
      </a>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {showLanguageToggle ? <LanguageToggle current={lang} /> : null}
        {user ? (
          <>
            <a className={navLinkClass} href="/discover">
              <span className="inline-flex items-center gap-1.5">
                <Search size={16} />
                Discover
              </span>
            </a>
            <a className={navLinkClass} href="/saved">
              <span className="inline-flex items-center gap-1.5">
                <Bookmark size={16} />
                Saved
              </span>
            </a>
            <a className={navLinkClass} href="/profile">
              Profile
            </a>
            <a className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/">
              My feed
            </a>
          </>
        ) : (
          <>
            <a className={navLinkClass} href="/discover">
              Discover
            </a>
            <a className={navLinkClass} href="/login">
              Login
            </a>
            <a className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/onboarding">
              Start
            </a>
          </>
        )}
      </div>
    </nav>
  );
}
