"use client";

import { useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  enqueuePhoto,
  removeEntry,
  subscribeQueue,
  type QueueEntry,
  type PhotoStatus,
} from "@/lib/photo-queue";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

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

function statusLabel(t: ReturnType<typeof useTranslations>, status: PhotoStatus) {
  switch (status) {
    case "queued":    return t("photoQueued");
    case "uploading": return t("photoUploading");
    case "done":      return t("photoDone");
    case "failed":    return t("photoFailed");
  }
}

function statusColor(status: PhotoStatus) {
  switch (status) {
    case "queued":    return "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60";
    case "uploading": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "done":      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "failed":    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
}

export function PhotoCapture({
  projectId,
  month,
}: {
  projectId: string;
  month: string;
}) {
  const t = useTranslations("Deliveries");
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);

  // IDs enqueued by THIS instance (not other PhotoCapture instances on the page).
  const myIdsRef = useRef<Set<string>>(new Set());

  // Entries from the global queue belonging to this instance.
  const [myEntries, setMyEntries] = useState<QueueEntry[]>([]);

  // Preview object URLs — created at enqueue time, never stored in IDB.
  const previewsRef = useRef<Map<string, string>>(new Map());
  const [, forceRender] = useState(0); // trigger re-render after preview map updates

  // Subscribe to queue once; the callback reads myIdsRef.current so it always
  // sees the latest set without needing to resubscribe on every add.
  useEffect(() => {
    const unsub = subscribeQueue((all) => {
      setMyEntries(all.filter((e) => myIdsRef.current.has(e.id)));
    });
    return unsub;
  }, []);

  // Revoke preview URLs on unmount to avoid leaks.
  useEffect(() => {
    const previews = previewsRef.current;
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAdding(true);
    for (const file of Array.from(files)) {
      try {
        const [blob, gps] = await Promise.all([compress(file), getGps()]);
        const path = `photos/${month}/${projectId}/${crypto.randomUUID()}.jpg`;
        const takenAt = new Date(file.lastModified).toISOString();
        const id = await enqueuePhoto(
          blob,
          path,
          takenAt,
          gps?.lat ?? null,
          gps?.lng ?? null,
        );
        myIdsRef.current = new Set([...myIdsRef.current, id]);
        previewsRef.current.set(id, URL.createObjectURL(blob));
        forceRender((n) => n + 1);
      } catch {
        // Compression failure (very rare) — silently skip.
      }
    }
    setAdding(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove(id: string) {
    myIdsRef.current = new Set([...myIdsRef.current].filter((x) => x !== id));
    const url = previewsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewsRef.current.delete(id);
    }
    await removeEntry(id);
  }

  const pendingCount = myEntries.filter(
    (e) => e.status === "queued" || e.status === "uploading",
  ).length;

  const doneEntries = myEntries.filter((e) => e.status === "done");

  return (
    <div className="space-y-2">
      {/* Hidden inputs — only for uploaded photos */}
      {doneEntries.map((p) => (
        <div key={p.id}>
          <input type="hidden" name="photo_path" value={p.path} />
          <input type="hidden" name="photo_taken_at" value={p.takenAt ?? ""} />
          <input type="hidden" name="photo_lat" value={p.lat ?? ""} />
          <input type="hidden" name="photo_lng" value={p.lng ?? ""} />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {myEntries.map((entry) => {
          const previewUrl = previewsRef.current.get(entry.id);
          return (
            <div key={entry.id} className="relative">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover"
                />
              )}
              {/* Status chip */}
              <span
                className={`absolute bottom-0 left-0 right-0 rounded-b-lg px-1 py-0.5 text-center text-[10px] font-medium ${statusColor(entry.status)}`}
              >
                {statusLabel(t, entry.status)}
              </span>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                aria-label={t("removePhoto")}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

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
        disabled={adding}
        className="min-h-12 rounded-lg border border-black/20 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/25"
      >
        {adding
          ? t("uploading")
          : myEntries.length
            ? t("addPhoto")
            : t("takePhoto")}
      </button>

      {/* Warn if photos are still in-flight */}
      {pendingCount > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("photoStillUploading", { count: pendingCount })}
        </p>
      )}
    </div>
  );
}
