import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyProjects } from "@/lib/data/projects";

export default async function AppProjects() {
  const t = await getTranslations("Projects");
  const projects = await getMyProjects();

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
        {t("none")}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/app/projects/${p.id}`}
            className="block rounded-xl border border-black/10 p-4 dark:border-white/15"
          >
            <span className="font-medium">{p.name}</span>
            {p.code && (
              <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                {p.code}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
