"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createUser, type CreateUserState } from "@/lib/data/actions";

const inputCls =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function AddUserForm() {
  const t = useTranslations("Users");
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    undefined,
  );

  const message =
    state && "ok" in state
      ? t("created", { username: state.username })
      : state && "error" in state
        ? state.error === "exists"
          ? t("errExists")
          : state.error === "validation"
            ? t("errValidation")
            : state.error === "not-admin"
              ? t("errNotAdmin")
              : `${t("errSignup")}${state.detail ? ` [${state.detail}]` : ""}`
        : null;

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <p className="text-sm font-semibold">{t("addUser")}</p>

      <label className="block text-sm">
        <span className="mb-1 block">{t("username")}</span>
        <input name="username" required autoComplete="off" className={inputCls} />
        <span className="mt-1 block text-xs text-black/50 dark:text-white/50">
          {t("usernameHint")}
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("password")}</span>
        <input name="password" type="text" required className={inputCls} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("fullName")}</span>
        <input name="full_name" className={inputCls} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block">{t("access")}</span>
        <select name="access" defaultValue="site" className={inputCls}>
          <option value="site">{t("accessOpt.site")}</option>
          <option value="office">{t("accessOpt.office")}</option>
          <option value="both">{t("accessOpt.both")}</option>
        </select>
      </label>

      {message && (
        <p
          className={`text-sm ${
            state && "error" in state ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("adding") : t("addUser")}
      </button>
    </form>
  );
}
