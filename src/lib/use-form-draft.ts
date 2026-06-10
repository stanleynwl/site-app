"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";

const DEBOUNCE_MS = 500;

type DraftMeta = { savedAt: number };

// T is the shape of draft data. Photo blobs are NOT persisted here — those live
// in the photo queue. Blobs can't be JSON-serialised cleanly; keep drafts small.
export function useFormDraft<T>(
  key: string,
  onRestore: (data: T) => void,
): {
  // True after the initial IndexedDB read completes. Block auto-saves until
  // isReady to avoid a race where the first render overwrites a valid draft.
  isReady: boolean;
  isDraftRestored: boolean;
  saveDraft: (data: T) => void;
  clearDraft: () => void;
} {
  const [isReady, setIsReady] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<{ data: T; meta: DraftMeta }>(key).then((stored) => {
      if (cancelled) return;
      if (stored) {
        onRestore(stored.data);
        setIsDraftRestored(true);
      }
      setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
    // onRestore must be stable (wrapped in useCallback by caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const saveDraft = useCallback(
    (data: T) => {
      latestDataRef.current = data;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const payload = { data: latestDataRef.current as T, meta: { savedAt: Date.now() } };
        set(key, payload).catch(() => {});
      }, DEBOUNCE_MS);
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    del(key).catch(() => {});
    setIsDraftRestored(false);
  }, [key]);

  return { isReady, isDraftRestored, saveDraft, clearDraft };
}
