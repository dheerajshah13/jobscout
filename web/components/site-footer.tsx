export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} JobScout. Ranked German job listings, aggregated from multiple public sources.</p>
        <div className="flex flex-wrap gap-4">
          <a className="hover:text-ink" href="/impressum">
            Impressum
          </a>
          <a className="hover:text-ink" href="/privacy">
            Privacy
          </a>
          <a className="hover:text-ink" href="/terms">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
