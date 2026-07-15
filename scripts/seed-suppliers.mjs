// SiteApp — seed the supplier catalog from the accounting trade-creditor list.
// Inserts only suppliers that don't already exist (case-insensitive name match);
// existing ones get their accounting code backfilled if missing. Idempotent.
//
// Preview:  node scripts/seed-suppliers.mjs --dry-run
// Apply:    node scripts/seed-suppliers.mjs

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

// From the accounting system's TRADE CREDITORS list (TC- prefix stripped,
// names title-cased). code = the creditor account code.
const SUPPLIERS = [
  { code: "4000/B02", name: "Best Lime Industries" },
  { code: "4000/B04", name: "Buildcon Concrete Sdn Bhd" },
  { code: "4000/C03", name: "CMCM Perniagaan Sdn Bhd" },
  { code: "4000/C04", name: "Chuan Huat Industrial Marketing Sdn Bhd" },
  { code: "4000/E01", name: "Emum Capital Sdn Bhd" },
  { code: "4000/G01", name: "Great Lime Factory Sdn Bhd" },
  { code: "4000/I03", name: "Impreno Sdn Bhd" },
  { code: "4000/I02", name: "Inno Concrete Technologies Sdn Bhd" },
  { code: "4000/K02", name: "Kean Wah Marketing Sdn Bhd" },
  { code: "4001/K01", name: "Kinson Marketing Sdn Bhd" },
  { code: "4000/K03", name: "Kosit Enterprise Sdn Bhd" },
  { code: "4000/L03", name: "Leisure Paradise Sdn Bhd" },
  { code: null, name: "Leong Trading" },
  { code: "4000/N01", name: "New Tik Seng Hardware Trading Sdn Bhd" },
  { code: "4000/P02", name: "Paramount Asphalt Sdn Bhd" },
  { code: "4000/S01", name: "Soon Hin Hardware Sdn Bhd" },
  { code: "4000/S03", name: "Sem Foong Sawmill Sdn Bhd" },
  { code: "4000/S04", name: "Sensation Mission Sdn Bhd" },
  { code: "4000/S10", name: "SSB Resources" },
  { code: "4000/S09", name: "SYS Marketing" },
  { code: "4000/T04", name: "Teh Khoon Chuan Trading Co. Sdn Bhd" },
  { code: "4000/T01", name: "Tik Seng Hardware Trading Sdn Bhd" },
  { code: "4000/T03", name: "Thai Yin Trading" },
  { code: null, name: "Vivo Raiser Sdn Bhd" },
  { code: "4000/V01", name: "Voseng River Sand Bricks & Hardware Sdn Bhd" },
  { code: null, name: "Yuen Tung Premix Sdn Bhd" },
];

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

// Loose key for duplicate detection: lowercase, strip punctuation and the
// Sdn Bhd suffix so "Tik Seng Hardware" matches "Tik Seng Hardware Trading Sdn Bhd"
// only when truly identical otherwise — we keep it conservative (full compare).
const nameKey = (s) =>
  s.toLowerCase().replace(/[.&,'-]/g, "").replace(/\s+/g, " ").replace(/\s*sdn\.?\s*bhd\.?$/i, "").trim();

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing, error } = await sb.from("suppliers").select("id, name, code");
  if (error) { console.error("query failed:", error.message); process.exit(1); }
  const byKey = new Map((existing ?? []).map((s) => [nameKey(s.name), s]));

  const toInsert = [];
  const toBackfill = [];
  for (const s of SUPPLIERS) {
    const hit = byKey.get(nameKey(s.name));
    if (!hit) { toInsert.push(s); continue; }
    if (s.code && !hit.code) toBackfill.push({ id: hit.id, name: hit.name, code: s.code });
  }

  console.log(`[seed] existing suppliers: ${existing?.length ?? 0}`);
  console.log(`[seed] new to insert: ${toInsert.length}`);
  for (const s of toInsert) console.log(`   + ${s.name}${s.code ? ` (${s.code})` : ""}`);
  console.log(`[seed] code backfills on existing: ${toBackfill.length}`);
  for (const s of toBackfill) console.log(`   ~ ${s.name} → ${s.code}`);

  if (DRY_RUN) { console.log("[seed] DRY RUN — nothing written."); return; }

  if (toInsert.length > 0) {
    const { error: insErr } = await sb
      .from("suppliers")
      .insert(toInsert.map((s) => ({ name: s.name, code: s.code, active: true })));
    if (insErr) { console.error("insert failed:", insErr.message); process.exit(1); }
  }
  for (const b of toBackfill) {
    const { error: upErr } = await sb.from("suppliers").update({ code: b.code }).eq("id", b.id);
    if (upErr) { console.error(`backfill failed for ${b.name}:`, upErr.message); process.exit(1); }
  }
  console.log(`[seed] done — inserted ${toInsert.length}, backfilled ${toBackfill.length}.`);
}

main().catch((e) => { console.error("[seed] fatal:", e); process.exit(1); });
