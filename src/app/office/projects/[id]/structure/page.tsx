import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectBlocks } from "@/lib/data/structure";
import {
  createProjectBlock,
  updateProjectBlock,
  deleteProjectBlock,
  addBlockStage,
  deleteBlockStage,
} from "@/lib/data/actions";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

// Office edits the project structure: blocks (name / unit range / unit count)
// and their stages. Progress items are seeded from the A–L template and
// backfilled on save (updateProjectBlock). Reached from the project page Edit
// links on the Progress / Stages summaries.
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

  return (
    <div className="space-y-4">
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
        <p className="text-sm text-black/50 dark:text-white/50">{tsg("noBlocks")}</p>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="space-y-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
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

              {b.stages.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {b.stages.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                    >
                      <span>{s.name}</span>
                      <form action={deleteBlockStage} className="inline">
                        <input type="hidden" name="stage_id" value={s.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button aria-label={tsg("removeStage")} className="text-red-600">
                          ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={addBlockStage} className="flex items-end gap-2">
                <input type="hidden" name="block_id" value={b.id} />
                <input type="hidden" name="project_id" value={id} />
                <input
                  name="name"
                  required
                  placeholder={tsg("stageName")}
                  className={`${inputCls} flex-1`}
                />
                <button className={btnCls}>{tsg("addStage")}</button>
              </form>

              <form action={deleteProjectBlock}>
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
    </div>
  );
}
