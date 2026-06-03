"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tab-bar link for the supervisor app. `/app` (Today) matches exactly;
// other tabs match by prefix. Active tab is tinted with the brand accent.
export function AppNavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "today" | "projects";
}) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const path =
    icon === "today"
      ? "M8 2v3M16 2v3M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      : "M4 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z";

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
        active ? "text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
      {label}
    </Link>
  );
}
