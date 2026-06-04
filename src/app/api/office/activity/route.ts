import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/dal";
import { getRecentActivity } from "@/lib/data/activity";

export const dynamic = "force-dynamic";

// Polled by the office NotificationBell for fresh activity. Office-guarded:
// returns the recent who-did-what feed (newest first) as JSON.
export async function GET() {
  const profile = await getProfile();
  if (!profile?.can_office) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entries = await getRecentActivity(30);
  return NextResponse.json(entries, {
    headers: { "Cache-Control": "no-store" },
  });
}
