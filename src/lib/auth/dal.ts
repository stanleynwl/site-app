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
  is_admin: boolean;
  can_office: boolean;
  can_site: boolean;
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
    .select(
      "id, username, full_name, role, company_id, locale, is_admin, can_office, can_site",
    )
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

// Office console requires office access. Users without it are bounced to the
// site app. Use in the office layout / office pages.
export async function requireOfficeProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.can_office) redirect("/app");
  return profile;
}

// Site app requires site access. Office-only users are bounced to the office.
export async function requireSiteProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.can_site) redirect("/office");
  return profile;
}

// User management is admin-only. Non-admins are bounced to the office home.
export async function requireAdminProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/office");
  return profile;
}

// All profiles (admin only — RLS profiles_select_admin enforces; call from an
// admin-gated page). For the user-management screen.
export async function listProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, role, company_id, locale, is_admin, can_office, can_site",
    )
    .order("username", { ascending: true });
  return (data as Profile[] | null) ?? [];
}
