# Photo auto-archive

Keeps SiteApp under Supabase's free 1 GB storage by moving old photo **files** to
your PC. It only touches photo files — delivery/report records and photo metadata
all stay in Supabase (archived photos are just flagged `archived_at` and stop
showing in the app).

- **What it does:** finds photos older than **14 days**, downloads them to your
  archive folder (mirroring `photos/{YYYY-MM}/...`), verifies each file, then
  deletes the file from Supabase Storage and marks the row archived. Writes a JSON
  manifest of everything archived.
- **Cadence:** run it **manually any time**, and/or schedule it **every 2 weeks**.

## One-time setup

1. **Apply migration** `supabase/migrations/0008_photos_archived.sql` in the Supabase SQL Editor.
2. **Add your service-role key** to `.env.local` (Supabase → Settings → API → `service_role` secret — keep it secret, it's already gitignored):
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
   ```
3. **(Optional) Pick where archives are saved.** Default is `..\siteapp-archive`
   (i.e. `D:\dev\siteapp-archive`). To use another drive, add to `.env.local`:
   ```
   SITEAPP_ARCHIVE_DIR=E:\SiteAppArchive
   ```

## Run it manually
```
cd D:\dev\site-app
npm run archive
```

## Schedule it every 2 weeks (Windows Task Scheduler)
Run this once in **PowerShell** (adjust the node path if different):

```powershell
$action  = New-ScheduledTaskAction -Execute "node" -Argument "scripts\archive-photos.mjs" -WorkingDirectory "D:\dev\site-app"
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 2 -DaysOfWeek Sunday -At 2am
Register-ScheduledTask -TaskName "SiteApp Photo Archive" -Action $action -Trigger $trigger -Description "Archive old SiteApp photos off Supabase every 2 weeks"
```

- Runs every 2 weeks, Sunday 2 AM. If the PC is off, Windows runs it at next boot
  (enable "Run task as soon as possible after a scheduled start is missed" in the
  task's Settings if you want that).
- The archived files land in your archive folder. **Back that folder up** to an
  external drive or cloud (Google Drive / OneDrive) per the storage strategy.

## If you ever outgrow this
Switch photo storage to Cloudflare R2 (10 GB free, zero egress) — documented as the
fallback in `docs/STATUS_ADDENDUM.md`. The archive script becomes optional then.
