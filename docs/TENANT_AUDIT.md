# SiteApp — Single-Tenant Assumptions Audit

**Date:** 2026-06-10  
**Status:** Documentation only. No schema changes. Actual multi-tenancy is unscheduled.

This document inventories assumptions baked into the current schema and code that would need to be addressed before a multi-tenant rebuild. The goal is to avoid locking in further blockers.

---

## 1. Project membership: everyone-sees-everything

**Location:** Migration `0025`, `supabase/migrations/0025_everyone_membership.sql`

Two Postgres triggers ensure every user is a member of every project, and every new project auto-adds all users:

- `add_all_members_to_project` — fires on `projects INSERT`; bulk-inserts `(project_id, user_id)` for every profile.
- `add_member_to_all_projects` — fires on `profiles INSERT`; bulk-inserts `(project_id, user_id)` for every project.

**Multi-tenant impact:** In a multi-tenant model, each organisation owns its own projects and users. The triggers would need to be replaced with org-scoped versions (backfill members within the org only). The `project_members` table has no `organisation_id` column.

---

## 2. Shared catalog: suppliers and materials

**Location:** `src/lib/data/catalog.ts`, tables `suppliers` and `materials`

Suppliers and materials are global — there is no `project_id` or `organisation_id` on these tables. Any office user sees the full catalog regardless of project.

**Multi-tenant impact:** Each org needs its own supplier/material list. The catalog tables need an `organisation_id` FK and RLS scoped accordingly.

---

## 3. Synthetic email domain `siteapp.app`

**Location:** `src/lib/auth/username.ts` (`USERNAME_EMAIL_DOMAIN = "siteapp.app"`)

All users are created with synthetic emails of the form `<username>@siteapp.app`. This domain is used as a namespace to distinguish SiteApp users from external Supabase Auth users and to keep Supabase's email-provider happy.

**Multi-tenant impact:**
- In a shared-auth multi-tenant model, username collisions across orgs would map to the same synthetic email, breaking the uniqueness constraint.
- Options: prefix with org slug (`<username>@<orgslug>.siteapp.app`), or use UUID-based synthetic emails, or switch to a custom auth provider.

---

## 4. RLS without org-scoping

**Location:** All RLS policies in migrations `0001`–`0025`

Current RLS policies gate access on `project_members(project_id, user_id)` (is the logged-in user a member of this project?). There is no organisation-level boundary.

**Multi-tenant impact:** An `organisations` table and an `organisation_members` table would be needed. Every RLS policy would need an additional `organisation_id` check. This is a significant schema revision.

Policies most affected:
- `daily_reports` / `manpower_entries` / `machinery_entries` — currently any project member can read/write any report.
- `purchase_requests` / `deliveries` / `photos` — same.
- `suppliers` / `materials` — fully unscoped (no project_id, no org).

---

## 5. Admin role: single global admin flag

**Location:** `profiles.is_admin`, migration `0022`

`is_admin` is a boolean on `profiles` — one admin for the whole instance. There is no per-organisation admin concept.

**Multi-tenant impact:** Multi-tenancy needs an `organisation_admin` role that scopes admin actions (create/delete/reset users) to a single org. The security-definer RPCs in migration `0024` (`admin_set_username`, `admin_set_password`, `admin_delete_user`) check `current_user_is_admin()` globally — they'd need org-awareness.

---

## 6. Storage bucket: single shared `site-photos` bucket

**Location:** `supabase/storage_setup.sql`

All photos for all projects live under `photos/{YYYY-MM}/{project_id}/{uuid}.jpg` in one bucket. Storage RLS gates download on project membership.

**Multi-tenant impact:** Paths would need an org prefix (`photos/{org_id}/{YYYY-MM}/…`) or separate buckets per org. The archive script (`scripts/archive-photos.mjs`) would need a similar adjustment.

---

## 7. Activity log: cross-project, cross-user

**Location:** `src/lib/data/activity.ts` (if present), `src/app/office/activity/page.tsx`

The activity log queries all recent activity without an org filter.

**Multi-tenant impact:** Activity should be scoped to the org. An `organisation_id` column on the activity table or a join through `project_members` would be needed.

---

## 8. Hardcoded references

| Location | Value | Note |
|---|---|---|
| `src/lib/auth/username.ts` | `USERNAME_EMAIL_DOMAIN = "siteapp.app"` | Org-prefix required in multi-tenant |
| `src/i18n/locales.ts` | Locale list (`en`, `ms`, `zh`) | Fine — not a tenant concern |
| `scripts/archive-photos.mjs` | Storage path prefix `photos/` | Needs org-prefix in multi-tenant |
| `supabase/storage_setup.sql` | Bucket name `site-photos` | One bucket per org or shared with path prefix |

---

## Summary: key schema changes for multi-tenancy

1. Add `organisations` + `organisation_members` tables.
2. Add `organisation_id` FK to `projects`, `suppliers`, `materials`, `profiles`.
3. Remove or replace the everyone-sees-everything triggers (`0025`).
4. Rewrite all RLS policies to add an org-membership check.
5. Scope `is_admin` to per-org; update security-definer RPCs.
6. Change synthetic email scheme to avoid cross-org collisions.
7. Prefix storage paths with `{org_id}/`.

**Estimated effort:** Several days of schema work + substantial RLS rewrite. Do not attempt until the v2 PowerSync rebuild timeline is confirmed.
