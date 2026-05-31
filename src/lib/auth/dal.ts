import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type UserRole = "supervisor" | "office" | "pm";

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  locale: string;
};

export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, company_id, locale")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

// Use in protected pages/actions: returns the profile or redirects to /login.
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

// Office console is for office + pm only. Supervisors are bounced to the site
// app (they can only access /app). Use in the office layout / office pages.
export async function requireOfficeProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "supervisor") redirect("/app");
  return profile;
}
