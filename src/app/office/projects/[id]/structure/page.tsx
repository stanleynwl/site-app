import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectBlocks, groupProgressByCategory } from "@/lib/data/structure";
import {
  createProjectBlock,
  updateProjectBlock,
  deleteProjectBlock,
  renameProgressCategory,
  renameProgressItem,
  addProgressItem,
  deleteProgressItem,
  renameStageTemplate,
  addStageTemplate,
  deleteStageTemplate,
} from "@/lib/data/actions";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

// Office edits the project structure. Blocks (name / unit range / unit count)
// are per-block. The Progress items and Stages are a SHARED template: editing a
// category, item, or stage fans out to every block in the project. Reached from
// the project page Edit links on the Progress / Stages summaries.
export default async function OfficeStructurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, blocks] = await Promise.all([
    getProject(id),
    getProjectBlocks(id),
  ]);
  if (!project) notFound();

  const tsg = await getTranslations("Stages");
  // Canonical template = the first block. All edits fan out to every block, so
  // the blocks stay in sync (and new blocks re-seed the same template).
  const template = blocks[0] ?? null;
  const groups = template ? groupProgressByCategory(template.progress_items) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{tsg("officeTitle")}</h1>
        <p className="text-xs text-black/50 dark:text-white/50">
          {tsg("officeIntro")}
        </p>
      </div>

      {/* --- Blocks (per block) ------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{tsg("blocksSection")}</h2>

        {/* Add a block */}
        <form
          action={createProjectBlock}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
        >
          <input type="hidden" name="project_id" value={id} />
          <span className="w-full font-semibold">{tsg("newBlock")}</span>
          <input
            name="name"
            required
            placeholder={tsg("blockNameHint")}
            className={inputCls}
          />
          <input name="unit_from" placeholder={tsg("unitFrom")} className={inputCls} />
          <input name="unit_to" placeholder={tsg("unitTo")} className={inputCls} />
          <input
            name="unit_count"
            type="number"
            min="0"
            placeholder={tsg("unitCount")}
            className={`${inputCls} w-28`}
          />
          <button className={btnCls}>{tsg("addBlock")}</button>
        </form>

        {blocks.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {tsg("noBlocks")}
          </p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                <form
                  action={updateProjectBlock}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="block_id" value={b.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <input
                    name="name"
                    required
                    defaultValue={b.name}
                    placeholder={tsg("blockName")}
                    className={inputCls}
                  />
                  <input
                    name="unit_from"
                    defaultValue={b.unit_from ?? ""}
                    placeholder={tsg("unitFrom")}
                    className={inputCls}
                  />
                  <input
                    name="unit_to"
                    defaultValue={b.unit_to ?? ""}
                    placeholder={tsg("unitTo")}
                    className={inputCls}
                  />
                  <input
                    name="unit_count"
                    type="number"
                    min="0"
                    defaultValue={b.unit_count ?? ""}
                    placeholder={tsg("unitCount")}
                    className={`${inputCls} w-28`}
                  />
                  <button className={btnCls}>{tsg("saveBlock")}</button>
                </form>
                <form action={deleteProjectBlock} className="ml-auto">
                  <input type="hidden" name="block_id" value={b.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <button className="text-xs text-red-600 underline">
                    {tsg("deleteBlock")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Progress items template (all blocks) ------------------------- */}
      {template && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{tsg("progressTemplate")}</h2>
            <p className="text-xs text-black/50 dark:text-white/50">
              {tsg("templateHint")}
            </p>
          </div>

          <ul className="space-y-3">
            {groups.map((grp) => (
              <li
                key={grp.category}
                className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
              >
                {/* Rename category (main) */}
                <form
                  action={renameProgressCategory}
                  className="flex items-end gap-2"
                >
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="old_category" value={grp.category} />
                  <input
                    name="category"
                    required
                    defaultValue={grp.category}
                    placeholder={tsg("categoryName")}
                    className={`${inputCls} flex-1 font-semibold`}
                  />
                  <button className={btnCls}>{tsg("saveCategory")}</button>
                </form>

                {/* Items (sub) */}
                <ul className="space-y-2 pl-2">
                  {grp.items.map((it) =>
                    it.name != null ? (
                      <li key={it.id} className="flex items-end gap-2">
                        <form
                          action={renameProgressItem}
                          className="flex flex-1 items-end gap-2"
                        >
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="category" value={grp.category} />
                          <input type="hidden" name="old_name" value={it.name} />
                          <input
                            name="name"
                            required
                            defaultValue={it.name}
                            placeholder={tsg("itemName")}
                            className={`${inputCls} flex-1`}
                          />
                          <button className={btnCls}>{tsg("saveItem")}</button>
                        </form>
                        <form action={deleteProgressItem}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="category" value={grp.category} />
                          <input type="hidden" name="name" value={it.name} />
                          <button
                            aria-label={tsg("deleteItem")}
                            className="px-1 text-red-600"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ) : (
                      // category-only leaf (no sub-item): allow deleting it
                      <li
                        key={it.id}
                        className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40"
                      >
                        <span className="flex-1">—</span>
                        <form action={deleteProgressItem}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="category" value={grp.category} />
                          <button
                            aria-label={tsg("deleteItem")}
                            className="px-1 text-red-600"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ),
                  )}

                  {/* Add item to this category */}
                  <li>
                    <form action={addProgressItem} className="flex items-end gap-2">
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="category" value={grp.category} />
                      <input
                        name="name"
                        required
                        placeholder={tsg("itemNameHint")}
                        className={`${inputCls} flex-1`}
                      />
                      <button className={btnCls}>{tsg("addItem")}</button>
                    </form>
                  </li>
                </ul>
              </li>
            ))}
          </ul>

          {/* Add a new category */}
          <form
            action={addProgressItem}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
          >
            <input type="hidden" name="project_id" value={id} />
            <input
              name="category"
              required
              placeholder={tsg("newCategory")}
              className={`${inputCls} flex-1`}
            />
            <input name="name" placeholder={tsg("itemName")} className={inputCls} />
            <button className={btnCls}>{tsg("addCategory")}</button>
          </form>
        </section>
      )}

      {/* --- Stages template (all blocks) -------------------------------- */}
      {template && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">{tsg("stagesTemplate")}</h2>
            <p className="text-xs text-black/50 dark:text-white/50">
              {tsg("templateHint")}
            </p>
          </div>

          <ul className="space-y-2 rounded-xl border border-black/10 p-4 dark:border-white/15">
            {template.stages.map((s) => (
              <li key={s.id} className="flex items-end gap-2">
                <form
                  action={renameStageTemplate}
                  className="flex flex-1 items-end gap-2"
                >
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="old_name" value={s.name} />
                  <input
                    name="name"
                    required
                    defaultValue={s.name}
                    placeholder={tsg("stageName")}
                    className={`${inputCls} flex-1`}
                  />
                  <button className={btnCls}>{tsg("saveStage")}</button>
                </form>
                <form action={deleteStageTemplate}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="name" value={s.name} />
                  <button
                    aria-label={tsg("removeStage")}
                    className="px-1 text-red-600"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}

            {/* Add a stage */}
            <li>
              <form action={addStageTemplate} className="flex items-end gap-2">
                <input type="hidden" name="project_id" value={id} />
                <input
                  name="name"
                  required
                  placeholder={tsg("stageName")}
                  className={`${inputCls} flex-1`}
                />
                <button className={btnCls}>{tsg("addStage")}</button>
              </form>
            </li>
          </ul>
        </section>
      )}

      {blocks.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">
          {tsg("needBlockFirst")}
        </p>
      )}
    </div>
  );
}
