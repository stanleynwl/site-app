// SiteApp — archive ALL photos off Supabase Storage to keep under the free tier.
// Downloads every live photo file to a local archive folder, verifies each, writes
// its FULL metadata offline, then deletes only the FILE from Storage and marks the
// photo row `archived_at`. The metadata rows are NEVER deleted by this script — they
// stay in Supabase until you delete them manually on request.
//
// Offline metadata: alongside each photo file it writes a sidecar `<file>.json`
// containing the complete photo row + its delivery record (supplier / material /
// project / quantities / DO# / issue / note). It also writes a per-run manifest of
// everything archived. So the local archive is fully self-contained — if you later
// delete the Supabase metadata rows, the offline copy still has every detail.
//
// GRACE PERIOD: a photo is only archived once it's at least 3 *working* days old,
// counting Mon–Sat as days and NOT counting Sundays. So recent photos stay visible
// in the app (for the office to act on) until they pass the grace; older ones get
// pulled down and cleared from Storage. The full-resolution files + their metadata
// live in your local archive folder.
//
// Run manually:   npm run archive
// Or schedule biweekly via Windows Task Scheduler (see scripts/README_archive.md).
//
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL        (already set)
//   SUPABASE_SERVICE_ROLE_KEY       (Supabase → Settings → API → service_role)
//   SITEAPP_ARCHIVE_DIR             (optional; where to save — default ../siteapp-archive)

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BUCKET = "site-photos";

// Keep a photo this many WORKING days before archiving it. Working days are
// Mon–Sat; Sundays do not count. Dates are evaluated in Malaysia time.
const GRACE_WORKING_DAYS = 3;
const TZ = "Asia/Kuala_Lumpur";

// --- Working-day grace helpers ----------------------------------------------
// "YYYY-MM-DD" for a date, in Malaysia time.
function mytDateStr(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// UTC-midnight Date for a "YYYY-MM-DD" string — safe for day arithmetic + weekday.
function dateFromStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Count working days (Mon–Sat; Sundays excluded) strictly after the photo's
// creation date, up to and including today — both in Malaysia time. A photo taken
// Friday becomes eligible the following Tuesday (Sat, Mon, Tue = 3; Sunday skipped).
function workingDaysSince(createdAtIso, now = new Date()) {
  const cur = dateFromStr(mytDateStr(new Date(createdAtIso)));
  const today = dateFromStr(mytDateStr(now));
  let count = 0;
  while (cur < today) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (cur.getUTCDay() !== 0) count++; // 0 = Sunday → doesn't count as a day
  }
  return count;
}

// --- Load .env.local (tiny parser; no dependency) ---------------------------
async function loadEnv() {
  try {
    const raw = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const archiveDir =
    process.env.SITEAPP_ARCHIVE_DIR || resolve(ROOT, "..", "siteapp-archive");

  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `[archive] grace = ${GRACE_WORKING_DAYS} working days (Mon–Sat; Sundays don't count)`,
  );
  console.log(`[archive] archive folder: ${archiveDir}`);

  // Pull the FULL photo row (every column) so the offline copy is self-contained.
  const { data: allPhotos, error } = await supabase
    .from("photos")
    .select("*")
    .is("archived_at", null);

  if (error) {
    console.error("[archive] query failed:", error.message);
    process.exit(1);
  }
  if (!allPhotos || allPhotos.length === 0) {
    console.log("[archive] no live photos. Done.");
    return;
  }

  // Hold back photos still inside the working-day grace; archive only the rest.
  const photos = allPhotos.filter(
    (p) => workingDaysSince(p.created_at) >= GRACE_WORKING_DAYS,
  );
  const heldBack = allPhotos.length - photos.length;
  console.log(
    `[archive] ${allPhotos.length} live photo(s): ${photos.length} past grace → archiving, ${heldBack} still within grace → kept`,
  );
  if (photos.length === 0) {
    console.log("[archive] nothing past the grace period yet. Done.");
    return;
  }

  // Fetch the full delivery record (with supplier / material / project names) for
  // every photo that belongs to a delivery, so the offline metadata stands on its
  // own even if the Supabase rows are deleted later. Read-only — deletes nothing.
  const deliveryIds = [...new Set(photos.map((p) => p.delivery_id).filter(Boolean))];
  const deliveriesById = {};
  if (deliveryIds.length > 0) {
    const { data: dels, error: dErr } = await supabase
      .from("deliveries")
      .select(
        "*, supplier:suppliers(name), material:materials(name, count_required), project:projects(name, code, location)",
      )
      .in("id", deliveryIds);
    if (dErr) {
      console.error("[archive] delivery metadata query failed:", dErr.message);
      process.exit(1);
    }
    for (const d of dels ?? []) deliveriesById[d.id] = d;
    console.log(
      `[archive] loaded metadata for ${Object.keys(deliveriesById).length} linked delivery(ies)`,
    );
  }

  const manifest = [];
  let archived = 0;
  let bytes = 0;
  let failed = 0;

  for (const p of photos) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(p.storage_path);
      if (dlErr || !blob) {
        console.error(`[archive] download failed ${p.storage_path}: ${dlErr?.message ?? "no data"}`);
        failed++;
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const dest = join(archiveDir, p.storage_path); // mirrors photos/{YYYY-MM}/...
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);

      // Verify before deleting anything.
      const s = await stat(dest);
      if (s.size === 0 || s.size !== buf.length) {
        console.error(`[archive] verify failed ${p.storage_path} (size ${s.size}/${buf.length})`);
        failed++;
        continue;
      }

      // Save the FULL metadata offline as a sidecar JSON next to the photo file —
      // the complete photo row + its delivery record (supplier/material/project/
      // quantities/DO#/issue/note). Written BEFORE we touch Storage so the offline
      // copy is guaranteed to exist first.
      const record = {
        archived_at: new Date().toISOString(),
        photo: p,
        delivery: p.delivery_id ? (deliveriesById[p.delivery_id] ?? null) : null,
        local_file: dest,
        size: s.size,
      };
      await writeFile(`${dest}.json`, JSON.stringify(record, null, 2));

      // Now safe to remove the FILE from Storage + flag the row archived. The row
      // and ALL metadata stay in Supabase — this script never deletes metadata.
      await supabase.storage.from(BUCKET).remove([p.storage_path]);
      await supabase
        .from("photos")
        .update({ archived_at: record.archived_at })
        .eq("id", p.id);

      manifest.push(record);
      archived++;
      bytes += s.size;
    } catch (e) {
      console.error(`[archive] error ${p.storage_path}:`, e?.message ?? e);
      failed++;
    }
  }

  if (manifest.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = join(archiveDir, "_manifests", `archive-${stamp}.json`);
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[archive] manifest: ${manifestPath}`);
  }

  console.log(
    `[archive] done — archived ${archived} photo(s), ${(bytes / 1048576).toFixed(1)} MB freed, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[archive] fatal:", e);
  process.exit(1);
});
