import { getTranslations } from "next-intl/server";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import { createSupplier, createMaterial } from "@/lib/data/actions";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function CatalogPage() {
  const t = await getTranslations("Catalog");
  const [suppliers, materials] = await Promise.all([
    getSuppliers(),
    getMaterials(),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {/* Suppliers ---------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("suppliers")}</h2>

        <form
          action={createSupplier}
          className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-3 dark:border-white/15"
        >
          <p className="text-sm font-semibold sm:col-span-3">{t("newSupplier")}</p>
          <label className="text-sm">
            <span className="mb-1 block">{t("name")}</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("code")}</span>
            <input name="code" className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("phone")}</span>
            <input name="phone" className={inputClass} />
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
              {t("addSupplier")}
            </button>
          </div>
        </form>

        {suppliers.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("noSuppliers")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  {s.code && (
                    <span className="ml-2 text-black/50 dark:text-white/50">{s.code}</span>
                  )}
                  {s.phone && (
                    <span className="ml-2 text-black/50 dark:text-white/50">· {s.phone}</span>
                  )}
                </span>
                {!s.active && (
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {t("inactive")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Materials ---------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("materials")}</h2>

        <form
          action={createMaterial}
          className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-3 dark:border-white/15"
        >
          <p className="text-sm font-semibold sm:col-span-3">{t("newMaterial")}</p>
          <label className="text-sm">
            <span className="mb-1 block">{t("name")}</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("unit")}</span>
            <input name="unit" placeholder={t("unitHint")} className={inputClass} />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              name="count_required"
              className="h-4 w-4"
            />
            <span>{t("countRequired")}</span>
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
              {t("addMaterial")}
            </button>
          </div>
        </form>

        {materials.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("noMaterials")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{m.name}</span>
                  {m.unit && (
                    <span className="ml-2 text-black/50 dark:text-white/50">{m.unit}</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {m.count_required && (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      {t("countRequiredBadge")}
                    </span>
                  )}
                  {!m.active && (
                    <span className="text-xs text-black/40 dark:text-white/40">
                      {t("inactive")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
