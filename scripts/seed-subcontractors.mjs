// SiteApp — seed the subcontractor list from the accounting trade-creditor list.
// Inserts only subcontractors that don't already exist (case-insensitive name
// match); existing ones get their accounting code backfilled if missing.
// Idempotent — safe to re-run.
//
// The code column arrives with migration 0037; until that's applied the script
// still seeds the names and skips codes with a warning.
//
// Preview:  node scripts/seed-subcontractors.mjs --dry-run
// Apply:    node scripts/seed-subcontractors.mjs

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

// From the accounting system's TRADE CREDITORS list (TC- prefix stripped,
// names title-cased, known acronyms kept upper). code = creditor account code.
const SUBCONTRACTORS = [
  { code: "4001/B02", name: "Bewa Bina Sdn Bhd" },
  { code: "4001/G04", name: "Galaxy Civil Engineering Works Sdn Bhd" },
  { code: "4001/K03", name: "Kin Loong Sdn Bhd" },
  { code: "4001/K01", name: "KT Crane Sdn Bhd" },
  { code: "4001/K02", name: "Krish Clem Enterprise" },
  { code: null, name: "KFF Trading" },
  { code: "4001/L03", name: "Leong Construction Engineering Service" },
  { code: "4001/L08", name: "Lean Seng Tractor Work" },
  { code: null, name: "LCH Communication System" },
  { code: null, name: "Matt Tech Synergy" },
  { code: "4001/M05", name: "MCCL Manufacturing Sdn Bhd" },
  { code: "4001/N01", name: "New Kinta Crane Sdn Bhd" },
  { code: "4001/N03", name: "Ng Wei Khang" },
  { code: null, name: "Ng Chooi Vern (Rental)" },
  { code: null, name: "Netspek Sdn Bhd" },
  { code: null, name: "Seng Fatt Piling Works Sdn Bhd" },
  { code: "4001/S03", name: "Sin Choong Yan Woodwork Sdn Bhd" },
  { code: "4001/S11", name: "Syarikat Letrik Maju" },
  { code: "4001/S14", name: "Syarikat Pembinaan Kent Lik Sdn Bhd" },
  { code: "4001/T07", name: "Tukang Besi Voon Kee" },
  { code: "4001/U03", name: "United Crane Services" },
  { code: "4001/T03", name: "Uni Tractor Works" },
  { code: "4001/W02", name: "Wan Sheng Glass & Aluminium Sdn Bhd" },
  { code: "4001/W03", name: "Wan Sheng Partition And Ceiling Construction" },
  { code: "4001/Y01", name: "Yee Ming Enterprise Sdn Bhd" },
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

// Loose key for duplicate detection: lowercase, strip punctuation and a
// trailing Sdn Bhd so re-runs never double-insert.
const nameKey = (s) =>
  s.toLowerCase().replace(/[.&,'()-]/g, "").replace(/\s+/g, " ").replace(/\s*sdn\.?\s*bhd\.?$/i, "").trim();

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Migration 0037 adds subcontractors.code — work with or without it.
  let hasCode = true;
  {
    const { error } = await sb.from("subcontractors").select("code").limit(1);
    if (error) hasCode = false;
  }
  if (!hasCode) {
    console.log("[seed] note: subcontractors.code missing — apply migration 0037 to store codes.");
  }

  const cols = hasCode ? "id, name, code" : "id, name";
  const { data: existing, error } = await sb.from("subcontractors").select(cols);
  if (error) { console.error("query failed:", error.message); process.exit(1); }
  const byKey = new Map((existing ?? []).map((s) => [nameKey(s.name), s]));

  const toInsert = [];
  const toBackfill = [];
  for (const s of SUBCONTRACTORS) {
    const hit = byKey.get(nameKey(s.name));
    if (!hit) { toInsert.push(s); continue; }
    if (hasCode && s.code && !hit.code) toBackfill.push({ id: hit.id, name: hit.name, code: s.code });
  }

  console.log(`[seed] existing subcontractors: ${existing?.length ?? 0}`);
  console.log(`[seed] new to insert: ${toInsert.length}`);
  for (const s of toInsert) console.log(`   + ${s.name}${s.code ? ` (${s.code})` : ""}`);
  console.log(`[seed] code backfills on existing: ${toBackfill.length}`);
  for (const s of toBackfill) console.log(`   ~ ${s.name} → ${s.code}`);

  if (DRY_RUN) { console.log("[seed] DRY RUN — nothing written."); return; }

  if (toInsert.length > 0) {
    const rows = toInsert.map((s) =>
      hasCode ? { name: s.name, code: s.code, active: true } : { name: s.name, active: true },
    );
    const { error: insErr } = await sb.from("subcontractors").insert(rows);
    if (insErr) { console.error("insert failed:", insErr.message); process.exit(1); }
  }
  for (const b of toBackfill) {
    const { error: upErr } = await sb.from("subcontractors").update({ code: b.code }).eq("id", b.id);
    if (upErr) { console.error(`backfill failed for ${b.name}:`, upErr.message); process.exit(1); }
  }
  console.log(`[seed] done — inserted ${toInsert.length}, backfilled ${toBackfill.length}.`);
}

main().catch((e) => { console.error("[seed] fatal:", e); process.exit(1); });
