export default function OfflinePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-sm text-black/60 dark:text-white/60">
        SiteApp will sync your reports automatically when you&apos;re back in
        coverage.
      </p>
    </main>
  );
}
