import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getDeletedPhotos, purgeExpiredDeletedPhotos } from "@/lib/data/reports";
import { recoverPhoto } from "@/lib/data/actions";

const RECYCLE_DAYS = 3;

// Recycle bin: photos deleted in the last 3 days, recoverable. Expired ones are
// purged (storage + row) on load.
export default async function PhotoTrashPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  await purgeExpiredDeletedPhotos(id);
  const t = await getTranslations("Trash");
  const photos = await getDeletedPhotos(id);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link href={`/office/projects/${id}`} className="text-xs text-muted hover:underline">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
        <p className="text-xs text-muted">{t("intro")}</p>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => {
            const daysLeft = Math.max(
              0,
              RECYCLE_DAYS -
                Math.floor((Date.now() - new Date(p.deleted_at).getTime()) / 86_400_000),
            );
            return (
              <div key={p.id} className="card w-32 p-2 text-center">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  </a>
                ) : (
                  <span className="flex h-28 w-full items-center justify-center rounded-lg bg-foreground/5 text-xs text-muted">
                    n/a
                  </span>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  {t("autoDeletes", { days: daysLeft })}
                </p>
                <form action={recoverPhoto} className="mt-1">
                  <input type="hidden" name="photo_id" value={p.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <button className="btn btn-accent w-full !px-2 !py-1 text-xs">
                    {t("recover")}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
