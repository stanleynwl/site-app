import Link from "next/link";
import { Logo } from "@/components/logo";
import { AppMock } from "@/components/marketing/app-mock";

/* Lightweight inline icons (stroke, currentColor) — no icon dependency. */
type IconProps = { className?: string };
const Ico = ({ d, className }: { d: string } & IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const IconReport = (p: IconProps) => <Ico {...p} d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4" />;
const IconCamera = (p: IconProps) => <Ico {...p} d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />;
const IconReceipt = (p: IconProps) => <Ico {...p} d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6M9 15h3" />;
const IconChart = (p: IconProps) => <Ico {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
const IconWifiOff = (p: IconProps) => <Ico {...p} d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-3-2.2M12 20h.01" />;
const IconGlobe = (p: IconProps) => <Ico {...p} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.8 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3z" />;
const IconCheck = (p: IconProps) => <Ico {...p} d="M20 6 9 17l-5-5" />;
const IconArrow = (p: IconProps) => <Ico {...p} d="M5 12h14M13 6l6 6-6 6" />;

const features = [
  { icon: IconReport, title: "Daily site reports", body: "Manpower, machinery, issues and visitors captured in minutes — locked per day, unlockable by PMs." },
  { icon: IconCamera, title: "Photo-first deliveries", body: "Snap the DO, log ordered / delivered / accepted quantities. Photos archive automatically." },
  { icon: IconReceipt, title: "Requests & purchase orders", body: "Supervisors raise material requests from site; the office approves and issues POs in one queue." },
  { icon: IconChart, title: "Live progress by block", body: "Track every stage across blocks A–L. See what's started, what's done, at a glance." },
  { icon: IconWifiOff, title: "Works offline", body: "Built as a PWA for patchy site signal. Capture now, it syncs the moment you're back online." },
  { icon: IconGlobe, title: "English · Malay · 中文", body: "Every screen speaks your crew's language. Switch instantly, no reload." },
];

const steps = [
  { n: "01", title: "Capture on site", body: "Supervisors log the day, deliveries and material requests straight from their phone." },
  { n: "02", title: "Office stays in sync", body: "Reports, photos and requests land in the office console in real time — approve and issue POs." },
  { n: "03", title: "One source of truth", body: "Progress, activity log and PDF exports — a clean record for every project, every day." },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    note: "For a single crew getting organised.",
    cta: "Start free",
    features: ["1 project", "Daily reports & photos", "Material requests", "EN / MS / ZH"],
    highlight: false,
  },
  {
    name: "Contractor",
    price: "RM 149",
    unit: "/mo",
    note: "For active sites that need the full loop.",
    cta: "Start free trial",
    features: ["Unlimited projects", "Deliveries & PO queue", "Progress & stages tracking", "Activity audit log", "PDF exports"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    note: "Multi-site, on-prem office mirror & SSO.",
    cta: "Contact us",
    features: ["Everything in Contractor", "On-prem office backup", "Priority support", "Onboarding & training"],
    highlight: false,
  },
];

export function Landing() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Nav ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Logo size={26} />
          <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn">Log in</Link>
            <Link href="/login" className="btn btn-accent">Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero -------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div className="blueprint absolute inset-0 opacity-60" />
          <div className="glow left-1/2 top-[-6rem] h-72 w-[42rem] -translate-x-1/2 bg-accent/30" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div className="animate-rise">
              <span className="kicker">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Built for construction sites
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                The daily site report,
                <br />
                <span className="gradient-text">done before you leave site.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                SiteApp turns the messy end-of-day paperwork — manpower, deliveries,
                material requests and progress — into a few taps on a phone. Even with no signal.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn btn-accent btn-lg">
                  Get started free <IconArrow className="h-4 w-4" />
                </Link>
                <a href="#how" className="btn btn-lg">See how it works</a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-success" /> No app store needed</span>
                <span className="inline-flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-success" /> Works offline</span>
                <span className="inline-flex items-center gap-1.5"><IconCheck className="h-4 w-4 text-success" /> 3 languages</span>
              </div>
            </div>
            <div className="animate-rise [animation-delay:120ms]">
              <AppMock />
            </div>
          </div>
        </section>

        {/* Stat band --------------------------------------------------------- */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
            {[
              ["< 3 min", "to file a daily report"],
              ["100%", "works offline on site"],
              ["3", "languages, one tap"],
              ["A–L", "blocks tracked live"],
            ].map(([big, small]) => (
              <div key={small}>
                <div className="text-2xl font-semibold tracking-tight sm:text-3xl">{big}</div>
                <div className="mt-1 text-sm text-muted">{small}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features ---------------------------------------------------------- */}
        <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <div className="max-w-2xl">
            <p className="section-title">Everything the site needs</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              One app for the whole site loop
            </h2>
            <p className="mt-3 text-lg text-muted">
              From the supervisor's phone to the office desk — capture, approve and track without chasing WhatsApp messages.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works ------------------------------------------------------ */}
        <section id="how" className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
            <div className="max-w-2xl">
              <p className="section-title">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Site to office in three steps
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="relative">
                  <div className="text-sm font-semibold text-accent">{s.n}</div>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Offline highlight ------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <div className="card relative overflow-hidden p-8 sm:p-12">
            <div className="glow right-[-4rem] top-[-4rem] h-56 w-72 bg-signal/30" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div className="max-w-xl">
                <span className="badge badge-warn">
                  <IconWifiOff className="h-3.5 w-3.5" /> No signal? No problem.
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Designed for basements, ground floors and dead zones
                </h2>
                <p className="mt-3 text-muted">
                  SiteApp installs to the home screen and runs as a progressive web app. Capture
                  reports, photos and deliveries with zero bars — everything syncs automatically the
                  moment the phone reconnects. Nothing is ever lost.
                </p>
              </div>
              <Link href="/login" className="btn btn-accent btn-lg shrink-0">
                Try it on your site <IconArrow className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing ----------------------------------------------------------- */}
        <section id="pricing" className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="section-title">Pricing</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Simple pricing that scales with your sites
              </h2>
              <p className="mt-3 text-lg text-muted">Start free. Upgrade when the site picks up.</p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`card relative flex flex-col p-7 ${p.highlight ? "ring-2 ring-accent" : ""}`}
                >
                  {p.highlight && (
                    <span className="badge badge-accent absolute -top-3 left-7">Most popular</span>
                  )}
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                    {p.unit && <span className="text-sm text-muted">{p.unit}</span>}
                  </div>
                  <p className="mt-2 text-sm text-muted">{p.note}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`btn btn-lg mt-7 w-full ${p.highlight ? "btn-accent" : ""}`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA --------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 lg:py-24">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-14 text-center text-background sm:px-12">
            <div className="glow left-1/2 top-[-3rem] h-48 w-96 -translate-x-1/2 bg-accent/40" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
              Get tomorrow's report done today
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-base opacity-80">
              Join the contractors running cleaner sites with SiteApp. Free to start, no card required.
            </p>
            <div className="relative mt-7 flex justify-center">
              <Link
                href="/login"
                className="btn btn-lg bg-background text-foreground hover:opacity-90"
              >
                Get started free <IconArrow className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer -------------------------------------------------------------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row">
          <Logo size={22} />
          <p>© {new Date().getFullYear()} SiteApp. Built for the site.</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
