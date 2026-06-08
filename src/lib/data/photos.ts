import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProjectTag } from "./tags";

// Progress photos (Phase 2). These are general project photos (delivery_id IS
// NULL) — distinct from delivery/DO photos. Each can carry taxonomy tags via
// photo_tags. Binaries live in Supabase Storage; signed URLs resolved per view.

const PHOTO_BUCKET = "site-photos";

export type ProjectPhoto = {
  id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  archived_at: string | null;
  tags: ProjectTag[];
  url?: string | null; // resolved signed URL (set by withSignedPhotoUrls)
};

const PHOTO_COLUMNS =
  "id, storage_path, caption, taken_at, created_at, archived_at, photo_tags(project_tags(id, kind, label, approved))";

export async function getProjectPhotos(
  projectId: string,
): Promise<ProjectPhoto[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("project_id", projectId)
    .is("delivery_id", null) // progress photos only — exclude delivery/DO photos
    .is("purchase_request_id", null) // …and exclude purchase-request photos
    .eq("is_project_ref", false) // …and exclude project reference photos
    .is("daily_report_id", null) // …and exclude daily-report photos
    .is("deleted_at", null) // …and exclude soft-deleted (recycle-bin) photos
    .order("created_at", { ascending: false });

  // De-dupe by storage_path: a double-submit can create several rows pointing at
  // the same file, which would otherwise repeat the identical image in exports.
  // Prefer a viewable (non-archived) row over an archived duplicate so a photo
  // never disappears just because an archived dup happened to sort first.
  const byPath = new Map<string, ProjectPhoto>();
  for (const row of data ?? []) {
    const r = row as unknown as {
      id: string;
      storage_path: string;
      caption: string | null;
      taken_at: string | null;
      created_at: string;
      archived_at: string | null;
      photo_tags: { project_tags: ProjectTag | null }[] | null;
    };
    const existing = byPath.get(r.storage_path);
    if (existing && existing.archived_at == null) continue; // keep viewable one
    byPath.set(r.storage_path, {
      id: r.id,
      storage_path: r.storage_path,
      caption: r.caption,
      taken_at: r.taken_at,
      created_at: r.created_at,
      archived_at: r.archived_at,
      tags: (r.photo_tags ?? [])
        .map((pt) => pt.project_tags)
        .filter((x): x is ProjectTag => x != null),
    });
  }
  return [...byPath.values()];
}

// Resolve a short-lived signed URL per photo. Archived photos no longer exist in
// Storage (the file lives in the local archive), so we skip them — mirrors the
// delivery photo behaviour in deliveries.ts.
export async function withSignedPhotoUrls(
  photos: ProjectPhoto[],
): Promise<ProjectPhoto[]> {
  if (!isSupabaseConfigured) return photos;
  const supabase = await createClient();
  return Promise.all(
    photos.map(async (p) => {
      if (p.archived_at != null) return { ...p, url: null };
      const { data } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? null };
    }),
  );
}
