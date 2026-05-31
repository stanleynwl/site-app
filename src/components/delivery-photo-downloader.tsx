"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type DownloadablePhoto = {
  id: string;
  url: string | null; // viewable (thumbnail)
  downloadUrl: string | null; // force-download signed URL
};

// Office reviews a delivery's DO photos and downloads all or a selected few.
// Uses pre-signed force-download URLs; triggers a temporary <a download> per
// photo (small stagger so browsers don't drop concurrent downloads). No zip dep.
export function DeliveryPhotoDownloader({ photos }: { photos: DownloadablePhoto[] }) {
  const t = useTranslations("Deliveries");
  const usable = photos.filter((p) => p.downloadUrl);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (usable.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download(list: DownloadablePhoto[]) {
    for (let i = 0; i < list.length; i++) {
      const url = list[i].downloadUrl;
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Small stagger so the browser doesn't suppress rapid downloads.
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
  }

  const selectedPhotos = usable.filter((p) => selected.has(p.id));

  return (
    <div className="space-y-2">
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download(usable)}
          className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25"
        >
          {t("downloadAll")} ({usable.length})
        </button>
        <button
          type="button"
          onClick={() => download(selectedPhotos)}
          disabled={selectedPhotos.length === 0}
          className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium disabled:opacity-40 dark:border-white/25"
        >
          {t("downloadSelected")} ({selectedPhotos.length})
        </button>
      </div>
    </div>
  );
}
