import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "../../../../lib/supabase/server";
import { getProfile } from "../../../../lib/profile";
import { getAllMatchesForExport } from "../../../../lib/jobs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const [profile, matches] = await Promise.all([getProfile(supabase, user.id), getAllMatchesForExport(supabase, user.id)]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, userId: user.id, createdAt: user.created_at },
    profile,
    matches
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=jobscout-data-export.json"
    }
  });
}
