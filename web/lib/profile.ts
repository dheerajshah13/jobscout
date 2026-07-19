import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@jobscout/core";

type ProfileRow = {
  user_id: string;
  skills: string[] | null;
  target_titles: string[] | null;
  locations: string[] | null;
  remote_pref: string | null;
  salary_floor: number | null;
  seniority: string | null;
  alert_threshold: number;
  email_frequency: string;
};

export type ProfileInput = {
  skills: string[];
  targetTitles: string[];
  locations: string[];
  remotePref: Profile["remotePref"];
  salaryFloor: number | null;
  seniority: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    skills: row.skills ?? [],
    targetTitles: row.target_titles ?? [],
    locations: row.locations ?? [],
    remotePref: (row.remote_pref as Profile["remotePref"]) ?? "none",
    salaryFloor: row.salary_floor,
    seniority: row.seniority ?? undefined
  };
}

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,skills,target_titles,locations,remote_pref,salary_floor,seniority,alert_threshold,email_frequency")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as ProfileRow);
}

export type CvMeta = {
  storagePath: string;
  originalName: string;
  uploadedAt: string;
  parseSummary: string | null;
};

export async function getCvMeta(supabase: SupabaseClient, userId: string): Promise<CvMeta | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("cv_storage_path,cv_original_name,cv_uploaded_at,cv_parse_summary")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !data.cv_storage_path) return null;

  return {
    storagePath: data.cv_storage_path,
    originalName: data.cv_original_name ?? "resume",
    uploadedAt: data.cv_uploaded_at,
    parseSummary: data.cv_parse_summary
  };
}

export async function upsertProfile(supabase: SupabaseClient, userId: string, input: ProfileInput): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      skills: input.skills,
      target_titles: input.targetTitles,
      locations: input.locations,
      remote_pref: input.remotePref,
      salary_floor: input.salaryFloor,
      seniority: input.seniority || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

/** Splits a comma-separated form field into a clean string array. */
export function parseListField(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
