"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Material } from "@/lib/data/catalog";

// No width here — callers set width (w-full / flex-1 / w-20). Mixing w-full with
// flex-1/w-20 produces conflicting width rules, which squashed the quantity field.
const baseInput =
  "rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

type Row = {
  query: string;
  materialId: string;
  unit: string;
  quantity: string;
  spec: string;
};

const blankRow = (): Row => ({
  query: "",
  materialId: "",
  unit: "",
  quantity: "",
  spec: "",
});

// Repeatable request line items with a type-to-search material picker. Each row
// submits hidden request_material_id (catalog) / request_material_text (free
// text) + request_quantity + request_unit, aligned by DOM order.
export function RequestItemsField({ materials }: { materials: Material[] }) {
  const t = useTranslations("Requests");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("items")}</span>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, blankRow()])}
          className="text-xs underline"
        >
          {t("addItem")}
        </button>
      </div>

      {rows.map((row, i) => {
        const q = row.query.trim().toLowerCase();
        const matches = q
          ? materials.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8)
          : [];
        const showList = openIdx === i && matches.length > 0;
        const isFreeText = row.materialId === "" && row.query.trim() !== "";

        return (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/15"
          >
            <input type="hidden" name="request_material_id" value={row.materialId} />
            <input
              type="hidden"
              name="request_material_text"
              value={row.materialId ? "" : row.query.trim()}
            />

            <div className="relative">
              <input
                value={row.query}
                onChange={(e) => patch(i, { query: e.target.value, materialId: "" })}
                onFocus={() => setOpenIdx(i)}
                onBlur={() =>
                  setTimeout(
                    () => setOpenIdx((o) => (o === i ? null : o)),
                    150,
                  )
                }
                placeholder={t("searchMaterial")}
                autoComplete="off"
                className={`${baseInput} w-full`}
              />
              {showList && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-black/15 bg-background shadow-lg dark:border-white/20">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          patch(i, {
                            query: m.name,
                            materialId: m.id,
                            unit: m.unit ?? "",
                          });
                          setOpenIdx(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {m.name}
                        {m.unit ? ` (${m.unit})` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                name="request_quantity"
                type="number"
                min="0"
                step="0.001"
                value={row.quantity}
                onChange={(e) => patch(i, { quantity: e.target.value })}
                placeholder={t("quantity")}
                className={`${baseInput} min-w-0 flex-1`}
              />
              <input
                name="request_unit"
                value={row.unit}
                onChange={(e) => patch(i, { unit: e.target.value })}
                placeholder={t("unit")}
                className={`${baseInput} w-20 shrink-0`}
              />
              <button
                type="button"
                onClick={() =>
                  setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)))
                }
                disabled={rows.length === 1}
                className="w-5 text-xs text-red-600 disabled:opacity-30"
                aria-label={t("removeItem")}
              >
                ✕
              </button>
            </div>

            {/* Optional free-text size/spec, e.g. timber "12 ft" or "12 ft · 4 tonne". */}
            <input
              name="request_spec"
              value={row.spec}
              onChange={(e) => patch(i, { spec: e.target.value })}
              placeholder={t("specHint")}
              className={`${baseInput} w-full`}
            />

            {isFreeText && (
              <p className="text-xs text-black/40 dark:text-white/40">
                {t("freeTextHint")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
