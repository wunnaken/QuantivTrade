export default function CommunitiesLoading() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-white/5" />
          <div className="h-4 w-64 rounded bg-white/5" />
          <div className="h-12 rounded-2xl bg-white/5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white/5" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
