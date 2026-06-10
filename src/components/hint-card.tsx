"use client";

import { useEffect, useState } from "react";

// One-time dismissible hint per screen. Persists the dismissed flag in
// localStorage keyed by `id`. Shows nothing until the browser hydrates (avoids
// SSR mismatch). Stanley can add hints per screen by passing a unique `id`.
export function HintCard({
  id,
  children,
  dismissLabel,
}: {
  id: string;
  children: React.ReactNode;
  dismissLabel: string;
}) {
  const storageKey = `siteapp.hint.${id}`;
  const [visible, setVisible] = useState(false);

  // Defer to client — localStorage is unavailable on the server.
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch {
      // Private-mode environments may throw on localStorage access.
    }
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
      <p className="flex-1">{children}</p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg border border-blue-300 px-2 py-0.5 text-xs font-medium dark:border-blue-700"
      >
        {dismissLabel}
      </button>
    </div>
  );
}
