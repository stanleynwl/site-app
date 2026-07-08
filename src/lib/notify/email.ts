import "server-only";

// Transactional email via Resend's REST API (no SDK dependency). Every send is
// BEST-EFFORT: if the API key / recipients aren't configured, or the request
// fails, we swallow it and return false — a notification must never break the
// action that fired it.
//
// Configure in env (Vercel project settings + .env.local for local runs):
//   RESEND_API_KEY       Resend key (re_...)
//   SITEAPP_NOTIFY_FROM  verified sender, e.g. "SiteApp <alerts@yourdomain.com>"
//                        (or "onboarding@resend.dev" for a first test)
//   SITEAPP_NOTIFY_TO    comma-separated recipient(s)
//   SITEAPP_PUBLIC_URL   base URL for links (falls back to VERCEL_URL)

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Base URL for links in emails. Explicit env wins; otherwise use the Vercel
// deployment URL. Empty string → links are omitted rather than broken.
export function siteBaseUrl(): string {
  const explicit = process.env.SITEAPP_PUBLIC_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "";
}

export async function sendEmail(opts: {
  subject: string;
  html: string;
  text: string;
  to?: string; // override recipients (comma-separated); default SITEAPP_NOTIFY_TO
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SITEAPP_NOTIFY_FROM;
  const to = (opts.to ?? process.env.SITEAPP_NOTIFY_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!apiKey || !from || to.length === 0) return false; // not configured → no-op

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Instant "a request needs the office" email, fired when the site raises one.
export async function notifyNewRequest(input: {
  projectName: string;
  raisedBy: string;
  items: string[]; // already-labeled lines, e.g. "Timber 1x2 — 4 tonne (12 ft)"
  neededBy: string | null;
  urgency: string | null;
  photoCount: number;
}): Promise<void> {
  const base = siteBaseUrl();
  const link = base ? `${base}/office/requests` : "";

  const lines =
    input.items.length > 0
      ? input.items
      : [input.photoCount > 0 ? "(see attached photo in the app)" : "(no items)"];

  const listHtml = lines.map((l) => `<li>${esc(l)}</li>`).join("");
  const meta: string[] = [];
  if (input.neededBy) meta.push(`Needed by: ${esc(input.neededBy)}`);
  if (input.urgency) meta.push(`Note: ${esc(input.urgency)}`);
  if (input.photoCount > 0)
    meta.push(`${input.photoCount} photo${input.photoCount > 1 ? "s" : ""} attached`);

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">New purchase request</h2>
    <p style="margin:0 0 12px;color:#555">${esc(input.projectName)} · raised by ${esc(input.raisedBy)}</p>
    <ul style="margin:0 0 12px;padding-left:20px">${listHtml}</ul>
    ${meta.length ? `<p style="margin:0 0 16px;color:#555">${meta.map(esc).join(" · ")}</p>` : ""}
    ${
      link
        ? `<a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open the request queue</a>`
        : ""
    }
  </div>`;

  const text = [
    `New purchase request — ${input.projectName}`,
    `Raised by ${input.raisedBy}`,
    "",
    ...lines.map((l) => `- ${l}`),
    "",
    ...meta,
    link ? `\nOpen: ${link}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  await sendEmail({
    subject: `New request — ${input.projectName}`,
    html,
    text,
  });
}
