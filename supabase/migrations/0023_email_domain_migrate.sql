-- SiteApp — move synthetic login emails off the reserved `.local` TLD.
-- Logins use a synthetic email username@<domain>. We used `@siteapp.local`, but
-- Supabase's public signup (used by the in-app Add User) rejects reserved TLDs
-- ("Email address is invalid"). Switch the app domain to `@siteapp.app` and
-- migrate existing auth users to match so their login keeps working.
--
-- Runs against the auth schema — apply in the Supabase SQL editor (owner privs).
-- Idempotent: only touches rows still on @siteapp.local. usernames (profiles)
-- are the email local-part and are unchanged.

-- 1) auth.users.email — what password sign-in resolves against.
update auth.users
set email = regexp_replace(email, '@siteapp\.local$', '@siteapp.app')
where email like '%@siteapp.local';

-- 2) auth.identities email-provider data (kept in sync; belt and suspenders).
update auth.identities
set identity_data = jsonb_set(
  identity_data,
  '{email}',
  to_jsonb(regexp_replace(identity_data->>'email', '@siteapp\.local$', '@siteapp.app'))
)
where identity_data->>'email' like '%@siteapp.local';

-- 3) Newer Supabase stores the email as identities.provider_id for provider
--    'email'. Update it too when the column/rows exist.
update auth.identities
set provider_id = regexp_replace(provider_id, '@siteapp\.local$', '@siteapp.app')
where provider = 'email' and provider_id like '%@siteapp.local';
