export default function ProfileLoading() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-5xl px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-t-2xl bg-white/5" />
          <div className="flex gap-4 px-6">
            <div className="h-20 w-20 rounded-full bg-white/5 -mt-10" />
            <div className="space-y-2 pt-2">
              <div className="h-5 w-40 rounded bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
          </div>
          <div className="h-64 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
