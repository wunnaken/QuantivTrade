export default function MessagesLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] app-page">
      <div className="w-80 shrink-0 animate-pulse border-r border-white/5 p-4 space-y-3">
        <div className="h-8 rounded-lg bg-white/5" />
        <div className="h-10 rounded-lg bg-white/5" />
        {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5" />)}
      </div>
      <div className="flex-1" />
    </div>
  );
}
