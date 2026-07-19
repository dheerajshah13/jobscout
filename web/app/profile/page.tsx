import { Download, FileText, Trash2, UploadCloud } from "lucide-react";
import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ProfileForm } from "../../components/profile-form";
import { signOut } from "../login/actions";
import { deleteAccount } from "./actions";
import { uploadResume } from "./resume-actions";
import { getCurrentUser, createSupabaseServerClient } from "../../lib/supabase/server";
import { getCvMeta, getProfile } from "../../lib/profile";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfile(supabase, user.id);
  const cv = await getCvMeta(supabase, user.id);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-ink">Profile & settings</h1>
            <p className="mt-2 text-sm text-ink/65">{user.email}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-md border border-line bg-white px-4 py-2 font-semibold text-ink" type="submit">
              Sign out
            </button>
          </form>
        </div>

        {params.message ? (
          <div className="mt-6 rounded-md border border-line bg-white px-4 py-3 text-sm text-ink shadow-soft">
            {params.message}
          </div>
        ) : null}

        <section className="mt-8 rounded-lg border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <FileText size={20} />
            Resume
          </h2>
          <p className="mt-2 text-sm text-ink/65">
            Upload a PDF, DOCX, or TXT resume to prefill your skills, target titles, and seniority instead of typing
            them by hand. You can still edit everything afterward — locations and salary floor aren't inferred from a
            resume, add those yourself below.
          </p>

          {cv ? (
            <div className="mt-4 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink">
              <p className="font-semibold">{cv.originalName}</p>
              <p className="mt-1 text-ink/60">Uploaded {new Date(cv.uploadedAt).toLocaleString("de-DE")}</p>
              {cv.parseSummary ? <p className="mt-2 text-ink/75">{cv.parseSummary}</p> : null}
            </div>
          ) : null}

          <form action={uploadResume} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              name="resume"
              accept=".pdf,.docx,.txt"
              required
              className="block w-full flex-1 rounded-md border border-line px-3 py-2.5 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-pine px-4 py-2.5 font-semibold text-white"
            >
              <UploadCloud size={18} />
              {cv ? "Replace" : "Upload"}
            </button>
          </form>
        </section>

        <h2 className="mt-8 text-xl font-semibold text-ink">Matching profile</h2>
        {!profile ? (
          <p className="mt-2 text-sm text-ink/65">
            You haven't completed onboarding yet — fill this in (or upload a resume above) to get a personalized feed
            instead of the demo preview.
          </p>
        ) : null}
        <ProfileForm profile={profile} next="/profile" submitLabel="Save profile" />

        <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-ink">GDPR controls</h2>
          <p className="mt-2 text-sm text-ink/65">
            Export everything we hold about you as JSON, or permanently delete your account. Deletion removes your
            profile and match history immediately and cannot be undone.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-semibold text-ink hover:bg-paper"
              href="/api/account/export"
            >
              <Download size={18} />
              Export data
            </a>
            <form action={deleteAccount}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-coral px-4 py-2 font-semibold text-white hover:bg-coral/90"
              >
                <Trash2 size={18} />
                Delete account
              </button>
            </form>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
