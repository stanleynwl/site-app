"use client";

// Small client helpers for office report pages: a Print button (uses the
// existing @media print rules that hide the sidebar) and a CSV download that
// turns a server-prepared CSV string into a file.

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn">
      {label}
    </button>
  );
}

export function CsvButton({
  csv,
  filename,
  label,
}: {
  csv: string;
  filename: string;
  label: string;
}) {
  const onClick = () => {
    // Prepend a BOM so Excel reads UTF-8 (worker names may be non-Latin).
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={onClick} className="btn">
      {label}
    </button>
  );
}
