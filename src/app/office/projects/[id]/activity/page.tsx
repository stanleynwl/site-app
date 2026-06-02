import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/lib/data/projects";
import { getProjectActivity } from "@/lib/data/activity";
import { ActivityFeed } from "@/components/activity-feed";

// Per-project activity feed (newest first).
export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, entries] = await Promise.all([
    getProject(id),
    getProjectActivity(id, 150),
  ]);
  if (!project) notFound();
  const t = await getTranslations("Activity");

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link
          href={`/office/projects/${id}`}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
      </div>
      <ActivityFeed entries={entries} />
    </div>
  );
}
