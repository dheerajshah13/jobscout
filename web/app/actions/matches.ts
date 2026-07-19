"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";

/**
 * Toggles a match's status between "new" and the target status (save/hide).
 * Clicking the same action twice undoes it. Requires the
 * "Users can insert own matches" RLS policy from
 * supabase/migrations/0002_matches_self_service.sql.
 */
export async function setMatchStatus(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const score = Number(formData.get("score") ?? 0);
  const scoreBreakdown = JSON.parse(String(formData.get("scoreBreakdown") ?? "{}"));
  const reason = String(formData.get("reason") ?? "");
  const status = String(formData.get("status") ?? "new");
  const redirectPath = String(formData.get("redirectPath") ?? "/");

  if (!jobId) return;

  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("matches").upsert(
    {
      user_id: user.id,
      job_id: jobId,
      score,
      score_breakdown: scoreBreakdown,
      reason,
      status
    },
    { onConflict: "user_id,job_id" }
  );

  revalidatePath(redirectPath);
  revalidatePath("/saved");
}
