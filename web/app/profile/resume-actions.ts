"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { extractResumeText, parseResumeText } from "../../lib/resume";
import { getProfile, upsertProfile } from "../../lib/profile";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fail(message: string): never {
  redirect(`/profile?message=${encodeURIComponent(message)}`);
}

function mergeUnique(existing: string[], additions: string[]): string[] {
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const merged = [...existing];
  for (const item of additions) {
    if (!seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Uploads a resume to Supabase Storage, extracts its text, parses it (Claude
 * API, or the offline fallback in lib/resume.ts), and merges the result into
 * the user's matching profile. Skills are merged (not replaced) so manual
 * edits aren't clobbered; target titles and seniority are only overwritten
 * when the parse actually found something.
 */
export async function uploadResume(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    fail("Choose a PDF, DOCX, or TXT resume first.");
  }
  if (file.size > MAX_FILE_BYTES) {
    fail("That file is too large — 5MB max.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractResumeText(buffer, file.name);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Couldn't read that file.");
  }

  const supabase = await createSupabaseServerClient();
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("cvs").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true
  });

  if (uploadError) {
    fail(`Upload failed: ${uploadError.message}`);
  }

  const parsed = await parseResumeText(text);
  const existingProfile = await getProfile(supabase, user.id);

  await upsertProfile(supabase, user.id, {
    skills: mergeUnique(existingProfile?.skills ?? [], parsed.skills),
    targetTitles: parsed.targetTitles.length ? parsed.targetTitles : (existingProfile?.targetTitles ?? []),
    locations: existingProfile?.locations ?? [],
    remotePref: existingProfile?.remotePref ?? "remote_de",
    salaryFloor: existingProfile?.salaryFloor ?? null,
    seniority: parsed.seniority || existingProfile?.seniority || ""
  });

  await supabase
    .from("profiles")
    .update({
      cv_storage_path: storagePath,
      cv_original_name: file.name,
      cv_uploaded_at: new Date().toISOString(),
      cv_parse_summary: parsed.summary
    })
    .eq("user_id", user.id);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/onboarding");

  const message =
    parsed.source === "claude"
      ? `Resume parsed with Claude — added ${parsed.skills.length} skill(s)${
          parsed.targetTitles.length ? ` and set target titles to ${parsed.targetTitles.join(", ")}` : ""
        }. Check locations and salary floor below, they aren't inferred from a resume.`
      : parsed.summary;

  redirect(`/profile?message=${encodeURIComponent(message)}`);
}
