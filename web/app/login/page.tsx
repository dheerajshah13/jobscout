import { BriefcaseBusiness } from "lucide-react";
import { signIn, signUp } from "./actions";
import { SiteFooter } from "../../components/site-footer";

type Props = {
  searchParams: Promise<{ message?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next ?? "/onboarding";

  return (
    <main className="min-h-screen bg-paper px-5 py-8">
      <div className="mx-auto max-w-md">
        <a className="text-sm font-semibold text-pine" href="/">
          JobScout
        </a>

        <section className="mt-10 rounded-lg border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-pine p-2 text-white">
              <BriefcaseBusiness size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Sign in</h1>
              <p className="text-sm text-ink/65">Save your profile and get a ranked feed.</p>
            </div>
          </div>

          {params.message ? (
            <div className="mt-5 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink">{params.message}</div>
          ) : null}

          <form className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Email</span>
              <input
                className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">Password</span>
              <input
                className="w-full rounded-md border border-line px-4 py-3 text-ink outline-pine"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button formAction={signIn} className="rounded-md bg-pine px-5 py-3 font-semibold text-white">
                Sign in
              </button>
              <button formAction={signUp} className="rounded-md border border-line px-5 py-3 font-semibold text-ink">
                Create account
              </button>
            </div>
          </form>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
