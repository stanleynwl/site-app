export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
    </div>
  );
}
