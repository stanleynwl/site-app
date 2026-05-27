import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectTags, TAG_KINDS } from "@/lib/data/tags";
import { getProjectPhotos, withSignedPhotoUrls } from "@/lib/data/photos";
import { createProjectTag } from "@/lib/data/actions";
import { todayISO } from "@/lib/date";
import { ProgressPhotoForm } from "@/components/progress-photo-form";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function ProjectPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const t = await getTranslations("Photos");
  const tk = await getTranslations("Tags");
  const [tags, rawPhotos] = await Promise.all([
    getProjectTags(id),
    getProjectPhotos(id),
  ]);
  const photos = await withSignedPhotoUrls(rawPhotos);
  const approvedTags = tags.filter((tg) => tg.approved);

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
      </div>

      <ProgressPhotoForm projectId={id} today={todayISO()} tags={approvedTags} />

      {/* Suggest a tag — supervisors propose, office approves */}
      <form
        action={createProjectTag}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 p-4 text-sm dark:border-white/15"
      >
        <input type="hidden" name="project_id" value={id} />
        <span className="w-full font-semibold">{t("suggestTag")}</span>
        <select name="kind" defaultValue="block" className={inputCls}>
          {TAG_KINDS.map((k) => (
            <option key={k} value={k}>
              {tk(`kindOpt.${k}`)}
            </option>
          ))}
        </select>
        <input name="label" required placeholder={tk("label")} className={inputCls} />
        <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
          {t("suggestTag")}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("recent")}</h2>
        {photos.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li
                key={p.id}
                className="space-y-1 rounded-xl border border-black/10 p-2 dark:border-white/15"
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.caption ?? ""}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-black/5 text-xs text-black/40 dark:bg-white/10 dark:text-white/40">
                    {t("archived")}
                  </div>
                )}
                {p.caption && <p className="text-xs">{p.caption}</p>}
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((tg) => (
                      <span
                        key={tg.id}
                        className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10"
                      >
                        {tg.label}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
