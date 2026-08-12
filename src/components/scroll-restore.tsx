"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Remembers where you were scrolled on a list page and puts you back there when
// you return — so opening a PO from halfway down the registry and coming back
// doesn't dump you at the top of the page again.
//
// Two things make this fiddly, and both are handled below:
//
//  * Saving. Scroll events aren't a reliable trigger on their own, so the
//    position is captured on link CLICK — the exact moment before navigating —
//    with scroll and pagehide as extra chances.
//  * Restoring. The router scrolls to top AFTER this effect runs, and the list
//    may still be laying out, so a single scrollTo gets overridden or clamped
//    short. Instead we re-assert the target for a few hundred ms until it
//    sticks, and stop early the moment the user scrolls themselves.
//
// Keyed by path + query, so a filtered list and an unfiltered one keep their own
// positions. sessionStorage, so it lasts the tab and no longer.

const RESTORE_WINDOW_MS = 700;

export function ScrollRestore({ scope }: { scope: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `siteapp.scroll.${scope}.${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    let restoring = false;
    const target = Number(sessionStorage.getItem(key) ?? "");

    // While re-asserting the target, the page may still be short and clamp the
    // scroll — don't let those intermediate values overwrite the real one.
    const save = () => {
      if (!restoring) sessionStorage.setItem(key, String(window.scrollY));
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      restoring = false;
      if (timer) clearTimeout(timer);
    };

    if (Number.isFinite(target) && target > 0) {
      restoring = true;
      const started = Date.now();
      // setTimeout rather than requestAnimationFrame: rAF is suspended while a
      // tab is hidden or not compositing, which would leave the page stuck at
      // the top until it was looked at.
      const tick = () => {
        if (!restoring) return;
        if (Math.abs(window.scrollY - target) > 2) window.scrollTo(0, target);
        if (Date.now() - started < RESTORE_WINDOW_MS) timer = setTimeout(tick, 16);
        else stop();
      };
      tick();
      // Any deliberate scroll from the user wins immediately.
      window.addEventListener("wheel", stop, { passive: true, once: true });
      window.addEventListener("touchstart", stop, { passive: true, once: true });
      window.addEventListener("keydown", stop, { once: true });
    }

    // Capture phase: record the offset before the router starts navigating.
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("a[href]")) {
        restoring = false; // a click ends any in-flight restore
        sessionStorage.setItem(key, String(window.scrollY));
      }
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(save);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      stop();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      cancelAnimationFrame(raf);
    };
  }, [key]);

  return null;
}
