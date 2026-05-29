import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectBlocks } from "@/lib/data/structure";
import { addBlockStage } from "@/lib/data/actions";
import { todayISO } from "@/lib/date";
import { StageRow } from "@/components/stage-row";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const btnCls =
  "rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25";

export default async function ProjectStagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Stages");
  const blocks = await getProjectBlocks(id);
  const month = todayISO().slice(0, 7);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{t("intro")}</p>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("noBlocks")}</p>
      ) : (
        <ul className="space-y-4">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <div>
                <p className="font-semibold">{b.name}</p>
                {(b.unit_from || b.unit_to) && (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {t("unitRange", {
                      from: b.unit_from ?? "—",
                      to: b.unit_to ?? "—",
                    })}
                  </p>
                )}
              </div>

              {b.stages.length === 0 ? (
                <p className="text-sm text-black/50 dark:text-white/50">
                  {t("noStages")}
                </p>
              ) : (
                <div className="divide-y divide-black/10 dark:divide-white/10">
                  {b.stages.map((s) => (
                    <StageRow
                      key={s.id}
                      stageId={s.id}
                      projectId={id}
                      name={s.name}
                      isCustom={s.is_custom}
                      completedAt={s.completed_at}
                      month={month}
                    />
                  ))}
                </div>
              )}

              {/* Site adds custom items outside the office template */}
              <form action={addBlockStage} className="flex items-end gap-2">
                <input type="hidden" name="block_id" value={b.id} />
                <input type="hidden" name="project_id" value={id} />
                <input
                  name="name"
                  required
                  placeholder={t("customHint")}
                  className={`${inputCls} flex-1`}
                />
                <button className={btnCls}>{t("addStage")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
