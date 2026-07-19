"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Profile } from "@jobscout/core";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { parseListField, upsertProfile } from "../../lib/profile";

export async function saveProfile(formData: FormData) {
  const user = await getCurrentUser();
  const next = String(formData.get("next") ?? "/");

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const skills = parseListField(formData.get("skills"));
  const targetTitles = parseListField(formData.get("targetTitles"));
  const locations = parseListField(formData.get("locations"));
  const remotePref = String(formData.get("remotePref") ?? "none") as Profile["remotePref"];
  const salaryFloorRaw = String(formData.get("salaryFloor") ?? "").trim();
  const salaryFloor = salaryFloorRaw ? Number(salaryFloorRaw) : null;
  const seniority = String(formData.get("seniority") ?? "");

  if (!skills.length || !targetTitles.length || !locations.length) {
    redirect(
      `/onboarding?message=${encodeURIComponent("Add at least one skill, target title, and location.")}&next=${encodeURIComponent(next)}`
    );
  }

  const supabase = await createSupabaseServerClient();
  await upsertProfile(supabase, user.id, { skills, targetTitles, locations, remotePref, salaryFloor, seniority });

  revalidatePath("/");
  revalidatePath("/profile");
  redirect(next);
}
