// SiteApp — delete orphan photo ROWS whose storage file is missing.
//
// A "live" photo (archived_at IS NULL, deleted_at IS NULL) should always have a
// file in Storage. Earlier bugs (double-submit + an old hard-delete that removed
// a shared file) left rows pointing at files that no longer exist. Those rows
// inflate counts and show as broken. This safely removes ONLY rows whose file is
// confirmed missing.
//
// It NEVER touches archived photos (archived_at set — their files are intentionally
// removed by archive-photos.mjs) or soft-deleted photos (deleted_at set).
//
// Run preview:  node scripts/cleanup-orphan-photos.mjs --dry-run
// Run for real: node scripts/cleanup-orphan-photos.mjs
//
// Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BUCKET = "site-photos";
const DRY_RUN = process.argv.includes("--dry-run");

async function loadEnv() {
  try {
    const raw = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* rely on real env */ }
}

const folderOf = (p) => p.slice(0, p.lastIndexOf("/"));
const nameOf = (p) => p.slice(p.lastIndexOf("/") + 1);

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Live photos only.
  const { data: photos, error } = await sb
    .from("photos")
    .select("id, storage_path, project_id, created_at")
    .is("archived_at", null)
    .is("deleted_at", null);
  if (error) { console.error("query failed:", error.message); process.exit(1); }
  console.log(`[cleanup] ${photos.length} live photo(s) to verify`);

  // List each folder once → set of existing file names.
  const folders = [...new Set(photos.map((p) => folderOf(p.storage_path)))];
  const existing = new Map();
  for (const f of folders) {
    const { data: list, error: lErr } = await sb.storage.from(BUCKET).list(f, { limit: 1000 });
    if (lErr) { console.error(`  list failed for ${f}: ${lErr.message} — skipping (won't delete)`); existing.set(f, null); continue; }
    existing.set(f, new Set((list ?? []).map((o) => o.name)));
  }

  // Orphans = live rows whose folder listed OK but file name is absent.
  const orphans = photos.filter((p) => {
    const set = existing.get(folderOf(p.storage_path));
    return set instanceof Set && !set.has(nameOf(p.storage_path));
  });

  // Report duplicate storage_paths among live photos (informational).
  const byPath = new Map();
  for (const p of photos) byPath.set(p.storage_path, (byPath.get(p.storage_path) ?? 0) + 1);
  const dups = [...byPath.entries()].filter(([, n]) => n > 1);

  console.log(`[cleanup] orphan rows (file missing): ${orphans.length}`);
  for (const o of orphans) console.log(`   - ${o.id.slice(0, 8)}  ${o.storage_path}`);
  console.log(`[cleanup] duplicate storage_paths among live photos: ${dups.length}`);

  if (orphans.length === 0) { console.log("[cleanup] nothing to delete. Done."); return; }

  if (DRY_RUN) {
    console.log(`[cleanup] DRY RUN — would delete ${orphans.length} orphan row(s). Re-run without --dry-run to apply.`);
    return;
  }

  const ids = orphans.map((o) => o.id);
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: dErr } = await sb.from("photos").delete().in("id", batch);
    if (dErr) { console.error("delete failed:", dErr.message); process.exit(1); }
  }
  console.log(`[cleanup] deleted ${ids.length} orphan photo row(s). Done.`);
}

main().catch((e) => { console.error("[cleanup] fatal:", e); process.exit(1); });
