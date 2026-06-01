import { getTranslations } from "next-intl/server";
import { requireAdminProfile, listProfiles } from "@/lib/auth/dal";
import {
  setUserAccess,
  setUserUsername,
  setUserPassword,
} from "@/lib/data/actions";
import { AddUserForm } from "@/components/add-user-form";
import { DeleteUserButton } from "@/components/delete-user-button";

const inputCls =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

function accessOf(p: { can_office: boolean; can_site: boolean }): string {
  if (p.can_office && p.can_site) return "both";
  if (p.can_office) return "office";
  return "site";
}

// Admin-only: create logins + set each user's access (office / site / both).
export default async function UsersPage() {
  const [me, profiles] = await Promise.all([
    requireAdminProfile(),
    listProfiles(),
  ]);
  const t = await getTranslations("Users");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{t("intro")}</p>
      </div>

      <AddUserForm />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("existing")}</h2>
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/15">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{p.username ?? "—"}</span>
                {p.full_name && (
                  <span className="ml-2 text-black/50 dark:text-white/50">
                    {p.full_name}
                  </span>
                )}
                {p.is_admin && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {t("admin")}
                  </span>
                )}
              </div>
              {p.id === me.id || p.is_admin ? (
                <span className="text-xs text-black/50 dark:text-white/50">
                  {t(`accessOpt.${accessOf(p)}`)}
                </span>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <form action={setUserAccess} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={p.id} />
                    <select
                      name="access"
                      defaultValue={accessOf(p)}
                      className={inputCls}
                    >
                      <option value="site">{t("accessOpt.site")}</option>
                      <option value="office">{t("accessOpt.office")}</option>
                      <option value="both">{t("accessOpt.both")}</option>
                    </select>
                    <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                      {t("save")}
                    </button>
                  </form>

                  <details className="w-full">
                    <summary className="cursor-pointer text-right text-xs underline">
                      {t("manage")}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <form
                        action={setUserUsername}
                        className="flex items-center justify-end gap-2"
                      >
                        <input type="hidden" name="user_id" value={p.id} />
                        <input
                          name="username"
                          defaultValue={p.username ?? ""}
                          placeholder={t("newUsername")}
                          className={inputCls}
                        />
                        <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                          {t("saveUsername")}
                        </button>
                      </form>
                      <form
                        action={setUserPassword}
                        className="flex items-center justify-end gap-2"
                      >
                        <input type="hidden" name="user_id" value={p.id} />
                        <input
                          name="password"
                          type="text"
                          placeholder={t("newPassword")}
                          className={inputCls}
                        />
                        <button className="rounded-lg border border-black/20 px-3 py-1 text-xs font-medium dark:border-white/25">
                          {t("savePassword")}
                        </button>
                      </form>
                      <div className="text-right">
                        <DeleteUserButton userId={p.id} username={p.username ?? ""} />
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
