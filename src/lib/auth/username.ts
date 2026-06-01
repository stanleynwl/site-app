// Supabase Auth is email/password based. SiteApp users log in with a username
// only, so we map each username to a synthetic email under this domain. The real
// username is also stored in profiles.username for display/lookup.
//
// NOTE: must be a REAL TLD. Supabase's public signup (used by in-app Add User)
// rejects reserved TLDs like `.local` ("Email address is invalid"). We use
// `siteapp.app`; existing users were migrated off `@siteapp.local` in 0023.
export const USERNAME_EMAIL_DOMAIN = "siteapp.app";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
