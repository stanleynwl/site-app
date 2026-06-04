import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/dal";
import { getRecentActivity, REQUEST_OFFICE_ACTIONS } from "@/lib/data/activity";

export const dynamic = "force-dynamic";

// Polled by the supervisor app's NotificationBell. Returns office actions on
// the user's purchase requests (accepted / ordered / rejected / closed),
// newest first. RLS scopes rows to the caller's projects.
export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entries = await getRecentActivity(30, REQUEST_OFFICE_ACTIONS);
  return NextResponse.json(entries, {
    headers: { "Cache-Control": "no-store" },
  });
}
