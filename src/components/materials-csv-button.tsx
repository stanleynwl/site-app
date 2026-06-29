"use client";

import { useTranslations } from "next-intl";

// Download a CSV built entirely on the client from rows the server already
// flattened. No route handler needed — the office is on a desktop browser.
export function MaterialsCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: string[][];
}) {
  const t = useTranslations("Materials");

  const download = () => {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers, ...rows].map((r) => r.map(esc).join(","));
    // Prepend a BOM so Excel opens UTF-8 (material/spec) correctly.
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium disabled:opacity-40 dark:border-white/25"
    >
      {t("downloadCsv")}
    </button>
  );
}
