"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export type NotifItem = {
  id: string;
  action: string;
  detail: string | null;
  actor_name: string;
  project_name?: string | null;
  created_at: string;
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Office notification bell. Shows a count of activity newer than the last time
 * this device opened the panel (kept in localStorage). Polls a JSON endpoint
 * for fresh items and, if the user opts in, raises a desktop notification when
 * something new lands. Used by both SiteApp office and the local office app.
 */
export function NotificationBell({
  initial,
  labels,
  pollUrl,
  viewAllHref,
  seenKey,
  pollMs = 45000,
  align = "right",
  strings,
}: {
  initial: NotifItem[];
  labels: Record<string, string>;
  pollUrl: string;
  viewAllHref: string;
  seenKey: string;
  pollMs?: number;
  // Which edge the dropdown anchors to. Use "left" when the bell is on the left
  // (e.g. a left sidebar) so the panel opens rightward and stays on screen.
  align?: "left" | "right";
  strings: {
    title: string;
    viewAll: string;
    empty: string;
    enableAlerts: string;
    alertsOn: string;
  };
}) {
  const [items, setItems] = useState<NotifItem[]>(initial);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<number>(() => Date.now());
  const [perm, setPerm] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  // Newest item time we've already raised a desktop notification for.
  const notifiedRef = useRef<number>(0);

  const label = useCallback(
    (a: string) => labels[a] ?? a,
    [labels],
  );

  // One-time init from localStorage + Notification support.
  useEffect(() => {
    const raw = localStorage.getItem(seenKey);
    if (raw) {
      setSeen(Number(raw));
    } else {
      localStorage.setItem(seenKey, String(Date.now()));
    }
    notifiedRef.current = initial.reduce(
      (m, it) => Math.max(m, Date.parse(it.created_at)),
      0,
    );
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission as "default" | "granted" | "denied");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for fresh activity; raise desktop notifications for genuinely-new rows.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(pollUrl, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as NotifItem[];
        if (!Array.isArray(data) || !alive) return;
        setItems(data);

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const fresh = data
            .filter((it) => Date.parse(it.created_at) > notifiedRef.current)
            .slice(0, 4);
          for (const it of fresh) {
            new Notification(strings.title, {
              body: `${it.actor_name} ${label(it.action)}${it.detail ? ` · ${it.detail}` : ""}`,
              tag: it.id,
            });
          }
          notifiedRef.current = data.reduce(
            (m, it) => Math.max(m, Date.parse(it.created_at)),
            notifiedRef.current,
          );
        }
      } catch {
        /* offline / transient — ignore, try again next tick */
      }
    };
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollUrl, pollMs, label, strings.title]);

  const unread = items.filter((it) => Date.parse(it.created_at) > seen).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening clears the badge — mark everything up to now as seen.
      const now = Date.now();
      localStorage.setItem(seenKey, String(now));
      setSeen(now);
    }
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p as "default" | "granted" | "denied");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={strings.title}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)] ${
              align === "left" ? "left-0" : "right-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-semibold">{strings.title}</span>
              {perm === "granted" ? (
                <span className="badge badge-success">{strings.alertsOn}</span>
              ) : perm === "default" ? (
                <button
                  type="button"
                  onClick={enableAlerts}
                  className="text-xs text-accent hover:underline"
                >
                  {strings.enableAlerts}
                </button>
              ) : null}
            </div>

            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted">{strings.empty}</li>
              ) : (
                items.slice(0, 15).map((it) => {
                  const isNew = Date.parse(it.created_at) > seen;
                  return (
                    <li
                      key={it.id}
                      className={`px-3 py-2.5 text-sm ${isNew ? "bg-accent-soft/60" : ""}`}
                    >
                      <div className="leading-snug">
                        <span className="font-medium">{it.actor_name}</span>{" "}
                        <span className="text-muted">{label(it.action)}</span>
                        {it.detail ? <span className="text-muted"> · {it.detail}</span> : null}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted">
                        <span>{it.project_name ?? ""}</span>
                        <time>{fmt(it.created_at)}</time>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="block border-t border-border px-3 py-2.5 text-center text-sm font-medium text-accent hover:bg-foreground/5"
            >
              {strings.viewAll}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
