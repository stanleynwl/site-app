"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Wraps a useActionState dispatch with offline detection. When the form is
// submitted while offline (navigator.onLine === false), the FormData is stored
// and a banner is shown. When the `online` event fires the stored FormData is
// re-dispatched automatically.
export function useRetryOnReconnect(dispatch: (formData: FormData) => void): {
  handleSubmit: (formData: FormData) => void;
  offlinePending: boolean;
} {
  const lastDataRef = useRef<FormData | null>(null);
  const offlinePendingRef = useRef(false);
  const [offlinePending, setOfflinePending] = useState(false);
  // Keep dispatchRef current without reattaching the online listener each render.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const markOffline = useCallback((v: boolean) => {
    offlinePendingRef.current = v;
    setOfflinePending(v);
  }, []);

  const handleSubmit = useCallback(
    (formData: FormData) => {
      lastDataRef.current = formData;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        markOffline(true);
        return;
      }
      markOffline(false);
      dispatchRef.current(formData);
    },
    [markOffline],
  );

  // Auto-retry once when the browser comes back online.
  useEffect(() => {
    const retry = () => {
      if (offlinePendingRef.current && lastDataRef.current) {
        offlinePendingRef.current = false;
        setOfflinePending(false);
        dispatchRef.current(lastDataRef.current);
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []); // stable — uses refs throughout

  return { handleSubmit, offlinePending };
}
