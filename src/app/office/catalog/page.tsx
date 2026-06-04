import { getTranslations } from "next-intl/server";
import { getSuppliers, getMaterials } from "@/lib/data/catalog";
import { getWorkers, getSubcontractors } from "@/lib/data/workers";
import {
  createSupplier,
  createMaterial,
  updateSupplier,
  setSupplierActive,
  updateMaterial,
  setMaterialActive,
  createSubcontractor,
  updateSubcontractor,
  setSubcontractorActive,
  createWorker,
  updateWorker,
  setWorkerActive,
} from "@/lib/data/actions";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const editInput =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const smallBtn =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

export default async function CatalogPage() {
  const t = await getTranslations("Catalog");
  const [suppliers, materials, subcontractors, workers] = await Promise.all([
    getSuppliers(),
    getMaterials(),
    getSubcontractors(),
    getWorkers(),
  ]);
  const activeSubs = subcontractors.filter((s) => s.active);

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
              <li
                key={s.id}
                className={`flex flex-wrap items-end gap-2 px-4 py-3 text-sm ${s.active ? "" : "opacity-50"}`}
              >
                <form action={updateSupplier} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="supplier_id" value={s.id} />
                  <input
                    name="name"
                    defaultValue={s.name}
                    required
                    aria-label={t("name")}
                    className={editInput}
                  />
                  <input
                    name="code"
                    defaultValue={s.code ?? ""}
                    placeholder={t("code")}
                    className={`${editInput} w-24`}
                  />
                  <input
                    name="phone"
                    defaultValue={s.phone ?? ""}
                    placeholder={t("phone")}
                    className={`${editInput} w-32`}
                  />
                  <button className={smallBtn}>{t("save")}</button>
                </form>
                <form action={setSupplierActive}>
                  <input type="hidden" name="supplier_id" value={s.id} />
                  <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                  <button className={smallBtn}>
                    {s.active ? t("deactivate") : t("activate")}
                  </button>
                </form>
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
              <li
                key={m.id}
                className={`flex flex-wrap items-end gap-2 px-4 py-3 text-sm ${m.active ? "" : "opacity-50"}`}
              >
                <form action={updateMaterial} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="material_id" value={m.id} />
                  <input
                    name="name"
                    defaultValue={m.name}
                    required
                    aria-label={t("name")}
                    className={editInput}
                  />
                  <input
                    name="unit"
                    defaultValue={m.unit ?? ""}
                    placeholder={t("unit")}
                    className={`${editInput} w-20`}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      name="count_required"
                      defaultChecked={m.count_required}
                      className="h-4 w-4"
                    />
                    {t("countRequiredBadge")}
                  </label>
                  <button className={smallBtn}>{t("save")}</button>
                </form>
                <form action={setMaterialActive}>
                  <input type="hidden" name="material_id" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                  <button className={smallBtn}>
                    {m.active ? t("deactivate") : t("activate")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Subcontractors ----------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("subcontractors")}</h2>

        <form
          action={createSubcontractor}
          className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-3 dark:border-white/15"
        >
          <p className="text-sm font-semibold sm:col-span-3">{t("newSubcontractor")}</p>
          <label className="text-sm">
            <span className="mb-1 block">{t("name")}</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("phone")}</span>
            <input name="phone" className={inputClass} />
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
              {t("addSubcontractor")}
            </button>
          </div>
        </form>

        {subcontractors.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("noSubcontractors")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {subcontractors.map((s) => (
              <li
                key={s.id}
                className={`flex flex-wrap items-end gap-2 px-4 py-3 text-sm ${s.active ? "" : "opacity-50"}`}
              >
                <form action={updateSubcontractor} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="subcontractor_id" value={s.id} />
                  <input name="name" defaultValue={s.name} required aria-label={t("name")} className={editInput} />
                  <input
                    name="phone"
                    defaultValue={s.phone ?? ""}
                    placeholder={t("phone")}
                    className={`${editInput} w-32`}
                  />
                  <button className={smallBtn}>{t("save")}</button>
                </form>
                <form action={setSubcontractorActive}>
                  <input type="hidden" name="subcontractor_id" value={s.id} />
                  <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                  <button className={smallBtn}>{s.active ? t("deactivate") : t("activate")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Workers ------------------------------------------------------------ */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("workers")}</h2>

        <form
          action={createWorker}
          className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-3 dark:border-white/15"
        >
          <p className="text-sm font-semibold sm:col-span-3">{t("newWorker")}</p>
          <label className="text-sm">
            <span className="mb-1 block">{t("name")}</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">{t("belongsTo")}</span>
            <select name="subcontractor_id" defaultValue="" className={inputClass}>
              <option value="">{t("own")}</option>
              {activeSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
              {t("addWorker")}
            </button>
          </div>
        </form>

        {workers.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("noWorkers")}</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
            {workers.map((w) => (
              <li
                key={w.id}
                className={`flex flex-wrap items-end gap-2 px-4 py-3 text-sm ${w.active ? "" : "opacity-50"}`}
              >
                <form action={updateWorker} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="worker_id" value={w.id} />
                  <input name="name" defaultValue={w.name} required aria-label={t("name")} className={editInput} />
                  <select
                    name="subcontractor_id"
                    defaultValue={w.subcontractor_id ?? ""}
                    aria-label={t("belongsTo")}
                    className={editInput}
                  >
                    <option value="">{t("own")}</option>
                    {activeSubs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button className={smallBtn}>{t("save")}</button>
                </form>
                <form action={setWorkerActive}>
                  <input type="hidden" name="worker_id" value={w.id} />
                  <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                  <button className={smallBtn}>{w.active ? t("deactivate") : t("activate")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
