#!/usr/bin/env node
// Import the local office app's purchase orders into Supabase, so every PO ever
// raised is visible in the web app alongside newly created ones.
//
//   node scripts/import-local-pos.mjs --dry-run     # show what would change
//   node scripts/import-local-pos.mjs               # write
//
// Source: the local app's SQLite (D:\dev\siteapp-office\data\office.db by
// default; override with LOCAL_OFFICE_DB). Opened READ-ONLY — this script never
// modifies the local app's data.
//
// Idempotent: upserts on po_number and replaces that PO's line items, so
// re-running after the local app issues more POs just brings the new ones over.
// Finishes by calling sync_po_sequence() so the shared numbering can never
// hand out a number the local app already used.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (RLS on purchase_orders is
// membership + office-flag based; a CLI has no session). Same pattern as
// scripts/archive-photos.mjs. The key must never reach the Vercel app.

import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry-run");

// --- env ---------------------------------------------------------------------
function loadEnv() {
  const file = path.join(repoRoot, ".env.local");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}
const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const DB_PATH =
  env.LOCAL_OFFICE_DB ?? path.resolve(repoRoot, "..", "siteapp-office", "data", "office.db");
if (!existsSync(DB_PATH)) {
  console.error(`Local office DB not found: ${DB_PATH}\nSet LOCAL_OFFICE_DB to its path.`);
  process.exit(1);
}

// better-sqlite3 lives in the local office app, not this repo.
const require = createRequire(path.join(repoRoot, "..", "siteapp-office", "package.json"));
let Database;
try {
  Database = require("better-sqlite3");
} catch {
  console.error("better-sqlite3 not resolvable. Run this with the siteapp-office app installed.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- read local ---------------------------------------------------------------
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
const localPos = db
  .prepare(
    `select id, po_number, request_id, project_id, supplier_id, supplier, items_json,
            terms, pdf_path, status, doc_type, supplier_address, deliver_to, revision,
            tax_pct, created_at, doc_date, needed_by, notes, remark, is_bulk,
            parent_po_id, issued_by, site_contact
       from purchase_orders
      order by id`,
  )
  .all();

// Memos point at their parent by local row id; the shared table references the
// parent's NUMBER instead, so build the lookup before mapping.
const numberByLocalId = new Map(localPos.map((r) => [r.id, r.po_number]));

console.log(`Local POs found: ${localPos.length}${DRY ? "  (dry run)" : ""}`);

// --- guard: referenced projects and suppliers must exist on the web ----------
const projectIds = [...new Set(localPos.map((r) => r.project_id).filter(Boolean))];
const supplierIds = [...new Set(localPos.map((r) => r.supplier_id).filter(Boolean))];

const { data: projRows } = await supabase.from("projects").select("id").in("id", projectIds);
const knownProjects = new Set((projRows ?? []).map((r) => r.id));
const { data: supRows } = await supabase.from("suppliers").select("id").in("id", supplierIds);
const knownSuppliers = new Set((supRows ?? []).map((r) => r.id));

for (const id of projectIds)
  if (!knownProjects.has(id)) console.warn(`  ! project ${id} not on the web — its POs are skipped`);
for (const id of supplierIds)
  if (!knownSuppliers.has(id)) console.warn(`  ! supplier ${id} not on the web — PO imported without a supplier link`);

// --- map + write ---------------------------------------------------------------
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// The local needed_by is free text ("ASAP"); keep a real date only when it is one.
const asDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

let imported = 0,
  skipped = 0,
  items = 0;

for (const r of localPos) {
  if (!r.project_id || !knownProjects.has(r.project_id)) {
    skipped++;
    continue;
  }

  const row = {
    po_number: r.po_number,
    // 'amended' means issued-then-revised; revision already carries that.
    status: r.status === "cancelled" ? "cancelled" : "issued",
    revision: r.revision ?? 0,
    project_id: r.project_id,
    supplier_id: knownSuppliers.has(r.supplier_id) ? r.supplier_id : null,
    purchase_request_id: r.request_id || null,
    doc_type: r.doc_type || "po",
    doc_date: asDate(r.doc_date),
    needed_by: asDate(r.needed_by),
    needed_by_text: r.needed_by || null,
    delivery_address: r.deliver_to || null,
    terms: r.terms || null,
    note: r.notes || null,
    remark: r.remark || null,
    site_contact: r.site_contact || null,
    tax_percent: num(r.tax_pct),
    is_bulk: !!r.is_bulk,
    parent_po_number: r.parent_po_id ? (numberByLocalId.get(r.parent_po_id) ?? null) : null,
    local_id: r.id,
    pdf_path: r.pdf_path || null,
    source: "local",
    issued_at: r.created_at ?? null,
    issued_by_name: r.issued_by || null,
    created_at: r.created_at ?? undefined,
  };

  const parsed = (() => {
    try {
      return JSON.parse(r.items_json || "[]");
    } catch {
      console.warn(`  ! ${r.po_number}: unreadable items_json — imported with no lines`);
      return [];
    }
  })();

  if (DRY) {
    console.log(
      `  would import ${r.po_number}${row.revision ? ` Rev ${row.revision}` : ""} · ` +
        `${r.supplier ?? "—"} · ${parsed.length} lines · ${row.doc_type}`,
    );
    imported++;
    items += parsed.length;
    continue;
  }

  const { data: up, error: upErr } = await supabase
    .from("purchase_orders")
    .upsert(row, { onConflict: "po_number" })
    .select("id")
    .maybeSingle();
  if (upErr || !up) {
    console.error(`  x ${r.po_number}: ${upErr?.message ?? "upsert returned nothing"}`);
    continue;
  }

  // Replace this PO's lines so a re-run reflects local edits rather than
  // stacking duplicates.
  await supabase.from("purchase_order_items").delete().eq("po_id", up.id);
  const lines = parsed.map((it, i) => ({
    po_id: up.id,
    material_text: String(it.description ?? "").trim() || "—",
    quantity: num(it.qty),
    unit: it.unit ? String(it.unit) : null,
    unit_price: num(it.unit_price),
    sort_order: i,
  }));
  if (lines.length) {
    const { error: liErr } = await supabase.from("purchase_order_items").insert(lines);
    if (liErr) console.error(`  x ${r.po_number} lines: ${liErr.message}`);
  }

  imported++;
  items += lines.length;
  console.log(`  ✓ ${r.po_number}${row.revision ? ` Rev ${row.revision}` : ""} · ${lines.length} lines`);
}

// --- keep the shared numbering ahead of everything imported -------------------
if (!DRY) {
  const { data: seq, error: seqErr } = await supabase.rpc("sync_po_sequence");
  if (seqErr) console.error(`Sequence sync failed: ${seqErr.message}`);
  else console.log(`PO sequence now at ${seq} — next web PO will be PO-${Number(seq) + 1}`);
}

console.log(
  `\n${DRY ? "Would import" : "Imported"}: ${imported} POs, ${items} line items` +
    (skipped ? `, skipped ${skipped} (unknown project)` : ""),
);
db.close();
