"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

export type DownloadablePhoto = {
  id: string;
  url: string | null; // viewable (thumbnail)
  downloadUrl: string | null; // force-download signed URL
};

// Selection is shared across the whole deliveries section so the office can tick
// thumbnails under each DO row but download from ONE pair of section-level
// buttons (instead of a button per DO column).
type DownloadCtx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  allPhotos: DownloadablePhoto[];
};

const Ctx = createContext<DownloadCtx | null>(null);

function useDownloadCtx(): DownloadCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("Delivery download components must be inside DeliveryDownloadProvider");
  }
  return ctx;
}

export function DeliveryDownloadProvider({
  allPhotos,
  children,
}: {
  allPhotos: DownloadablePhoto[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return <Ctx.Provider value={{ selected, toggle, allPhotos }}>{children}</Ctx.Provider>;
}

// Uses pre-signed force-download URLs; triggers a temporary <a download> per
// photo (small stagger so browsers don't drop concurrent downloads). No zip dep.
async function triggerDownloads(list: DownloadablePhoto[]) {
  for (let i = 0; i < list.length; i++) {
    const url = list[i].downloadUrl;
    if (!url) continue;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
}

// Per-delivery thumbnail grid: corner checkbox selects; clicking the image
// opens a full-size lightbox (Esc / arrows to navigate within this DO's photos).
export function DeliveryThumbs({ photos }: { photos: DownloadablePhoto[] }) {
  const { selected, toggle } = useDownloadCtx();
  const usable = photos.filter((p) => p.downloadUrl);
  const viewable = usable.filter((p) => p.url);
  const [lb, setLb] = useState<number | null>(null);

  const close = useCallback(() => setLb(null), []);
  const step = useCallback(
    (d: number) =>
      setLb((i) => (i == null ? i : (i + d + viewable.length) % viewable.length)),
    [viewable.length],
  );
  useEffect(() => {
    if (lb == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, close, step]);

  if (usable.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {usable.map((p) => (
        <div key={p.id} className="relative">
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggle(p.id)}
            aria-label="Select photo"
            className="absolute left-1 top-1 z-10 h-4 w-4 cursor-pointer"
          />
          {p.url ? (
            <button
              type="button"
              onClick={() => setLb(viewable.findIndex((v) => v.id === p.id))}
              title="Click to enlarge"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className={`h-20 w-20 rounded-lg object-cover transition hover:opacity-90 ${
                  selected.has(p.id) ? "ring-2 ring-blue-500" : ""
                }`}
              />
            </button>
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-black/5 text-[10px] dark:bg-white/10">
              ?
            </span>
          )}
        </div>
      ))}

      {lb != null && viewable[lb] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white hover:bg-white/25"
          >
            ✕
          </button>
          {viewable.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Previous"
              className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
            >
              ‹
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewable[lb].url!}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain"
          />
          {viewable.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Next"
              className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
            >
              ›
            </button>
          )}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {lb + 1} / {viewable.length}
          </span>
        </div>
      )}
    </div>
  );
}

// Section-level controls: download every DO photo, or just the selected ones.
export function DeliveryDownloadButtons() {
  const t = useTranslations("Deliveries");
  const { selected, allPhotos } = useDownloadCtx();
  const usable = allPhotos.filter((p) => p.downloadUrl);
  if (usable.length === 0) return null;
  const selectedPhotos = usable.filter((p) => selected.has(p.id));

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => triggerDownloads(usable)}
        className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25"
      >
        {t("downloadAll")} ({usable.length})
      </button>
      <button
        type="button"
        onClick={() => triggerDownloads(selectedPhotos)}
        disabled={selectedPhotos.length === 0}
        className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium disabled:opacity-40 dark:border-white/25"
      >
        {t("downloadSelected")} ({selectedPhotos.length})
      </button>
    </div>
  );
}
