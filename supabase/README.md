# Supabase setup

## 1. Create the project
1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. Copy `.env.example` to `.env.local` in the repo root and paste them in.

## 2. Run the migrations
Either option works:

**SQL editor (quickest):** open the Supabase dashboard → SQL Editor, paste the
contents of `migrations/0001_init.sql`, and run it.

**Supabase CLI:**
```bash
supabase link --project-ref <your-ref>
supabase db push
```

## 3. Configure auth for username/password
Users sign in with a **username + password**, not email. Under the hood each
username maps to a synthetic email `username@siteapp.local` (see
`src/lib/auth/username.ts`).

In **Authentication → Providers → Email**:
- Keep the **Email** provider enabled (it backs password auth).
- **Disable "Confirm email"** — the synthetic addresses can't receive mail.

## 4. Create users
Since addresses are synthetic, create accounts yourself (no public sign-up):
**Authentication → Users → Add user** →
- Email: `<username>@siteapp.local` (e.g. `ali@siteapp.local`)
- Password: set one and tick **Auto Confirm User**

The signup trigger fills `profiles.username` from the email local-part
(`ali`). The user then logs in with just `ali` + password.

## Roles
`profiles.role` is one of `supervisor | office | pm`. New users default to
`supervisor`; promote office staff / PMs by editing the row in the dashboard
(role-based UI gating comes in later phases).
