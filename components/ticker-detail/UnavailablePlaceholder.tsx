export function UnavailablePlaceholder({
  label,
  reason,
  provider: _provider,
}: {
  label: string;
  reason: string;
  provider?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.015] px-4 py-3 flex items-start gap-3">
      <svg className="h-4 w-4 mt-0.5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <div>
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{reason}</p>
      </div>
    </div>
  );
}
