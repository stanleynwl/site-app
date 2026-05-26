"use client";

import { useTranslations } from "next-intl";
import { deleteDelivery } from "@/lib/data/actions";

// Office-side delete with a confirm guard (destructive: removes photos too).
export function DeleteDeliveryButton({
  deliveryId,
  projectId,
}: {
  deliveryId: string;
  projectId: string;
}) {
  const t = useTranslations("Deliveries");
  return (
    <form
      action={deleteDelivery}
      onSubmit={(e) => {
        if (!confirm(t("confirmDelete"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="delivery_id" value={deliveryId} />
      <input type="hidden" name="project_id" value={projectId} />
      <button type="submit" className="text-xs text-red-600 underline">
        {t("delete")}
      </button>
    </form>
  );
}
