-- #8 Web Push — store each device's push subscription so the office mirror
-- process (which already polls activity) can send VAPID web-push notifications
-- that work with the tab closed (Android; iOS 16.4+ installed-PWA only).
--
-- The web app only WRITES subscriptions here (on "Enable alerts"); it never
-- sends — sending is done by the local PM2 mirror with the PRIVATE VAPID key,
-- which must NEVER live in the web app (same rule as the service-role key).
--
-- Pure storage + own-row RLS — no column the read layer selects, so no
-- apply-before-deploy risk: the feature simply stays inert until applied AND a
-- NEXT_PUBLIC_VAPID_PUBLIC_KEY is configured.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions.
drop policy if exists "push_sub_select_own" on public.push_subscriptions;
create policy "push_sub_select_own" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
create policy "push_sub_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_sub_update_own" on public.push_subscriptions;
create policy "push_sub_update_own" on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_delete_own" on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- Grants (explicit; complements the default privileges set in 0004) -----------
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
