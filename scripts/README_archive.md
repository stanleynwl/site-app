# Photo archive

Keeps SiteApp under Supabase's free 1 GB storage by moving **every** photo **file**
to your PC. It only deletes photo *files* from Storage — delivery/report records and
photo metadata all stay in Supabase (archived photos are just flagged `archived_at`
and stop showing in the app). The metadata rows stay until you delete them yourself.

- **What it does:** downloads **all live photos** to your archive folder (mirroring
  `photos/{YYYY-MM}/...`), verifies each file, **saves the full metadata offline**,
  then deletes the file from Supabase Storage and marks the row archived.
- **Full metadata, saved offline too:** next to every photo it writes a sidecar
  `<file>.json` containing the complete photo row **and** its delivery record
  (supplier, material, project, quantities, DO#, issue, note). It also writes a
  per-run manifest. So your local archive is self-contained — even if you later
  delete the Supabase metadata rows, the offline copy still has every detail. The
  script itself **never deletes metadata** from Supabase.
- **No age grace period:** each run clears *every* photo from Storage, so the app
  only shows photos captured since the previous run. The full-res files live in
  your local archive + manifest. If you need recent delivery photos to stay visible
  in the app longer, run the archive *less* often (or process those deliveries in
  the office before the next run).
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
Run this once in **PowerShell** to create the task (every 2 weeks, **Monday 10 PM**,
with catch-up if the PC was off):

```powershell
$action   = New-ScheduledTaskAction -Execute "node" -Argument "scripts\archive-photos.mjs" -WorkingDirectory "D:\dev\site-app"
$trigger  = New-ScheduledTaskTrigger -Weekly -WeeksInterval 2 -DaysOfWeek Monday -At 10pm
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName "SiteApp Photo Archive" -Action $action -Trigger $trigger -Settings $settings -Description "Archive all SiteApp photos off Supabase every 2 weeks"
```

If the task already exists and you only want to change the time/day:

```powershell
$trigger  = New-ScheduledTaskTrigger -Weekly -WeeksInterval 2 -DaysOfWeek Monday -At 10pm
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Set-ScheduledTask -TaskName "SiteApp Photo Archive" -Trigger $trigger -Settings $settings
```

- Runs every 2 weeks, **Monday 10 PM**. `-StartWhenAvailable` means if the PC is off
  at that time, Windows runs it automatically the next time you boot — so a missed
  slot just runs late, never skipped.
- Check the schedule any time:
  ```powershell
  Get-ScheduledTask -TaskName "SiteApp Photo Archive" | Get-ScheduledTaskInfo | Select-Object NextRunTime, LastRunTime, LastTaskResult
  ```
- The archived files land in your archive folder. **Back that folder up** to an
  external drive or cloud (Google Drive / OneDrive) per the storage strategy.

## If you ever outgrow this
Switch photo storage to Cloudflare R2 (10 GB free, zero egress) — documented as the
fallback in `docs/STATUS_ADDENDUM.md`. The archive script becomes optional then.
