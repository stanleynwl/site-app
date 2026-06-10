"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export type FilterOption = { label: string; value: string };

// A chip strip + optional search box that update URL search params.
// All state lives in the URL so pages stay server-rendered with the filtered set.
export function FilterChips({
  paramKey,
  options,
  label,
  allLabel = "All",
}: {
  paramKey: string;
  options: FilterOption[];
  label: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? "";

  const set = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramKey, value);
      } else {
        params.delete(paramKey);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, paramKey],
  );

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-black/60 dark:text-white/60">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => set("")}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            current === ""
              ? "bg-foreground text-background"
              : "bg-black/5 dark:bg-white/10"
          }`}
        >
          {allLabel}
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => set(current === o.value ? "" : o.value)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              current === o.value
                ? "bg-foreground text-background"
                : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A free-text search box that updates a URL search param.
export function SearchBox({
  paramKey,
  placeholder,
}: {
  paramKey: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? "";

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) {
        params.set(paramKey, e.target.value);
      } else {
        params.delete(paramKey);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, paramKey],
  );

  return (
    <input
      type="search"
      value={current}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-black/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/25 dark:focus:border-white/50"
    />
  );
}
