"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "site-photos";
const MAX_EDGE = 1600; // longest-edge px after compression
const JPEG_QUALITY = 0.8;

type UploadedPhoto = {
  path: string;
  previewUrl: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
};

// Resize + re-encode a captured image to a compact JPEG via canvas. Strips EXIF
// (so GPS is captured separately, best-effort, via the Geolocation API).
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("compression failed");
  return blob;
}

// Best-effort device location at capture time. Resolves null if denied/unavailable.
function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
    );
  });
}

export function PhotoCapture({
  projectId,
  month,
}: {
  projectId: string;
  month: string; // YYYY-MM
}) {
  const t = useTranslations("Deliveries");
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(false);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      try {
        const [blob, gps] = await Promise.all([compress(file), getGps()]);
        const path = `photos/${month}/${projectId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) {
          setError(true);
          continue;
        }
        setPhotos((prev) => [
          ...prev,
          {
            path,
            previewUrl: URL.createObjectURL(blob),
            taken_at: new Date(file.lastModified).toISOString(),
            lat: gps?.lat ?? null,
            lng: gps?.lng ?? null,
          },
        ]);
      } catch {
        setError(true);
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(path: string) {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    // Note: the uploaded object is left in storage; office/cleanup can prune
    // orphans. Keeping this simple for v1.
  }

  return (
    <div className="space-y-2">
      {/* Hidden inputs so photos submit with the delivery form */}
      {photos.map((p) => (
        <div key={p.path}>
          <input type="hidden" name="photo_path" value={p.path} />
          <input type="hidden" name="photo_taken_at" value={p.taken_at ?? ""} />
          <input type="hidden" name="photo_lat" value={p.lat ?? ""} />
          <input type="hidden" name="photo_lng" value={p.lng ?? ""} />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.path} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.previewUrl}
              alt=""
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => remove(p.path)}
              aria-label={t("removePhoto")}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* No `capture` attribute: phones then offer a chooser (take a new photo
          OR pick an existing one from the gallery) — supervisors often shoot a
          photo earlier and submit it later. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/25"
      >
        {busy ? t("uploading") : photos.length ? t("addPhoto") : t("takePhoto")}
      </button>

      {error && <p className="text-sm text-red-600">{t("photoError")}</p>}
    </div>
  );
}
