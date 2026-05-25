-- SiteApp — grant table privileges to Supabase API roles.
-- Root cause of the post-login redirect loop: the `authenticated` role had no
-- table-level privileges on the public schema, so every authenticated query
-- failed with "permission denied for table ...". RLS restricts *rows*; these
-- GRANTs provide the baseline table access RLS then filters. This matches
-- Supabase's standard default-privilege setup for the public schema.
-- Additive and idempotent — safe to run repeatedly.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
grant all privileges on all functions in schema public
  to anon, authenticated, service_role;

-- Ensure future tables/sequences/functions are auto-granted too.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
