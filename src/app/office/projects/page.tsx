import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyProjects } from "@/lib/data/projects";
import { createProject } from "@/lib/data/actions";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export default async function OfficeProjects() {
  const t = await getTranslations("Projects");
  const projects = await getMyProjects();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <form
        action={createProject}
        className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15"
      >
        <p className="text-sm font-semibold sm:col-span-2">{t("new")}</p>
        <label className="text-sm">
          <span className="mb-1 block">{t("name")}</span>
          <input name="name" required className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block">{t("code")}</span>
          <input name="code" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block">{t("location")}</span>
          <input name="location" className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block">{t("startDate")}</span>
          <input name="start_date" type="date" className={inputClass} />
        </label>
        <div className="sm:col-span-2">
          <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
            {t("create")}
          </button>
        </div>
      </form>

      {projects.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">{t("none")}</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/office/projects/${p.id}`}
                className="block rounded-xl border border-black/10 p-4 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
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
      )}
    </div>
  );
}
