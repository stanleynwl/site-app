// SiteApp #8 — Web Push SENDER (reference).
//
// This does NOT run in the web app. It belongs in the local OFFICE MIRROR
// process (the one already polling the Supabase `activity` table). It reads the
// stored push subscriptions and sends a VAPID web-push for each new activity
// row. Copy/adapt this into the mirror; it's an example, not wired to anything.
//
// Why here and not in the Next app: the PRIVATE VAPID key must never live in
// the web app (same rule as the service-role key). The mirror is a trusted
// local process, so it's the right place to hold the private key + the
// service-role key needed to read every user's subscription.
//
// Setup (once):
//   npm i web-push @supabase/supabase-js
//   npx web-push generate-vapid-keys        # paste PUBLIC into the web app env
// Env for the mirror (NOT the web app):
//   VAPID_PUBLIC_KEY=...          (same public key as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY=...         (SECRET — mirror only)
//   VAPID_SUBJECT=mailto:you@example.com
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...   (to read subscriptions)

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Send one notification to every stored subscription.
 * Prunes subscriptions the push service reports as gone (404/410).
 *
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function broadcast(payload) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) throw error;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
  });

  await Promise.all(
    (subs ?? []).map(async (s) => {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(sub, body);
      } catch (err) {
        // 404/410 = subscription expired/unsubscribed — drop it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.error("[push] send failed", err?.statusCode, err?.body ?? err);
        }
      }
    }),
  );
}

// Example: in the mirror's poll loop, when a new activity row appears, call:
//   await broadcast({
//     title: "SiteApp",
//     body: `${row.actor_name} ${labelFor(row.action)}`,
//     url: "/office/activity",
//   });
