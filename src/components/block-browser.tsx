"use client";

import { useState, type ReactNode } from "react";

export type BrowserBlock = {
  id: string;
  name: string;
  subtitle?: string | null;
  badge?: string | null; // e.g. "42%" for progress
  content: ReactNode; // server-rendered block body (forms/rows)
};

// Block picker shared by Progress and Stages. Two ways to choose a block —
// tappable chips (toggle) AND a type-to-search box — so the supervisor doesn't
// scroll through every block. Only the selected block's body is rendered.
export function BlockBrowser({
  blocks,
  searchPlaceholder,
}: {
  blocks: BrowserBlock[];
  searchPlaceholder: string;
}) {
  const [selectedId, setSelectedId] = useState(blocks[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? blocks.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.subtitle ?? "").toLowerCase().includes(q),
      )
    : blocks;

  // Selected block: keep the user's pick if still in the filtered set, else fall
  // back to the first match so the body always reflects a visible chip.
  const selected =
    filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />

      <div className="flex flex-wrap gap-2">
        {filtered.map((b) => {
          const active = selected?.id === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              {b.name}
              {b.badge ? (
                <span className={active ? "opacity-80" : "text-black/50 dark:text-white/50"}>
                  {" "}
                  · {b.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? <div key={selected.id}>{selected.content}</div> : null}
    </div>
  );
}
