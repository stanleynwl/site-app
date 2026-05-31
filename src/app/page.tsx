import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";

// Role-aware landing. The PWA manifest's start_url points here (`/`), so the
// installed home-screen icon opens the right home per user: office/pm → office
// console, supervisor → site capture. (A fixed start_url like /app sent everyone
// to the site side regardless of where they installed from.)
export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "supervisor" ? "/app" : "/office");
}
