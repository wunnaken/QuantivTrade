export default function SocialFeedLoading() {
  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-2xl bg-white/5" />
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5" />)}
        </div>
      </div>
    </div>
  );
}
