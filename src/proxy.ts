import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy-session";

const PROTECTED_PREFIXES = ["/app", "/office"];

export async function proxy(request: NextRequest) {
  // Before Supabase is provisioned, skip session work so the app still boots.
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  // When we redirect, the new response must carry the session cookies that
  // updateSession just refreshed — otherwise the browser keeps the old
  // (rotated, now-invalid) token and /app ↔ /login bounce forever.
  const redirectTo = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  };

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("next", path);
    return redirectTo(loginUrl);
  }

  if (path === "/login" && user) {
    return redirectTo(new URL("/app", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|serwist|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
