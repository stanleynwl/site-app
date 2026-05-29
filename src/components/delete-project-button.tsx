"use client";

import { useTranslations } from "next-intl";
import { deleteProject } from "@/lib/data/actions";

// Permanent, irreversible delete. Gated behind typing the exact project name so
// it can't be fat-fingered. The server action re-checks role (office/pm).
export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations("Projects");
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        const typed = window.prompt(`${t("deleteHint")}\n\n${t("deletePrompt")}`);
        if (typed == null) {
          e.preventDefault(); // cancelled
          return;
        }
        if (typed.trim() !== projectName.trim()) {
          e.preventDefault();
          window.alert(t("deleteMismatch"));
        }
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <button
        type="submit"
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:hover:bg-red-950/30"
      >
        {t("delete")}
      </button>
    </form>
  );
}
