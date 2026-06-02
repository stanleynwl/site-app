"use client";

import {
  createContext,
  useContext,
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

// Per-delivery thumbnail grid with selection checkboxes — no buttons.
export function DeliveryThumbs({ photos }: { photos: DownloadablePhoto[] }) {
  const { selected, toggle } = useDownloadCtx();
  const usable = photos.filter((p) => p.downloadUrl);
  if (usable.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {usable.map((p) => (
        <label key={p.id} className="relative cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggle(p.id)}
            className="absolute left-1 top-1 h-4 w-4"
          />
          {p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.url}
              alt=""
              className={`h-20 w-20 rounded-lg object-cover ${
                selected.has(p.id) ? "ring-2 ring-blue-500" : ""
              }`}
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-black/5 text-[10px] dark:bg-white/10">
              ?
            </span>
          )}
        </label>
      ))}
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
