import { LogoMark } from "@/components/logo";

/**
 * Decorative product mock for the marketing hero — a phone-framed rendering of
 * the supervisor "Today" screen. Pure presentation (no data); built from divs so
 * it stays crisp at any size and matches the live app's look.
 */
export function AppMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* floating accept badge */}
      <div className="absolute -left-4 top-24 z-20 hidden rotate-[-4deg] sm:block">
        <div className="card flex items-center gap-2 px-3 py-2 shadow-[var(--shadow-lg)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">Report filed</p>
            <p className="text-[10px] text-muted">Block C · today</p>
          </div>
        </div>
      </div>

      {/* floating delivery chip */}
      <div className="absolute -right-3 bottom-16 z-20 hidden rotate-[5deg] sm:block">
        <div className="card flex items-center gap-2 px-3 py-2 shadow-[var(--shadow-lg)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /></svg>
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">DO #4471</p>
            <p className="text-[10px] text-muted">12 m³ concrete</p>
          </div>
        </div>
      </div>

      {/* phone frame */}
      <div className="relative rounded-[2.2rem] border border-border-strong bg-foreground/[0.03] p-2.5 shadow-[var(--shadow-lg)]">
        <div className="overflow-hidden rounded-[1.7rem] border border-border bg-background">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-medium text-muted">
            <span>9:41</span>
            <span className="h-3.5 w-16 rounded-full bg-foreground/10" />
          </div>
          {/* app header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <LogoMark size={22} />
              <div className="leading-tight">
                <p className="text-sm font-semibold">SiteApp</p>
                <p className="text-[10px] text-muted">Stanley · supervisor</p>
              </div>
            </div>
            <span className="text-[10px] text-muted">EN</span>
          </div>

          {/* today list */}
          <div className="space-y-2.5 px-4 py-4">
            <p className="section-title">Today · 3 Jun</p>
            {[
              { name: "Taman Sri · Block C", label: "Done", tone: "badge-success" },
              { name: "Taman Sri · Block D", label: "Draft", tone: "badge-warn" },
              { name: "Lakeview · Block A", label: "No report", tone: "badge-muted" },
            ].map((p) => (
              <div key={p.name} className="card flex items-center justify-between px-3.5 py-3">
                <span className="text-[13px] font-medium">{p.name}</span>
                <span className={`badge ${p.tone}`}>{p.label}</span>
              </div>
            ))}

            {/* progress mini */}
            <div className="card px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Block C progress</span>
                <span className="text-[11px] text-muted">8 / 12</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-2/3 rounded-full bg-accent" />
              </div>
            </div>

            {/* photo row */}
            <div className="grid grid-cols-3 gap-2">
              {["bg-accent/20", "bg-signal/25", "bg-success/20"].map((c, i) => (
                <div key={i} className={`aspect-square rounded-lg ${c}`} />
              ))}
            </div>
          </div>

          {/* bottom nav */}
          <div className="grid grid-cols-2 border-t border-border text-center text-[11px]">
            <div className="py-2.5 font-medium text-accent">Today</div>
            <div className="py-2.5 text-muted">Projects</div>
          </div>
        </div>
      </div>
    </div>
  );
}
