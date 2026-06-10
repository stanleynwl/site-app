"use client";

// IndexedDB-backed photo upload queue.
// Each entry holds the compressed blob in IDB so it survives a tab kill.
// A global runner uploads entries sequentially with exponential back-off and
// retries automatically when the browser comes back online.

import { createStore, get, set, del, entries, update } from "idb-keyval";
import { createClient } from "@/lib/supabase/client";

export type PhotoStatus = "queued" | "uploading" | "done" | "failed";

export type QueueEntry = {
  id: string;
  blob: Blob;
  path: string;
  takenAt: string | null;
  lat: number | null;
  lng: number | null;
  status: PhotoStatus;
  attempts: number;
};

const BUCKET = "site-photos";
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000;

// Separate IDB store so queue entries don't collide with draft keys.
const queueStore = createStore("photo-queue-db", "photo-queue");

// In-memory subscriber for UI updates. The queue lives in IDB; this map lets
// components react to status changes without polling IDB.
type Listener = (entries: QueueEntry[]) => void;
const listeners = new Set<Listener>();

function notifyAll(all: QueueEntry[]) {
  for (const l of listeners) l(all);
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  // Immediately emit current state.
  getAllEntries().then(notifyAll);
  return () => listeners.delete(fn);
}

async function getAllEntries(): Promise<QueueEntry[]> {
  const pairs = await entries<string, QueueEntry>(queueStore);
  return pairs.map(([, v]) => v);
}

async function writeEntry(e: QueueEntry) {
  await set(e.id, e, queueStore);
  notifyAll(await getAllEntries());
}

export async function removeEntry(id: string) {
  await del(id, queueStore);
  notifyAll(await getAllEntries());
}

// Enqueue a photo. Returns the entry id so the caller can track it.
export async function enqueuePhoto(
  blob: Blob,
  path: string,
  takenAt: string | null,
  lat: number | null,
  lng: number | null,
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: QueueEntry = {
    id,
    blob,
    path,
    takenAt,
    lat,
    lng,
    status: "queued",
    attempts: 0,
  };
  await writeEntry(entry);
  scheduleRun();
  return id;
}

// Singleton runner state.
let running = false;

function scheduleRun() {
  if (!running) runQueue();
}

async function runQueue() {
  running = true;
  try {
    const all = await getAllEntries();
    const pending = all.filter((e) => e.status === "queued" || e.status === "failed");
    for (const entry of pending) {
      if (!navigator.onLine) break;
      await uploadEntry(entry);
    }
  } finally {
    running = false;
  }
}

async function uploadEntry(entry: QueueEntry) {
  const updated: QueueEntry = { ...entry, status: "uploading" };
  await writeEntry(updated);

  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(entry.path, entry.blob, { contentType: "image/jpeg", upsert: true });

    if (error) throw error;

    await writeEntry({ ...updated, status: "done", attempts: entry.attempts + 1 });
  } catch {
    const attempts = entry.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await writeEntry({ ...updated, status: "failed", attempts });
    } else {
      // Back off before next retry — but don't block the runner loop.
      const delay = BASE_DELAY_MS * Math.pow(2, attempts - 1);
      await writeEntry({ ...updated, status: "failed", attempts });
      setTimeout(() => {
        if (navigator.onLine) runQueue();
      }, delay);
    }
  }
}

// Auto-retry when network reconnects.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    scheduleRun();
  });
}
