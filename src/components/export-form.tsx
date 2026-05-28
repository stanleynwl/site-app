"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const AUDIENCES = ["consultant", "client", "boss"] as const;

export function ExportForm({
  projects,
  today,
  defaultFrom,
}: {
  projects: { id: string; name: string }[];
  today: string;
  defaultFrom: string;
}) {
  const t = useTranslations("Export");
  const router = useRouter();
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [audience, setAudience] = useState<string>("consultant");

  if (projects.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        {t("noProjects")}
      </p>
    );
  }

  function generate() {
    if (!project) return;
    const q = new URLSearchParams({ project, audience, from, to });
    router.push(`/office/export/print?${q.toString()}`);
  }

  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("project")}</span>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className={inputClass}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t("from")}</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t("to")}</span>
          <input
            type="date"
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium">{t("audience")}</span>
        <div className="grid grid-cols-3 gap-2">
          {AUDIENCES.map((a) => (
            <label
              key={a}
              className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors ${
                audience === a
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="audience"
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
                className="sr-only"
              />
              <span className="font-medium">{t(`audienceOpt.${a}`)}</span>
              <span
                className={`text-xs ${audience === a ? "text-background/80" : "text-black/50 dark:text-white/50"}`}
              >
                {t(`audienceHint.${a}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={generate}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        {t("generate")}
      </button>
    </div>
  );
}
