"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Office sidebar link with an active state. `/office` (dashboard) matches exactly;
// the rest match by prefix.
export function OfficeNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/office" ? pathname === "/office" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-accent/10 font-medium text-accent"
          : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
