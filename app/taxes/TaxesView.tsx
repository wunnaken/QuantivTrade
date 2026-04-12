"use client";

const UPCOMING_FEATURES = [
  {
    title: "Capital Gains Estimator",
    description: "Calculate estimated federal tax on short-term and long-term gains based on your income bracket.",
  },
  {
    title: "Tax-Loss Harvesting",
    description: "Identify positions at a loss that can be sold to offset realized gains before year-end.",
  },
  {
    title: "Wash Sale Detector",
    description: "Flag trades that may violate the 30-day wash sale rule and disallow your loss deduction.",
  },
  {
    title: "Holding Period Tracker",
    description: "See exactly how many days each position has been held and which are approaching long-term status.",
  },
  {
    title: "Trader Tax Status Checker",
    description: "Assess whether your trading activity qualifies for IRS trader tax status and Mark-to-Market election.",
  },
  {
    title: "Estimated Quarterly Taxes",
    description: "Calculate how much you owe in quarterly estimated payments to avoid underpayment penalties.",
  },
  {
    title: "Tax Forms Guide",
    description: "Know exactly which forms you need — 1099-B, Form 8949, Schedule D, and more — based on your activity.",
  },
  {
    title: "Crypto Tax Tracking",
    description: "Every swap and sale is a taxable event. Track cost basis and gains across crypto positions.",
  },
];

export default function TaxesView() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--app-text)]">Taxes</h1>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">This section is coming soon.</p>
      </div>

      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--app-text-muted)]">Planned Features</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {UPCOMING_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 opacity-60"
            >
              <p className="mb-1 font-medium text-[var(--app-text)]">{f.title}</p>
              <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
