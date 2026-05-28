"use client";

import { useTranslations } from "next-intl";

// Triggers the browser print dialog (→ "Save as PDF"). Hidden in the printout
// itself via the .no-print rule in globals.css.
export function PrintButton() {
  const t = useTranslations("Pdf");
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
    >
      {t("printSave")}
    </button>
  );
}
