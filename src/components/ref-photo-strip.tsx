import type { RefPhoto } from "@/lib/data/structure";

// Project reference photos shown atop the site Progress / Stages screens so the
// supervisor sees what the project looks like while submitting. Plain markup
// (no interactivity) — renders nothing when there are no usable photos.
export function RefPhotoStrip({ photos }: { photos: RefPhoto[] }) {
  const usable = photos.filter((p) => p.url);
  if (usable.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {usable.map((p) => (
        <a key={p.id} href={p.url!} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url!}
            alt=""
            className="h-28 w-28 rounded-lg object-cover"
          />
        </a>
      ))}
    </div>
  );
}
