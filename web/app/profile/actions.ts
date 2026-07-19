"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

/**
 * GDPR account deletion. Deletes the auth user via the admin API; `profiles`
 * and `matches` rows cascade automatically via their `on delete cascade`
 * foreign keys to auth.users (see supabase/migrations/0001_initial_schema.sql).
 */
export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    redirect(`/profile?message=${encodeURIComponent("Could not delete account: " + error.message)}`);
  }

  redirect("/?message=" + encodeURIComponent("Your account and data have been deleted."));
}
