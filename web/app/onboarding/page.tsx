import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ProfileForm } from "../../components/profile-form";
import { getCurrentUser, createSupabaseServerClient } from "../../lib/supabase/server";
import { getProfile } from "../../lib/profile";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ message?: string; next?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfile(supabase, user.id);
  const next = params.next ?? "/";

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="text-4xl font-bold text-ink">{profile ? "Update your matching profile" : "Build your first ranked feed"}</h1>
        <p className="mt-3 text-ink/70">
          Signed in as {user.email}. Scoring is transparent: 40% skills, 20% title, 15% location, 15% salary, 10%
          posted time — you'll see the breakdown on every match.
        </p>

        <p className="mt-6 rounded-md border border-dashed border-line bg-white/70 px-4 py-3 text-sm text-ink/70">
          Have a resume handy? <a className="font-semibold text-pine" href="/profile">Upload it on your profile page</a>{" "}
          to prefill skills, target titles, and seniority automatically instead of typing them below.
        </p>

        <ProfileForm profile={profile} next={next} submitLabel="See ranked matches" message={params.message} />
      </div>
      <SiteFooter />
    </main>
  );
}
