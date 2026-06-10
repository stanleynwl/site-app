export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
        />
      ))}
    </div>
  );
}
