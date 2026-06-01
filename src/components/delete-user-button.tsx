"use client";

import { useTranslations } from "next-intl";
import { deleteUser } from "@/lib/data/actions";

// Admin deletes a user — confirm guard (destructive: removes the login + their
// data). The action re-checks admin in the DB function.
export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const t = useTranslations("Users");
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (!confirm(t("confirmDeleteUser", { username }))) e.preventDefault();
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button type="submit" className="text-xs text-red-600 underline">
        {t("deleteUser")}
      </button>
    </form>
  );
}
