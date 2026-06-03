import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { Landing } from "@/components/marketing/landing";

// Public front door. Logged-in users are routed to the area they can access
// (office/admin → office console, supervisor → site capture). Everyone else
// sees the marketing landing — the sellable first impression of SiteApp.
export default async function Home() {
  const profile = await getProfile();
  if (profile) redirect(profile.can_office ? "/office" : "/app");
  return <Landing />;
}
