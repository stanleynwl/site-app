"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "@/lib/supabase/env";
import { getSessionUser, getProfile } from "@/lib/auth/dal";
import { usernameToEmail } from "@/lib/auth/username";
import { todayISO, isInSoftEditWindow, normalizeReportDate } from "@/lib/date";
import { DEFAULT_STAGES } from "@/lib/stages";
import { progressSeedRows, progressItemLabel } from "@/lib/progress-template";
import { logActivity, type ActivityAction } from "./activity";
import type { IssueCategory, NoWorkReason, ReportType, Weather } from "./reports";

const WEATHERS: Weather[] = ["sunny", "cloudy", "light_rain", "heavy_rain"];
const CATEGORIES: IssueCategory[] = ["material", "weather", "consultant", "other"];
const REPORT_TYPES: ReportType[] = ["normal", "no_work"];
const NO_WORK_REASONS: NoWorkReason[] = ["holiday", "weather", "site_closed", "other"];

export async function createProject(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      code: String(formData.get("code") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      start_date: String(formData.get("start_date") ?? "") || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return;
  revalidatePath("/office");
  revalidatePath("/office/projects");
  redirect(`/office/projects/${data.id}`);
}

// --- Phase 2 catalog: managed suppliers + materials (pm/office only) ---------

export async function createSupplier(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("suppliers").insert({
    name,
    code: String(formData.get("code") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    company_id: profile.company_id,
    created_by: profile.id,
  });
  revalidatePath("/office/catalog");
}

export async function createMaterial(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("materials").insert({
    name,
    unit: String(formData.get("unit") ?? "").trim() || null,
    count_required: formData.get("count_required") === "on",
    company_id: profile.company_id,
  });
  revalidatePath("/office/catalog");
}

// Edit / retire catalog entries (pm/office). Deactivating hides an entry from the
// request/delivery/stock pickers without deleting it (history is preserved).
async function requireOfficeProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return null;
  return profile;
}

export async function updateSupplier(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireOfficeProfile())) return;
  const id = String(formData.get("supplier_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const supabase = await createClient();
  await supabase
    .from("suppliers")
    .update({
      name,
      code: String(formData.get("code") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
    })
    .eq("id", id);
  revalidatePath("/office/catalog");
}

export async function setSupplierActive(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireOfficeProfile())) return;
  const id = String(formData.get("supplier_id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("suppliers").update({ active }).eq("id", id);
  revalidatePath("/office/catalog");
}

export async function updateMaterial(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireOfficeProfile())) return;
  const id = String(formData.get("material_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const supabase = await createClient();
  await supabase
    .from("materials")
    .update({
      name,
      unit: String(formData.get("unit") ?? "").trim() || null,
      count_required: formData.get("count_required") === "on",
    })
    .eq("id", id);
  revalidatePath("/office/catalog");
}

export async function setMaterialActive(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireOfficeProfile())) return;
  const id = String(formData.get("material_id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("materials").update({ active }).eq("id", id);
  revalidatePath("/office/catalog");
}

// --- Phase 10: workers, attendance, advances, monthly claims -----------------

// Office-capable gate: role pm/office OR the can_office flag (an admin can grant
// office access independent of role — see migration 0022 / RLS can_office()).
async function requireCanOffice() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.can_office) return null;
  return profile;
}

// Subcontractors (managed list, office) --------------------------------------
export async function createSubcontractor(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await requireCanOffice();
  if (!profile) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("subcontractors").insert({
    name,
    phone: String(formData.get("phone") ?? "").trim() || null,
    company_id: profile.company_id,
    created_by: profile.id,
  });
  revalidatePath("/office/catalog");
}

export async function updateSubcontractor(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireCanOffice())) return;
  const id = String(formData.get("subcontractor_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const supabase = await createClient();
  await supabase
    .from("subcontractors")
    .update({ name, phone: String(formData.get("phone") ?? "").trim() || null })
    .eq("id", id);
  revalidatePath("/office/catalog");
}

export async function setSubcontractorActive(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireCanOffice())) return;
  const id = String(formData.get("subcontractor_id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("subcontractors").update({ active }).eq("id", id);
  revalidatePath("/office/catalog");
}

// Workers — ANY member may create (supervisor adds on site); office edits ------
export async function createWorker(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const subId = String(formData.get("subcontractor_id") ?? "").trim();
  const rateRaw = String(formData.get("daily_rate") ?? "").trim();
  const supabase = await createClient();
  await supabase.from("workers").insert({
    name,
    subcontractor_id: subId || null,
    daily_rate: rateRaw ? Number(rateRaw) : null,
    company_id: profile.company_id,
    created_by: profile.id,
  });
  revalidatePath("/office/catalog");
  const projectId = String(formData.get("project_id") ?? "");
  if (projectId) revalidatePath(`/app/projects/${projectId}/workers`);
}

export async function updateWorker(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireCanOffice())) return;
  const id = String(formData.get("worker_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const subId = String(formData.get("subcontractor_id") ?? "").trim();
  const rateRaw = String(formData.get("daily_rate") ?? "").trim();
  const supabase = await createClient();
  await supabase
    .from("workers")
    .update({
      name,
      subcontractor_id: subId || null,
      daily_rate: rateRaw ? Number(rateRaw) : null,
    })
    .eq("id", id);
  revalidatePath("/office/catalog");
}

export async function setWorkerActive(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!(await requireCanOffice())) return;
  const id = String(formData.get("worker_id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("workers").update({ active }).eq("id", id);
  revalidatePath("/office/catalog");
}

// Attendance — member saves one day's units per worker. Form posts parallel
// arrays att_worker_id[] + att_units[]; blank/0 clears that worker's row.
export async function saveAttendance(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projectId = String(formData.get("project_id") ?? "");
  const date = String(formData.get("work_date") ?? "");
  if (!projectId || !date) return;

  const workerIds = formData.getAll("att_worker_id").map(String);
  const unitsArr = formData.getAll("att_units").map(String);

  const postedIds = workerIds.filter(Boolean);
  const toInsert: Array<Record<string, unknown>> = [];
  workerIds.forEach((wid, i) => {
    if (!wid) return;
    const raw = (unitsArr[i] ?? "").trim();
    const n = raw === "" ? 0 : Number(raw);
    if (Number.isFinite(n) && n > 0) {
      toInsert.push({
        project_id: projectId,
        worker_id: wid,
        work_date: date,
        units: n,
        recorded_by: user.id,
      });
    }
  });

  const supabase = await createClient();
  // Replace this day's rows for the posted roster workers (clean edit).
  if (postedIds.length) {
    await supabase
      .from("attendance_entries")
      .delete()
      .eq("project_id", projectId)
      .eq("work_date", date)
      .in("worker_id", postedIds);
  }
  if (toInsert.length) {
    await supabase.from("attendance_entries").insert(toInsert);
  }

  // Optional ad-hoc free-text worker not yet in the roster.
  const adhocName = String(formData.get("adhoc_name") ?? "").trim();
  const adhocUnits = Number(String(formData.get("adhoc_units") ?? "").trim());
  if (adhocName && Number.isFinite(adhocUnits) && adhocUnits > 0) {
    await supabase.from("attendance_entries").insert({
      project_id: projectId,
      worker_name: adhocName,
      work_date: date,
      units: adhocUnits,
      recorded_by: user.id,
    });
  }

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "attendance.record",
    entityType: "attendance",
    detail: date,
  });
  revalidatePath(`/app/projects/${projectId}/workers`);
  revalidatePath(`/office/projects/${projectId}/attendance`);
}

// Advances — member logs an advance to a worker or a subcontractor. The form
// posts target = "worker:<id>" or "sub:<id>".
export async function createAdvance(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projectId = String(formData.get("project_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!projectId || !Number.isFinite(amount) || amount <= 0) return;

  const target = String(formData.get("target") ?? "");
  let worker_id: string | null = null;
  let subcontractor_id: string | null = null;
  if (target.startsWith("worker:")) worker_id = target.slice(7) || null;
  else if (target.startsWith("sub:")) subcontractor_id = target.slice(4) || null;
  if (!worker_id && !subcontractor_id) return;

  const date = String(formData.get("advance_date") ?? "") || todayISO();
  const supabase = await createClient();
  await supabase.from("advances").insert({
    project_id: projectId,
    worker_id,
    subcontractor_id,
    advance_date: date,
    amount,
    note: String(formData.get("note") ?? "").trim() || null,
    recorded_by: user.id,
  });
  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "advance.create",
    entityType: "advance",
    detail: String(amount),
  });
  revalidatePath(`/app/projects/${projectId}/workers`);
  revalidatePath(`/office/projects/${projectId}/attendance`);
}

export async function deleteAdvance(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const id = String(formData.get("advance_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("advances").delete().eq("id", id);
  revalidatePath(`/app/projects/${projectId}/workers`);
  revalidatePath(`/office/projects/${projectId}/attendance`);
}

// Monthly claim — office upserts the header and replaces its line items. Posts
// month=YYYY-MM and parallel item_* arrays.
export async function saveClaim(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await requireCanOffice();
  if (!profile) return;
  const projectId = String(formData.get("project_id") ?? "");
  const subId = String(formData.get("subcontractor_id") ?? "");
  const month = String(formData.get("month") ?? "");
  if (!projectId || !subId || !/^\d{4}-\d{2}$/.test(month)) return;

  const supabase = await createClient();
  const { data: claimRow } = await supabase
    .from("claims")
    .upsert(
      {
        project_id: projectId,
        subcontractor_id: subId,
        period_month: `${month}-01`,
        note: String(formData.get("note") ?? "").trim() || null,
        created_by: profile.id,
      },
      { onConflict: "project_id,subcontractor_id,period_month" },
    )
    .select("id")
    .single();
  if (!claimRow) return;
  const claimId = (claimRow as { id: string }).id;

  const descs = formData.getAll("item_description").map(String);
  const qtys = formData.getAll("item_quantity").map(String);
  const units = formData.getAll("item_unit").map(String);
  const prices = formData.getAll("item_unit_price").map(String);
  const items = descs
    .map((d, i) => ({
      claim_id: claimId,
      description: d.trim(),
      quantity: Number(qtys[i] ?? 0) || 0,
      unit: (units[i] ?? "").trim() || null,
      unit_price: Number(prices[i] ?? 0) || 0,
      sort_order: i,
    }))
    .filter((it) => it.description !== "");

  await supabase.from("claim_items").delete().eq("claim_id", claimId);
  if (items.length) await supabase.from("claim_items").insert(items);

  await logActivity(supabase, {
    projectId,
    actorId: profile.id,
    action: "claim.update",
    entityType: "claim",
    entityId: claimId,
  });
  revalidatePath(`/office/projects/${projectId}/claims`);
}

// --- Phase 2 photo taxonomy: project tags + progress photos ------------------

const TAG_KINDS = ["block", "level", "area", "activity"] as const;
type TagKindLiteral = (typeof TAG_KINDS)[number];

// Create a project tag. pm/office tags are approved immediately; a supervisor's
// is a suggestion (approved=false) that office approves later. Duplicate
// (project, kind, label) is ignored (unique constraint).
export async function createProjectTag(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const projectId = String(formData.get("project_id") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!projectId || !label) return;
  if (!TAG_KINDS.includes(kindRaw as TagKindLiteral)) return;

  const isOffice = profile.role === "pm" || profile.role === "office";

  const supabase = await createClient();
  await supabase.from("project_tags").upsert(
    {
      project_id: projectId,
      kind: kindRaw,
      label,
      approved: isOffice,
      created_by: profile.id,
    },
    { onConflict: "project_id,kind,label", ignoreDuplicates: true },
  );

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/photos`);
}

export async function approveProjectTag(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("tag_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_tags").update({ approved: true }).eq("id", id);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/photos`);
}

export async function deleteProjectTag(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("tag_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  // Deleting the tag cascades its photo_tags rows (on delete cascade).
  const supabase = await createClient();
  await supabase.from("project_tags").delete().eq("id", id);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/photos`);
}

export type PhotoState =
  | { ok: true }
  | { error: "save" | "auth" | "validation" | "not-configured" }
  | undefined;

// Supervisor captures one or more progress photos (already uploaded to Storage
// client-side) with an optional caption and shared taxonomy tags.
export async function createPhoto(
  _prev: PhotoState,
  formData: FormData,
): Promise<PhotoState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "validation" };

  const photoPaths = formData.getAll("photo_path").map(String).filter(Boolean);
  if (photoPaths.length === 0) return { error: "validation" };
  const photoTakenAt = formData.getAll("photo_taken_at").map(String);
  const photoLat = formData.getAll("photo_lat").map(String);
  const photoLng = formData.getAll("photo_lng").map(String);
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const tagIds = formData.getAll("tag_id").map(String).filter(Boolean);

  const supabase = await createClient();
  const photoRows = photoPaths.map((path, i) => ({
    project_id: projectId,
    storage_path: path,
    caption,
    taken_at: photoTakenAt[i] || null,
    gps_lat: parseCoord(photoLat[i] ?? null),
    gps_lng: parseCoord(photoLng[i] ?? null),
    uploaded_by: user.id,
  }));
  const { data: inserted, error } = await supabase
    .from("photos")
    .insert(photoRows)
    .select("id");
  if (error || !inserted) return { error: "save" };

  // Apply the selected tags to every photo in this batch.
  if (tagIds.length > 0) {
    const links = inserted.flatMap((ph) =>
      tagIds.map((tid) => ({ photo_id: ph.id, tag_id: tid })),
    );
    await supabase.from("photo_tags").insert(links);
  }

  revalidatePath(`/app/projects/${projectId}/photos`);
  revalidatePath(`/office/projects/${projectId}`);
  return { ok: true };
}

// Office re-tags an existing photo: replace its tag set with the submitted one.
export async function setPhotoTags(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const photoId = String(formData.get("photo_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!photoId) return;
  const tagIds = formData.getAll("tag_id").map(String).filter(Boolean);

  const supabase = await createClient();
  await supabase.from("photo_tags").delete().eq("photo_id", photoId);
  if (tagIds.length > 0) {
    await supabase
      .from("photo_tags")
      .insert(tagIds.map((tid) => ({ photo_id: photoId, tag_id: tid })));
  }

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/photos`);
}

// --- Phase 2 deliveries: three-quantity model -------------------------------

export type DeliveryState =
  | { ok: true }
  | { error: "save" | "not-configured" | "auth" | "validation" }
  | undefined;

const DELIVERY_ISSUES = [
  "broken",
  "missing",
  "short",
  "wrong_item",
  "late",
  "other",
] as const;
type DeliveryIssue = (typeof DELIVERY_ISSUES)[number];

function parseQty(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseCoord(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Non-negative integer (block unit count, units done). Null when blank/invalid.
function parseCount(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Insert any photos uploaded with a submission (paths already in Storage),
// attaching them via the given column (progress_item_id / block_stage_id).
async function attachSubmissionPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  projectId: string,
  userId: string,
  link: { column: "progress_item_id" | "block_stage_id"; id: string },
): Promise<void> {
  const paths = formData.getAll("photo_path").map(String).filter(Boolean);
  if (paths.length === 0) return;
  const takenAt = formData.getAll("photo_taken_at").map(String);
  const lat = formData.getAll("photo_lat").map(String);
  const lng = formData.getAll("photo_lng").map(String);
  await supabase.from("photos").insert(
    paths.map((path, i) => ({
      project_id: projectId,
      [link.column]: link.id,
      storage_path: path,
      taken_at: takenAt[i] || null,
      gps_lat: parseCoord(lat[i] ?? null),
      gps_lng: parseCoord(lng[i] ?? null),
      uploaded_by: userId,
    })),
  );
}

// Supervisor logs a delivery — photo-first. The fast path is a photo (+ optional
// issue chip/note); structured fields (supplier/material/qty) are optional and
// often filled by the office later from the photo. received_quantity only applies
// to count_required materials (UI hides it otherwise).
export async function createDelivery(
  _prev: DeliveryState,
  formData: FormData,
): Promise<DeliveryState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "validation" };

  const materialIdRaw = String(formData.get("material_id") ?? "");
  const isOther = materialIdRaw === "" || materialIdRaw === "__other__";
  const materialText = String(formData.get("material_text") ?? "").trim();
  const supplierIdRaw = String(formData.get("supplier_id") ?? "");
  const doNumber = String(formData.get("do_number") ?? "").trim();

  const issueRaw = String(formData.get("issue_type") ?? "");
  const issueType = DELIVERY_ISSUES.includes(issueRaw as DeliveryIssue)
    ? (issueRaw as DeliveryIssue)
    : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const photoPaths = formData.getAll("photo_path").map(String).filter(Boolean);
  const photoTakenAt = formData.getAll("photo_taken_at").map(String);
  const photoLat = formData.getAll("photo_lat").map(String);
  const photoLng = formData.getAll("photo_lng").map(String);

  // Photo-first: allow a delivery with just a photo and/or an issue. Reject only
  // a completely empty submit (no photo, no issue, no material/supplier/DO).
  const hasContent =
    photoPaths.length > 0 ||
    issueType !== null ||
    (!isOther && materialIdRaw) ||
    (isOther && materialText) ||
    Boolean(supplierIdRaw) ||
    Boolean(doNumber);
  if (!hasContent) return { error: "validation" };

  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .insert({
      project_id: projectId,
      supplier_id: supplierIdRaw || null,
      material_id: isOther || !materialIdRaw ? null : materialIdRaw,
      material_text: isOther ? materialText || null : null,
      do_number: doNumber || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      received_quantity: parseQty(formData.get("received_quantity")),
      delivered_on: String(formData.get("delivered_on") ?? "") || todayISO(),
      issue_type: issueType,
      note,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !delivery) return { error: "save" };

  // Persist photo metadata (binaries already uploaded to Storage client-side).
  if (photoPaths.length > 0) {
    const photoRows = photoPaths.map((path, i) => ({
      project_id: projectId,
      delivery_id: delivery.id,
      storage_path: path,
      taken_at: photoTakenAt[i] || null,
      gps_lat: parseCoord(photoLat[i] ?? null),
      gps_lng: parseCoord(photoLng[i] ?? null),
      uploaded_by: user.id,
    }));
    const { data: inserted } = await supabase
      .from("photos")
      .insert(photoRows)
      .select("id");
    if (inserted && inserted.length > 0) {
      await supabase
        .from("deliveries")
        .update({ do_photo_id: inserted[0].id })
        .eq("id", delivery.id);
    }
  }

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "delivery.create",
    entityType: "delivery",
    entityId: delivery.id,
    detail: doNumber ? `DO ${doNumber}` : materialText || null,
  });

  revalidatePath(`/app/projects/${projectId}/deliveries`);
  revalidatePath(`/office/projects/${projectId}`);
  return { ok: true };
}

// Office fills structured data from the photo: DO quantity, and (if the
// supervisor left them blank) supplier / material.
export async function setDeliveryOfficeFields(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("delivery_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supplierId = String(formData.get("supplier_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  const itemId = String(formData.get("purchase_request_item_id") ?? "");

  const supabase = await createClient();

  const update: Record<string, unknown> = {
    do_quantity: parseQty(formData.get("do_quantity")),
  };
  if (supplierId) update.supplier_id = supplierId;
  if (materialId) update.material_id = materialId;

  // Linking a delivery to a purchase-request line item closes the three-quantity
  // variance loop: pull requested_quantity from that item.
  if (itemId) {
    const { data: item } = await supabase
      .from("purchase_request_items")
      .select("quantity, request_id")
      .eq("id", itemId)
      .maybeSingle();
    if (item) {
      update.purchase_request_item_id = itemId;
      update.purchase_request_id = item.request_id;
      update.requested_quantity = item.quantity;
    }
  }

  await supabase.from("deliveries").update(update).eq("id", id);

  await logActivity(supabase, {
    projectId,
    actorId: profile.id,
    action: "delivery.update",
    entityType: "delivery",
    entityId: id,
  });

  if (itemId) revalidatePath("/office/requests");
  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/office/projects/${projectId}/deliveries`);
  revalidatePath("/office/do-queue");
}

// Delete a delivery and its photos (Storage files + rows). pm/office only.
export async function deleteDelivery(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("delivery_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Purge the delivery's photos from Storage, then their rows. Deleting the
  // photo rows also null-clears deliveries.do_photo_id (on delete set null).
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("delivery_id", id);
  const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from("site-photos").remove(paths);
    await supabase.from("photos").delete().eq("delivery_id", id);
  }

  await supabase.from("deliveries").delete().eq("id", id);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/office/projects/${projectId}/deliveries`);
  revalidatePath(`/app/projects/${projectId}/deliveries`);
}

// --- Phase 4 purchase requests: capture-only procurement --------------------

export type PurchaseRequestState =
  | { ok: true }
  | { error: "save" | "auth" | "validation" | "not-configured" }
  | undefined;

// Supervisor raises a purchase request with one or more line items (any project
// member). Each item is a catalog material (material_id) or free text
// (material_text) + optional quantity/unit. Header carries needed-by/urgency/note.
export async function createPurchaseRequest(
  _prev: PurchaseRequestState,
  formData: FormData,
): Promise<PurchaseRequestState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "validation" };

  const materialIds = formData.getAll("request_material_id").map(String);
  const materialTexts = formData.getAll("request_material_text").map(String);
  const quantities = formData.getAll("request_quantity").map(String);
  const units = formData.getAll("request_unit").map(String);

  const items = materialIds
    .map((mid, i) => {
      const idVal = mid.trim();
      const text = (materialTexts[i] ?? "").trim();
      return {
        material_id: idVal || null,
        material_text: idVal ? null : text || null,
        quantity: parseQty(quantities[i] ?? null),
        unit: (units[i] ?? "").trim() || null,
      };
    })
    .filter((it) => it.material_id || it.material_text);

  // A photo of the spec/sample can stand in for typing a long material name, so
  // accept a request with photo(s) and no typed line items.
  const photoPaths = formData.getAll("photo_path").map(String).filter(Boolean);
  const photoTakenAt = formData.getAll("photo_taken_at").map(String);
  const photoLat = formData.getAll("photo_lat").map(String);
  const photoLng = formData.getAll("photo_lng").map(String);

  if (items.length === 0 && photoPaths.length === 0) return { error: "validation" };

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("purchase_requests")
    .insert({
      project_id: projectId,
      needed_by: String(formData.get("needed_by") ?? "") || null,
      urgency_reason: String(formData.get("urgency_reason") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !request) return { error: "save" };

  if (items.length > 0) {
    const { error: itemsErr } = await supabase
      .from("purchase_request_items")
      .insert(items.map((it) => ({ ...it, request_id: request.id })));
    if (itemsErr) return { error: "save" };
  }

  // Persist request photo metadata (binaries already uploaded to Storage).
  if (photoPaths.length > 0) {
    await supabase.from("photos").insert(
      photoPaths.map((path, i) => ({
        project_id: projectId,
        purchase_request_id: request.id,
        storage_path: path,
        taken_at: photoTakenAt[i] || null,
        gps_lat: parseCoord(photoLat[i] ?? null),
        gps_lng: parseCoord(photoLng[i] ?? null),
        uploaded_by: user.id,
      })),
    );
  }

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "request.create",
    entityType: "request",
    entityId: request.id,
    detail: items.map((it) => it.material_text).filter(Boolean).join(", ") || null,
  });

  revalidatePath(`/app/projects/${projectId}/requests`);
  revalidatePath("/office/requests");
  return { ok: true };
}

// Office state-machine transitions (pm/office). Each takes request_id + project_id.
async function updatePurchaseRequest(
  formData: FormData,
  patch: Record<string, unknown>,
  log?: { action: ActivityAction; detail?: string | null },
): Promise<void> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("request_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("purchase_requests").update(patch).eq("id", id);

  if (log && projectId) {
    await logActivity(supabase, {
      projectId,
      actorId: profile.id,
      action: log.action,
      entityType: "request",
      entityId: id,
      detail: log.detail ?? null,
    });
  }

  revalidatePath("/office/requests");
  if (projectId) {
    revalidatePath(`/app/projects/${projectId}/requests`);
    revalidatePath(`/office/projects/${projectId}`);
  }
}

export async function approvePurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  await updatePurchaseRequest(
    formData,
    {
      status: "approved",
      approved_by: profile?.id ?? null,
      approved_at: new Date().toISOString(),
    },
    { action: "request.approve" },
  );
}

export async function rejectPurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const reason = String(formData.get("rejected_reason") ?? "").trim();
  await updatePurchaseRequest(
    formData,
    { status: "rejected", rejected_reason: reason || null },
    { action: "request.reject", detail: reason || null },
  );
}

export async function issuePurchaseRequestPO(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const po = String(formData.get("po_number") ?? "").trim();
  if (!po) return; // PO number is the whole point of this step
  const supplierId = String(formData.get("supplier_id") ?? "");
  const patch: Record<string, unknown> = { status: "po_issued", po_number: po };
  if (supplierId) patch.supplier_id = supplierId;
  await updatePurchaseRequest(formData, patch, {
    action: "request.order",
    detail: `PO ${po}`,
  });
}

// Mark an approved request as ordered WITHOUT raising a formal PO number — for
// quick orders (phoned/WhatsApp'd to the supplier) where there's no PO to key
// in. Same "Ordered" (po_issued) state, just with no po_number. An optional
// supplier can still be recorded.
export async function orderPurchaseRequestNoPO(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supplierId = String(formData.get("supplier_id") ?? "");
  const patch: Record<string, unknown> = { status: "po_issued" };
  if (supplierId) patch.supplier_id = supplierId;
  await updatePurchaseRequest(formData, patch, {
    action: "request.order",
    detail: "Ordered (no PO)",
  });
}

// One-tap shortcut for quick orders: approve a pending request AND mark it
// ordered (no PO) in a single step, so the office doesn't click twice.
export async function approveAndOrderPurchaseRequestNoPO(
  formData: FormData,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  await updatePurchaseRequest(
    formData,
    {
      status: "po_issued",
      approved_by: profile?.id ?? null,
      approved_at: new Date().toISOString(),
    },
    { action: "request.order", detail: "Approved & ordered (no PO)" },
  );
}

export async function closePurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  await updatePurchaseRequest(formData, { status: "closed" }, { action: "request.close" });
}

// Supervisor (any project member) confirms an ordered request has arrived. Only
// transitions from po_issued ("Ordered") → delivered. RLS allows member update.
export async function confirmDeliveredPurchaseRequest(
  formData: FormData,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const id = String(formData.get("request_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("purchase_requests")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "po_issued");

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "request.delivered",
    entityType: "request",
    entityId: id,
  });

  revalidatePath(`/app/projects/${projectId}/requests`);
  revalidatePath("/office/requests");
}

// Supervisor (any project member) amends a request line item's quantity on site
// — e.g. concrete 6m³ → 12m³, or down to 3m³. Allowed anytime the request is
// still on their list (member UPDATE RLS, migration 0027). Decimals allowed.
export async function updateRequestItemQuantity(
  formData: FormData,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const itemId = String(formData.get("item_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!itemId) return;
  const quantity = parseQty(formData.get("quantity"));

  const supabase = await createClient();

  // Read the current item (name + old qty) before updating, for the audit detail.
  const { data: before } = await supabase
    .from("purchase_request_items")
    .select("quantity, unit, material_text, request_id, material:materials(name)")
    .eq("id", itemId)
    .maybeSingle();

  await supabase
    .from("purchase_request_items")
    .update({ quantity })
    .eq("id", itemId);

  if (before) {
    const b = before as unknown as {
      quantity: number | null;
      unit: string | null;
      material_text: string | null;
      request_id: string;
      material: { name: string } | null;
    };
    const name = b.material?.name ?? b.material_text ?? "item";
    const unit = b.unit ? ` ${b.unit}` : "";
    await logActivity(supabase, {
      projectId,
      actorId: user.id,
      action: "request.amend",
      entityType: "request",
      entityId: b.request_id,
      detail: `${name}: ${b.quantity ?? "—"} → ${quantity ?? "—"}${unit}`,
    });
  }

  revalidatePath(`/app/projects/${projectId}/requests`);
  revalidatePath("/office/requests");
}

// --- Phase 5 operations: stock counts ---------------------------------------
// (Machinery moved into the daily report — see saveReport's machinery_entries
//  handling and src/lib/machines.ts.)

export type StockCountState =
  | { ok: true }
  | { error: "save" | "auth" | "validation" | "not-configured" }
  | undefined;

// Supervisor records a physical stock count for a catalog material on a date
// (project member). Upsert keyed on (project, material, date). Consumption is
// derived at read time (see stock.ts) — never stored.
export async function recordStockCount(
  _prev: StockCountState,
  formData: FormData,
): Promise<StockCountState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  const qty = parseQty(formData.get("quantity"));
  if (!projectId || !materialId || qty == null) return { error: "validation" };
  const countDate = String(formData.get("count_date") ?? "") || todayISO();

  const supabase = await createClient();
  const { error } = await supabase.from("stock_counts").upsert(
    {
      project_id: projectId,
      material_id: materialId,
      count_date: countDate,
      quantity: qty,
      unit: String(formData.get("unit") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      counted_by: user.id,
    },
    { onConflict: "project_id,material_id,count_date" },
  );
  if (error) return { error: "save" };

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "stock.count",
    entityType: "stock",
    detail: `${qty}${String(formData.get("unit") ?? "").trim() ? ` ${String(formData.get("unit")).trim()}` : ""}`,
  });

  revalidatePath(`/app/projects/${projectId}/stock`);
  revalidatePath(`/office/projects/${projectId}`);
  return { ok: true };
}

export type SaveReportState =
  | { ok: true; submitted: boolean }
  | { error: "locked" | "save" | "not-configured" | "auth" }
  | undefined;

export async function saveReport(
  _prev: SaveReportState,
  formData: FormData,
): Promise<SaveReportState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  const submit = formData.get("intent") === "submit";

  // Target date: defaults to today, but a missed past day can be backfilled.
  // Validate against the allowed backdate window; reject future / too-old dates.
  const today = todayISO();
  const requestedDate = String(formData.get("report_date") ?? "").trim();
  const date = requestedDate ? normalizeReportDate(requestedDate) : today;
  if (!date) return { error: "save" };
  const isBackdated = date !== today;

  const supabase = await createClient();

  // Validate and parse report_type
  const reportTypeRaw = String(formData.get("report_type") ?? "");
  const reportType: ReportType = REPORT_TYPES.includes(reportTypeRaw as ReportType)
    ? (reportTypeRaw as ReportType)
    : "normal";

  const noWorkReasonRaw = String(formData.get("no_work_reason") ?? "");
  const noWorkReason: NoWorkReason | null =
    reportType === "no_work" && NO_WORK_REASONS.includes(noWorkReasonRaw as NoWorkReason)
      ? (noWorkReasonRaw as NoWorkReason)
      : null;

  const weatherRaw = String(formData.get("weather") ?? "");
  const weather = WEATHERS.includes(weatherRaw as Weather)
    ? (weatherRaw as Weather)
    : null;
  const rainRaw = String(formData.get("rain_hours") ?? "").trim();
  const rainHours = rainRaw === "" ? null : Number(rainRaw);

  // Check for an existing report and enforce lock / soft-edit rules.
  const { data: existing } = await supabase
    .from("daily_reports")
    .select("id, status, author_id, submitted_at")
    .eq("project_id", projectId)
    .eq("report_date", date)
    .maybeSingle();

  if (existing) {
    if (existing.status === "locked") return { error: "locked" };
    if (existing.status === "submitted") {
      // Only the original author may edit within the soft window.
      if (existing.author_id !== user.id) return { error: "locked" };
      if (!isInSoftEditWindow(existing.submitted_at)) return { error: "locked" };
    }
  }

  // For no_work reports, work_done is always null; for normal reports use the field.
  const workDone =
    reportType === "normal"
      ? String(formData.get("work_done") ?? "").trim() || null
      : null;

  const { data: report, error } = await supabase
    .from("daily_reports")
    .upsert(
      {
        project_id: projectId,
        report_date: date,
        author_id: user.id,
        report_type: reportType,
        no_work_reason: noWorkReason,
        is_backdated: isBackdated,
        weather,
        rain_hours: Number.isFinite(rainHours) ? rainHours : null,
        work_done: workDone,
        notes: String(formData.get("notes") ?? "").trim() || null,
      },
      { onConflict: "project_id,report_date" },
    )
    .select("id")
    .single();

  if (error || !report) return { error: "save" };

  // If we edited a submitted report within the soft window, log the edit.
  if (existing?.status === "submitted") {
    await supabase.from("report_edits").insert({
      report_id: report.id,
      editor_id: user.id,
      kind: "soft_window",
    });
  }

  // Manpower and issues only apply to normal reports.
  if (reportType === "normal") {
    const trades = formData.getAll("manpower_trade").map(String);
    const subs = formData.getAll("manpower_subcontractor").map(String);
    const counts = formData.getAll("manpower_worker_count").map(String);
    const manpower = trades
      .map((trade, i) => ({
        report_id: report.id,
        trade: trade.trim(),
        subcontractor: subs[i]?.trim() || null,
        worker_count: Number.parseInt(counts[i] ?? "0", 10) || 0,
      }))
      // Keep only trades that actually had workers — drops untouched default
      // rows (worker_count 0) so empty trades never reach the DB / office view.
      .filter((row) => row.trade !== "" && row.worker_count > 0);

    const descs = formData.getAll("issue_description").map(String);
    const cats = formData.getAll("issue_category").map(String);
    const issues = descs
      .map((description, i) => ({
        report_id: report.id,
        description: description.trim(),
        category: (CATEGORIES.includes(cats[i] as IssueCategory)
          ? cats[i]
          : "other") as IssueCategory,
      }))
      .filter((row) => row.description !== "");

    await supabase.from("manpower_entries").delete().eq("report_id", report.id);
    if (manpower.length) {
      await supabase.from("manpower_entries").insert(manpower);
    }

    // Machinery — one row per machine + hours (repeat a type for multiple units).
    // Persist any row that has a machine type; hours are optional so a selected
    // machine isn't silently dropped (and doesn't "revert" to a default) when the
    // supervisor saves before entering hours.
    const machineTypes = formData.getAll("machinery_type").map(String);
    const machineHours = formData.getAll("machinery_hours").map(String);
    const machinery = machineTypes
      .map((type, i) => ({
        report_id: report.id,
        machine_type: type.trim(),
        hours_worked: parseQty(machineHours[i] ?? null),
      }))
      .filter((row) => row.machine_type !== "");

    await supabase.from("machinery_entries").delete().eq("report_id", report.id);
    if (machinery.length) {
      await supabase.from("machinery_entries").insert(machinery);
    }

    await supabase.from("issues").delete().eq("report_id", report.id);
    if (issues.length) {
      await supabase.from("issues").insert(issues);
    }
  }

  // Visitors — secondary section, applies to all report types (an inspection can
  // happen on a no-work day). Drop blank-name rows.
  const visitorNames = formData.getAll("visitor_name").map(String);
  const visitorPurposes = formData.getAll("visitor_purpose").map(String);
  const visitors = visitorNames
    .map((name, i) => ({
      report_id: report.id,
      name: name.trim(),
      purpose: visitorPurposes[i]?.trim() || null,
    }))
    .filter((v) => v.name !== "");
  await supabase.from("visitor_entries").delete().eq("report_id", report.id);
  if (visitors.length) {
    await supabase.from("visitor_entries").insert(visitors);
  }

  // Report photos (uploaded to Storage client-side). Insert only paths not yet
  // linked to this report, so repeated draft-saves don't duplicate rows.
  const reportPhotoPaths = formData.getAll("photo_path").map(String).filter(Boolean);
  if (reportPhotoPaths.length > 0) {
    const reportPhotoTakenAt = formData.getAll("photo_taken_at").map(String);
    const reportPhotoLat = formData.getAll("photo_lat").map(String);
    const reportPhotoLng = formData.getAll("photo_lng").map(String);
    const { data: existingPhotos } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("daily_report_id", report.id);
    const known = new Set((existingPhotos ?? []).map((p) => p.storage_path));
    const newRows = reportPhotoPaths
      .map((path, i) => ({
        project_id: projectId,
        daily_report_id: report.id,
        storage_path: path,
        taken_at: reportPhotoTakenAt[i] || null,
        gps_lat: parseCoord(reportPhotoLat[i] ?? null),
        gps_lng: parseCoord(reportPhotoLng[i] ?? null),
        uploaded_by: user.id,
      }))
      .filter((row) => !known.has(row.storage_path));
    if (newRows.length > 0) {
      await supabase.from("photos").insert(newRows);
    }
  }

  if (submit) {
    const { error: submitError } = await supabase
      .from("daily_reports")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", report.id);
    if (submitError) return { error: "save" };
    await logActivity(supabase, {
      projectId,
      actorId: user.id,
      action: "report.submit",
      entityType: "report",
      entityId: report.id,
      detail: date,
    });
  }

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
  revalidatePath("/office");
  revalidatePath(`/office/projects/${projectId}`);
  return { ok: true, submitted: submit };
}

export type UnlockReportState =
  | { ok: true }
  | { error: "not-pm" | "not-locked" | "save" | "not-configured" | "auth" }
  | undefined;

// PMs can reset a hard-locked (or expired-window submitted) report back to
// draft so the author can re-edit and re-submit. Requires a reason.
export async function unlockReport(
  _prev: UnlockReportState,
  formData: FormData,
): Promise<UnlockReportState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const [user, profile] = await Promise.all([getSessionUser(), getProfile()]);
  if (!user || !profile) return { error: "auth" };
  if (profile.role !== "pm") return { error: "not-pm" };

  const reportId = String(formData.get("report_id") ?? "");
  const reason = String(formData.get("unlock_reason") ?? "").trim();
  if (!reason) return { error: "save" };

  const supabase = await createClient();

  const { data: report } = await supabase
    .from("daily_reports")
    .select("id, project_id, status, submitted_at")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { error: "not-locked" };

  const isExpiredSubmitted =
    report.status === "submitted" && !isInSoftEditWindow(report.submitted_at);
  const isHardLocked = report.status === "locked";
  if (!isExpiredSubmitted && !isHardLocked) return { error: "not-locked" };

  const { error } = await supabase
    .from("daily_reports")
    .update({
      status: "draft",
      unlocked_by: user.id,
      unlock_reason: reason,
    })
    .eq("id", reportId);

  if (error) return { error: "save" };

  await supabase.from("report_edits").insert({
    report_id: reportId,
    editor_id: user.id,
    kind: "pm_unlock",
  });

  await logActivity(supabase, {
    projectId: report.project_id,
    actorId: user.id,
    action: "report.unlock",
    entityType: "report",
    entityId: reportId,
    detail: reason,
  });

  revalidatePath(`/office/projects/${report.project_id}`);
  revalidatePath(`/office/projects/${report.project_id}/reports/${reportId}`);
  return { ok: true };
}

// --- Project lifecycle: permanent delete (office/pm) -------------------------

// Permanently delete a project and EVERYTHING under it. All child rows cascade
// from the projects FK (on delete cascade), but Storage binaries don't — so we
// purge the project's photo files first, then delete the row. Irreversible; the
// UI gates this behind a type-the-name confirmation.
export async function deleteProject(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Remove all of the project's photo binaries from Storage (rows cascade).
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("project_id", id);
  const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
  // Storage.remove caps batch size; chunk to be safe on big projects.
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from("site-photos").remove(paths.slice(i, i + 100));
  }

  await supabase.from("projects").delete().eq("id", id);

  revalidatePath("/office/projects");
  revalidatePath("/office");
  redirect("/office/projects");
}

// --- Phase 8: project structure (blocks + stages) ---------------------------

// Office defines a building block and its unit range, then seeds the default
// construction stages onto it. Office/pm only.
export async function createProjectBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId || !name) return;

  const supabase = await createClient();
  const { data: block } = await supabase
    .from("project_blocks")
    .insert({
      project_id: projectId,
      name,
      unit_from: String(formData.get("unit_from") ?? "").trim() || null,
      unit_to: String(formData.get("unit_to") ?? "").trim() || null,
      unit_count: parseCount(formData.get("unit_count")),
    })
    .select("id")
    .single();

  // Seed both trackers: the default stages (binary, editable) and the fixed A–L
  // progress items (unit-tracked). Office can prune afterwards.
  if (block) {
    await supabase.from("block_stages").insert(
      DEFAULT_STAGES.map((name, i) => ({
        block_id: block.id,
        name,
        sort_order: i,
        is_custom: false,
      })),
    );
    await supabase.from("block_progress_items").insert(
      progressSeedRows().map((r) => ({
        block_id: block.id,
        category: r.category,
        name: r.name,
        sort_order: r.sort_order,
      })),
    );
  }

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/stages`);
  revalidatePath(`/app/projects/${projectId}/progress`);
}

// Office edits a block's name / unit range. Office/pm only.
export async function updateProjectBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("block_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase
    .from("project_blocks")
    .update({
      name,
      unit_from: String(formData.get("unit_from") ?? "").trim() || null,
      unit_to: String(formData.get("unit_to") ?? "").trim() || null,
      unit_count: parseCount(formData.get("unit_count")),
    })
    .eq("id", id);

  // Backfill the A–L progress items for blocks created before the template
  // existed (so editing an old block populates its Progress tracker).
  const { count } = await supabase
    .from("block_progress_items")
    .select("id", { count: "exact", head: true })
    .eq("block_id", id);
  if (!count) {
    await supabase.from("block_progress_items").insert(
      progressSeedRows().map((r) => ({
        block_id: id,
        category: r.category,
        name: r.name,
        sort_order: r.sort_order,
      })),
    );
  }

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/stages`);
  revalidatePath(`/app/projects/${projectId}/progress`);
}

// Office deletes a block (stages + progress items cascade). Office/pm only.
export async function deleteProjectBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("block_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_blocks").delete().eq("id", id);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/stages`);
  revalidatePath(`/app/projects/${projectId}/progress`);
}

// Office attaches reference photo(s) to a PROJECT (binaries already uploaded to
// Storage client-side via PhotoCapture). Shown atop the site's Progress/Stages
// screens. Office/pm only.
export async function addProjectRefPhoto(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return;

  const photoPaths = formData.getAll("photo_path").map(String).filter(Boolean);
  if (photoPaths.length === 0) return;
  const photoTakenAt = formData.getAll("photo_taken_at").map(String);
  const photoLat = formData.getAll("photo_lat").map(String);
  const photoLng = formData.getAll("photo_lng").map(String);

  const supabase = await createClient();
  await supabase.from("photos").insert(
    photoPaths.map((path, i) => ({
      project_id: projectId,
      is_project_ref: true,
      storage_path: path,
      taken_at: photoTakenAt[i] || null,
      gps_lat: parseCoord(photoLat[i] ?? null),
      gps_lng: parseCoord(photoLng[i] ?? null),
      uploaded_by: profile.id,
    })),
  );

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/progress`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

// Office removes a project reference photo (Storage file + row). Office/pm only.
// Office deletes a photo attached to a progress item / stage (storage + row).
// Any office-capable member; RLS (photos_delete_member) also requires membership.
export async function deleteStructurePhoto(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.can_office) return;

  const photoId = String(formData.get("photo_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!photoId) return;

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (photo?.storage_path) {
    await supabase.storage.from("site-photos").remove([photo.storage_path]);
  }
  await supabase.from("photos").delete().eq("id", photoId);

  revalidatePath(`/office/projects/${projectId}/progress`);
  revalidatePath(`/office/projects/${projectId}/stages`);
  revalidatePath(`/app/projects/${projectId}/progress`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

export async function deleteProjectRefPhoto(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const photoId = String(formData.get("photo_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!photoId) return;

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (photo?.storage_path) {
    await supabase.storage.from("site-photos").remove([photo.storage_path]);
  }
  await supabase.from("photos").delete().eq("id", photoId);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/progress`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

// Add a stage / custom item to a block. Any project member (office extends the
// template; site adds extras like painting/fencing). is_custom marks site extras.
export async function addBlockStage(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const blockId = String(formData.get("block_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!blockId || !name) return;
  const isOffice = profile.role === "pm" || profile.role === "office";

  const supabase = await createClient();
  // Append after the current last stage on this block.
  const { data: last } = await supabase
    .from("block_stages")
    .select("sort_order")
    .eq("block_id", blockId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("block_stages").insert({
    block_id: blockId,
    name,
    sort_order: (last?.sort_order ?? -1) + 1,
    is_custom: !isOffice,
  });

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

// Toggle a stage complete / not complete. Any project member — site marks
// progress directly, no approval. Pass `done=1` to complete, else it clears.
export async function setStageComplete(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const stageId = String(formData.get("stage_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!stageId) return;
  const done = String(formData.get("done") ?? "") === "1";

  const supabase = await createClient();
  const { data: stageRow } = await supabase
    .from("block_stages")
    .select("name")
    .eq("id", stageId)
    .maybeSingle();
  await supabase
    .from("block_stages")
    .update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? user.id : null,
    })
    .eq("id", stageId);

  // Optional photo when marking complete (documents the finished stage).
  if (done) {
    await attachSubmissionPhotos(supabase, formData, projectId, user.id, {
      column: "block_stage_id",
      id: stageId,
    });
  }

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: done ? "stage.complete" : "stage.reopen",
    entityType: "stage",
    entityId: stageId,
    detail: (stageRow as { name: string } | null)?.name ?? null,
  });

  revalidatePath(`/app/projects/${projectId}/stages`);
  revalidatePath(`/office/projects/${projectId}`);
}

// --- Phase 8 redesign: unit-tracked Progress --------------------------------

// Site reports how many units of a block are done for a progress item. Value is
// CUMULATIVE (the running total done so far — latest submission wins, e.g. 4
// then 8 → 8), clamped to the block's unit_count. Any project member; no
// approval. Optional photo attaches to the item.
export async function submitProgress(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const itemId = String(formData.get("item_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!itemId) return;
  let unitsDone = parseCount(formData.get("units_done"));
  if (unitsDone == null) return;

  const supabase = await createClient();

  // Clamp to the block's unit_count (can't complete more units than exist).
  const { data: item } = await supabase
    .from("block_progress_items")
    .select("block_id, category, name, project_blocks(unit_count)")
    .eq("id", itemId)
    .maybeSingle();
  const itemRow = item as unknown as {
    category: string;
    name: string | null;
    project_blocks?: { unit_count: number | null };
  } | null;
  const cap = itemRow?.project_blocks?.unit_count;
  if (cap != null && unitsDone > cap) unitsDone = cap;

  await supabase
    .from("block_progress_items")
    .update({ units_done: unitsDone, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  await attachSubmissionPhotos(supabase, formData, projectId, user.id, {
    column: "progress_item_id",
    id: itemId,
  });

  await logActivity(supabase, {
    projectId,
    actorId: user.id,
    action: "progress.submit",
    entityType: "progress",
    entityId: itemId,
    detail: itemRow
      ? `${progressItemLabel(itemRow.category, itemRow.name)} ${unitsDone}/${cap ?? "—"}`
      : null,
  });

  revalidatePath(`/app/projects/${projectId}/progress`);
  revalidatePath(`/office/projects/${projectId}`);
}

// Office marks the Progress / Stages summary as seen, clearing the "New" badge
// until the site submits again. Office/pm only. (Per-project, not per-user.)
async function markStructureSeen(
  projectId: string,
  column: "progress_seen_at" | "stages_seen_at",
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;
  if (!projectId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ [column]: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath(`/office/projects/${projectId}`);
}

export async function markProgressSeen(projectId: string): Promise<void> {
  await markStructureSeen(projectId, "progress_seen_at");
}

export async function markStagesSeen(projectId: string): Promise<void> {
  await markStructureSeen(projectId, "stages_seen_at");
}

// Office/pm renames a project.
export async function updateProjectName(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase.from("projects").update({ name }).eq("id", id);

  revalidatePath(`/office/projects/${id}`);
  revalidatePath("/office/projects");
  revalidatePath("/office");
}

// Delete a stage. Office/pm can delete any; site members may delete only their
// own custom extras (not the office template stages).
export async function deleteBlockStage(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const stageId = String(formData.get("stage_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!stageId) return;
  const isOffice = profile.role === "pm" || profile.role === "office";

  const supabase = await createClient();
  if (!isOffice) {
    const { data: stage } = await supabase
      .from("block_stages")
      .select("is_custom")
      .eq("id", stageId)
      .maybeSingle();
    if (!stage?.is_custom) return; // site can't delete office template stages
  }
  await supabase.from("block_stages").delete().eq("id", stageId);

  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

// --- Office structure TEMPLATE editing (applies to ALL blocks) ---------------
// Every block in a project is seeded with an identical template, so the office
// edits the shared template once and the change fans out to every block,
// matching progress items by (category, name) and stages by name.

// Office/pm guard + the project's block IDs. Returns null when not allowed or no
// blocks (caller should no-op). Revalidation is left to each action.
async function officeProjectBlockIds(
  projectId: string,
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; ids: string[] } | null> {
  if (!isSupabaseConfigured) return null;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return null;
  if (!projectId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_blocks")
    .select("id")
    .eq("project_id", projectId);
  const ids = (data ?? []).map((b) => b.id as string);
  if (ids.length === 0) return null;
  return { supabase, ids };
}

function revalidateStructure(projectId: string): void {
  revalidatePath(`/office/projects/${projectId}`);
  revalidatePath(`/office/projects/${projectId}/progress`);
  revalidatePath(`/office/projects/${projectId}/stages`);
  revalidatePath(`/office/projects/${projectId}/structure`);
  revalidatePath(`/app/projects/${projectId}/progress`);
  revalidatePath(`/app/projects/${projectId}/stages`);
}

// Rename a progress category heading (e.g. "C. RC FRAME" → "C. CONCRETE FRAME")
// across every block in the project.
export async function renameProgressCategory(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const oldCategory = String(formData.get("old_category") ?? "");
  const newCategory = String(formData.get("category") ?? "").trim();
  if (!oldCategory || !newCategory) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;
  await ctx.supabase
    .from("block_progress_items")
    .update({ category: newCategory })
    .in("block_id", ctx.ids)
    .eq("category", oldCategory);
  revalidateStructure(projectId);
}

// Rename a progress item (sub) within a category across every block.
export async function renameProgressItem(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const oldName = String(formData.get("old_name") ?? "");
  const newName = String(formData.get("name") ?? "").trim();
  if (!category || !oldName || !newName) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;
  await ctx.supabase
    .from("block_progress_items")
    .update({ name: newName })
    .in("block_id", ctx.ids)
    .eq("category", category)
    .eq("name", oldName);
  revalidateStructure(projectId);
}

// Add a progress item to every block. An empty name creates a category-only
// leaf (name = null). Appended after the current max sort_order so it joins its
// category group (group-by-key) on display.
export async function addProgressItem(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  if (!category) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;

  const { data: maxRow } = await ctx.supabase
    .from("block_progress_items")
    .select("sort_order")
    .in("block_id", ctx.ids)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  await ctx.supabase.from("block_progress_items").insert(
    ctx.ids.map((blockId) => ({
      block_id: blockId,
      category,
      name,
      sort_order: sortOrder,
    })),
  );
  revalidateStructure(projectId);
}

// Delete a progress item (by category + name; omit name to match the
// category-only leaf) from every block.
export async function deleteProgressItem(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!category) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;
  let q = ctx.supabase
    .from("block_progress_items")
    .delete()
    .in("block_id", ctx.ids)
    .eq("category", category);
  q = name ? q.eq("name", name) : q.is("name", null);
  await q;
  revalidateStructure(projectId);
}

// Rename a stage across every block (matched by current name).
export async function renameStageTemplate(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const oldName = String(formData.get("old_name") ?? "");
  const newName = String(formData.get("name") ?? "").trim();
  if (!oldName || !newName) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;
  await ctx.supabase
    .from("block_stages")
    .update({ name: newName })
    .in("block_id", ctx.ids)
    .eq("name", oldName);
  revalidateStructure(projectId);
}

// Add a stage to every block (appended after the current max sort_order).
export async function addStageTemplate(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;

  const { data: maxRow } = await ctx.supabase
    .from("block_stages")
    .select("sort_order")
    .in("block_id", ctx.ids)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  await ctx.supabase.from("block_stages").insert(
    ctx.ids.map((blockId) => ({
      block_id: blockId,
      name,
      sort_order: sortOrder,
      is_custom: false,
    })),
  );
  revalidateStructure(projectId);
}

// Delete a stage across every block (matched by name).
export async function deleteStageTemplate(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!name) return;
  const ctx = await officeProjectBlockIds(projectId);
  if (!ctx) return;
  await ctx.supabase
    .from("block_stages")
    .delete()
    .in("block_id", ctx.ids)
    .eq("name", name);
  revalidateStructure(projectId);
}

// --- Admin: user management -------------------------------------------------

type AccessChoice = "office" | "site" | "both";

// Map an access choice to the access flags + a sensible default role.
function accessToFlags(access: AccessChoice): {
  can_office: boolean;
  can_site: boolean;
  role: "supervisor" | "office";
} {
  if (access === "office") return { can_office: true, can_site: false, role: "office" };
  if (access === "site") return { can_office: false, can_site: true, role: "supervisor" };
  return { can_office: true, can_site: true, role: "office" }; // both
}

export type CreateUserState =
  | { ok: true; username: string }
  | {
      error:
        | "not-admin"
        | "validation"
        | "exists"
        | "signup"
        | "save"
        | "not-configured";
      detail?: string;
    }
  | undefined;

// Admin creates a login. Uses Supabase's normal signup (anon key — NO service
// role key, which must never reach the web app); the handle_new_user trigger
// creates the profile, then we set the access flags + role as admin (RLS
// profiles_update_admin). Requires "Enable signups" ON in Supabase Auth.
export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  if (!isSupabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY)
    return { error: "not-configured" };
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) return { error: "not-admin" };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const accessRaw = String(formData.get("access") ?? "");
  const access: AccessChoice =
    accessRaw === "office" || accessRaw === "site" || accessRaw === "both"
      ? accessRaw
      : "site";

  // Username: letters/digits/._- only; password min length.
  if (!/^[a-z0-9._-]{3,}$/.test(username) || password.length < 6)
    return { error: "validation" };

  const supabase = await createClient();

  // Reject a username already taken (admin can read all profiles via RLS).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { error: "exists" };

  // Create the auth user without touching the admin's session.
  const email = usernameToEmail(username);
  const anon = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signUp, error: signUpErr } = await anon.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (signUpErr || !signUp.user)
    return { error: "signup", detail: signUpErr?.message };

  // Set access + role on the freshly-created profile (trigger already inserted it).
  const flags = accessToFlags(access);
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      role: flags.role,
      can_office: flags.can_office,
      can_site: flags.can_site,
      full_name: fullName,
    })
    .eq("id", signUp.user.id);
  if (updErr) return { error: "save", detail: updErr.message };

  revalidatePath("/office/users");
  return { ok: true, username };
}

// Admin changes an existing user's access (office / site / both).
export async function setUserAccess(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) return;

  const userId = String(formData.get("user_id") ?? "");
  const accessRaw = String(formData.get("access") ?? "");
  if (!userId) return;
  const access: AccessChoice =
    accessRaw === "office" || accessRaw === "site" || accessRaw === "both"
      ? accessRaw
      : "site";

  const flags = accessToFlags(access);
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ can_office: flags.can_office, can_site: flags.can_site })
    .eq("id", userId);

  revalidatePath("/office/users");
}

// Admin edits a user's login username (rewrites the synthetic email + profile).
// Calls the security-definer admin_set_username (admin-checked in the DB).
export async function setUserUsername(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) return;

  const userId = String(formData.get("user_id") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!userId || !/^[a-z0-9._-]{3,}$/.test(username)) return;

  const supabase = await createClient();
  await supabase.rpc("admin_set_username", { target: userId, new_username: username });
  revalidatePath("/office/users");
}

// Admin resets a user's password (security-definer admin_set_password).
export async function setUserPassword(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) return;

  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId || password.length < 6) return;

  const supabase = await createClient();
  await supabase.rpc("admin_set_password", { target: userId, new_password: password });
  revalidatePath("/office/users");
}

// Admin deletes a user (security-definer admin_delete_user; cascades their data).
export async function deleteUser(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) return;

  const userId = String(formData.get("user_id") ?? "");
  if (!userId || userId === profile.id) return;

  const supabase = await createClient();
  await supabase.rpc("admin_delete_user", { target: userId });
  revalidatePath("/office/users");
}
