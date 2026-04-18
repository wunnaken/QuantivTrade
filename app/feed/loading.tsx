export default function FeedLoading() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-white/5" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/5" style={{ height: 200 + (i % 3) * 60 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
