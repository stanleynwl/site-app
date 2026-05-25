"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, type LoginState } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  const errorMessage =
    state?.error === "invalid"
      ? t("invalid")
      : state?.error === "missing"
        ? t("missing")
        : state?.error === "not-configured"
          ? t("notConfigured")
          : null;

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? t("signingIn") : t("signIn")}
      </button>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      {!isSupabaseConfigured && (
        <p className="text-xs text-amber-600">{t("notConfigured")}</p>
      )}
    </form>
  );
}
