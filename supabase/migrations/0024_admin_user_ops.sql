-- SiteApp — admin user operations WITHOUT the service-role key.
-- Editing another user's username/password or deleting them needs to touch the
-- auth schema, which the web app's anon/authenticated roles can't do. Instead we
-- expose SECURITY DEFINER functions (run as the owner, which can write auth) that
-- each verify the caller is an admin via current_user_is_admin(). The web app
-- calls them with supabase.rpc(...) as the logged-in admin. No service key.
--
-- search_path includes `extensions` so pgcrypto's crypt()/gen_salt() resolve
-- (Supabase installs pgcrypto in the extensions schema).

-- Delete a user (admin only). Cascades to profiles + all their data via FKs.
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  if target = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;
  delete from auth.users where id = target;
end;
$$;

-- Set a user's password (admin only). Stores a bcrypt hash GoTrue can verify
-- (cost 10, matching GoTrue's default).
create or replace function public.admin_set_password(target uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  if length(new_password) < 6 then
    raise exception 'password too short';
  end if;
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = target;
end;
$$;

-- Change a user's login username (admin only). Rewrites the synthetic email
-- everywhere (auth.users + auth.identities) and profiles.username.
create or replace function public.admin_set_username(target uuid, new_username text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uname text := lower(trim(new_username));
  new_email text := lower(trim(new_username)) || '@siteapp.app';
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  if uname !~ '^[a-z0-9._-]{3,}$' then
    raise exception 'invalid username';
  end if;
  if exists (select 1 from public.profiles where username = uname and id <> target) then
    raise exception 'username taken';
  end if;

  update auth.users
    set email = new_email, updated_at = now()
    where id = target;
  update auth.identities
    set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(new_email))
    where user_id = target and provider = 'email';
  update auth.identities
    set provider_id = new_email
    where user_id = target and provider = 'email';
  update public.profiles set username = uname where id = target;
end;
$$;

-- Grants (explicit; complements the default privileges set in 0004). The
-- functions self-check admin, so a non-admin caller just gets 'not authorized'.
grant all privileges on all functions in schema public
  to anon, authenticated, service_role;
