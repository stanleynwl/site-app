// Supabase Auth is email/password based. SiteApp users log in with a username
// only, so we map each username to a synthetic email under a reserved domain.
// The real username is also stored in profiles.username for display/lookup.
export const USERNAME_EMAIL_DOMAIN = "siteapp.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
