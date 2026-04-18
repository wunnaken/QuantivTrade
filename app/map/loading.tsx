export default function Loading() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-white/5" />
          <div className="h-4 w-72 rounded bg-white/5" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white/5" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
