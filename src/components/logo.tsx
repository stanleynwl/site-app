import type { SVGProps } from "react";

/**
 * SiteApp brand mark — three stacked layers rising left-to-right, reading as
 * "a structure going up, day by day". Uses currentColor for the outline and a
 * brand gradient for the fill so it works on light, dark, and coloured chips.
 */
export function LogoMark({
  size = 28,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="siteapp-mark" x1="2" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f6bff" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* base slab */}
      <rect x="3" y="20" width="26" height="8" rx="2.4" fill="url(#siteapp-mark)" />
      {/* middle slab */}
      <rect x="6" y="12" width="20" height="6.5" rx="2.2" fill="url(#siteapp-mark)" opacity="0.7" />
      {/* top slab */}
      <rect x="9" y="5" width="14" height="5" rx="2" fill="#f59e0b" />
    </svg>
  );
}

/**
 * Full lockup: mark + "SiteApp" wordmark. `tone` controls the wordmark colour
 * (default inherits, "invert" for dark hero sections).
 */
export function Logo({
  size = 28,
  className = "",
  showWord = true,
}: {
  size?: number;
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {showWord && (
        <span className="text-[1.05em] font-semibold tracking-tight">
          Site<span className="text-accent">App</span>
        </span>
      )}
    </span>
  );
}
