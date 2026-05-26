// SiteApp — auto-archive old photos off Supabase Storage to keep under the free
// tier. Downloads photo files older than KEEP_DAYS to a local archive folder,
// verifies each, then deletes the file from Storage and marks the photo row
// `archived_at` (the row + all other data stay). Other data is never touched.
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
const KEEP_DAYS = 14;

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

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  console.log(
    `[archive] keep-live ${KEEP_DAYS}d → archiving photos created before ${cutoff}`,
  );
  console.log(`[archive] archive folder: ${archiveDir}`);

  const { data: photos, error } = await supabase
    .from("photos")
    .select("id, storage_path, created_at, delivery_id, taken_at, gps_lat, gps_lng")
    .is("archived_at", null)
    .lt("created_at", cutoff);

  if (error) {
    console.error("[archive] query failed:", error.message);
    process.exit(1);
  }
  if (!photos || photos.length === 0) {
    console.log("[archive] nothing to archive. Done.");
    return;
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

      // Safe to remove from Storage + mark the row archived (keep the row).
      await supabase.storage.from(BUCKET).remove([p.storage_path]);
      await supabase
        .from("photos")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", p.id);

      manifest.push({
        id: p.id,
        delivery_id: p.delivery_id,
        storage_path: p.storage_path,
        local_file: dest,
        size: s.size,
        taken_at: p.taken_at,
        gps_lat: p.gps_lat,
        gps_lng: p.gps_lng,
        created_at: p.created_at,
      });
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
