"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionUser, getProfile } from "@/lib/auth/dal";
import { todayISO, isInSoftEditWindow, normalizeReportDate } from "@/lib/date";
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
  const prId = String(formData.get("purchase_request_id") ?? "");

  const supabase = await createClient();

  const update: Record<string, unknown> = {
    do_quantity: parseQty(formData.get("do_quantity")),
  };
  if (supplierId) update.supplier_id = supplierId;
  if (materialId) update.material_id = materialId;

  // Linking a delivery to a purchase request closes the three-quantity variance
  // loop: pull requested_quantity from the request, and mark the request delivered.
  if (prId) {
    update.purchase_request_id = prId;
    const { data: pr } = await supabase
      .from("purchase_requests")
      .select("quantity")
      .eq("id", prId)
      .maybeSingle();
    if (pr) update.requested_quantity = pr.quantity;
  }

  await supabase.from("deliveries").update(update).eq("id", id);

  if (prId) {
    await supabase
      .from("purchase_requests")
      .update({ status: "delivered" })
      .eq("id", prId);
    revalidatePath("/office/requests");
  }

  revalidatePath(`/office/projects/${projectId}`);
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
  revalidatePath(`/app/projects/${projectId}/deliveries`);
}

// --- Phase 4 purchase requests: capture-only procurement --------------------

export type PurchaseRequestState =
  | { ok: true }
  | { error: "save" | "auth" | "validation" | "not-configured" }
  | undefined;

// Supervisor raises a purchase request (any project member). Material can be a
// catalog pick or free text; quantity / needed-by / urgency are optional.
export async function createPurchaseRequest(
  _prev: PurchaseRequestState,
  formData: FormData,
): Promise<PurchaseRequestState> {
  if (!isSupabaseConfigured) return { error: "not-configured" };
  const user = await getSessionUser();
  if (!user) return { error: "auth" };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "validation" };

  const materialIdRaw = String(formData.get("material_id") ?? "");
  const isOther = materialIdRaw === "" || materialIdRaw === "__other__";
  const materialText = String(formData.get("material_text") ?? "").trim();
  // Require at least a material identity (catalog pick or free text).
  if (isOther && !materialText) return { error: "validation" };

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_requests").insert({
    project_id: projectId,
    material_id: isOther ? null : materialIdRaw,
    material_text: isOther ? materialText : null,
    quantity: parseQty(formData.get("quantity")),
    unit: String(formData.get("unit") ?? "").trim() || null,
    needed_by: String(formData.get("needed_by") ?? "") || null,
    urgency_reason: String(formData.get("urgency_reason") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: user.id,
  });
  if (error) return { error: "save" };

  revalidatePath(`/app/projects/${projectId}/requests`);
  revalidatePath("/office/requests");
  return { ok: true };
}

// Office state-machine transitions (pm/office). Each takes request_id + project_id.
async function updatePurchaseRequest(
  formData: FormData,
  patch: Record<string, unknown>,
): Promise<void> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "pm" && profile.role !== "office") return;

  const id = String(formData.get("request_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("purchase_requests").update(patch).eq("id", id);

  revalidatePath("/office/requests");
  if (projectId) {
    revalidatePath(`/app/projects/${projectId}/requests`);
    revalidatePath(`/office/projects/${projectId}`);
  }
}

export async function approvePurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const profile = await getProfile();
  await updatePurchaseRequest(formData, {
    status: "approved",
    approved_by: profile?.id ?? null,
    approved_at: new Date().toISOString(),
  });
}

export async function rejectPurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const reason = String(formData.get("rejected_reason") ?? "").trim();
  await updatePurchaseRequest(formData, {
    status: "rejected",
    rejected_reason: reason || null,
  });
}

export async function issuePurchaseRequestPO(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const po = String(formData.get("po_number") ?? "").trim();
  if (!po) return; // PO number is the whole point of this step
  const supplierId = String(formData.get("supplier_id") ?? "");
  const patch: Record<string, unknown> = { status: "po_issued", po_number: po };
  if (supplierId) patch.supplier_id = supplierId;
  await updatePurchaseRequest(formData, patch);
}

export async function closePurchaseRequest(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured) return;
  await updatePurchaseRequest(formData, { status: "closed" });
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

    // Machinery — one row per machine + hours; drop empty/zero-hour rows (so two
    // backhoes on different hours are simply two rows).
    const machineTypes = formData.getAll("machinery_type").map(String);
    const machineHours = formData.getAll("machinery_hours").map(String);
    const machinery = machineTypes
      .map((type, i) => ({
        report_id: report.id,
        machine_type: type.trim(),
        hours_worked: parseQty(machineHours[i] ?? null),
      }))
      .filter((row) => row.machine_type !== "" && (row.hours_worked ?? 0) > 0);

    await supabase.from("machinery_entries").delete().eq("report_id", report.id);
    if (machinery.length) {
      await supabase.from("machinery_entries").insert(machinery);
    }

    await supabase.from("issues").delete().eq("report_id", report.id);
    if (issues.length) {
      await supabase.from("issues").insert(issues);
    }
  }

  if (submit) {
    const { error: submitError } = await supabase
      .from("daily_reports")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", report.id);
    if (submitError) return { error: "save" };
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

  revalidatePath(`/office/projects/${report.project_id}`);
  revalidatePath(`/office/projects/${report.project_id}/reports/${reportId}`);
  return { ok: true };
}
