"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

interface PromoCode {
  id: string;
  code: string;
  active: boolean;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: number | null;
  created: number;
  coupon_name: string | null;
}

export default function AdminCouponsPage() {
  const { user, authLoading } = useAuth();
  const isFounder = user?.isFounder ?? false;
  const router = useRouter();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", percent_off: "20", max_redemptions: "1" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFounder) { router.replace("/feed"); return; }
    fetchCodes();
  }, [authLoading, user, isFounder]);

  async function fetchCodes() {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    const data = await res.json();
    setCodes(data.codes ?? []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code.trim().toUpperCase(),
        percent_off: Number(form.percent_off),
        max_redemptions: Number(form.max_redemptions),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create code");
    } else {
      setSuccess(`Created ${data.code} — ${data.percent_off}% off`);
      setForm({ code: "", percent_off: "20", max_redemptions: "1" });
      fetchCodes();
    }
  }

  async function handleDeactivate(id: string) {
    await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    fetchCodes();
  }

  if (authLoading || !user || !isFounder) return null;

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--app-bg)", color: "var(--text-primary)" }}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold mb-1">Coupon Codes</h1>
        <p className="text-sm text-zinc-500 mb-8">Stripe promotion codes — shown to users at checkout</p>

        {/* Create form */}
        <div
          className="rounded-2xl border p-6 mb-8"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
        >
          <h2 className="text-sm font-semibold text-white mb-4">Create New Code</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Code</label>
              <input
                type="text"
                required
                placeholder="LAUNCH50"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="h-9 rounded-lg border bg-white/5 px-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50"
                style={{ borderColor: "rgba(255,255,255,0.1)", width: 160 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Percent Off</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={form.percent_off}
                  onChange={(e) => setForm((f) => ({ ...f, percent_off: e.target.value }))}
                  className="h-9 rounded-lg border bg-white/5 px-3 pr-7 text-sm text-zinc-100 outline-none focus:border-[var(--accent-color)]/50"
                  style={{ borderColor: "rgba(255,255,255,0.1)", width: 96 }}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Max Redemptions</label>
              <input
                type="number"
                required
                min={1}
                value={form.max_redemptions}
                onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                className="h-9 rounded-lg border bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent-color)]/50"
                style={{ borderColor: "rgba(255,255,255,0.1)", width: 96 }}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="h-9 px-5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: "rgba(232,132,106,0.15)",
                border: "1px solid rgba(232,132,106,0.35)",
                color: "#e8846a",
              }}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          {success && <p className="mt-3 text-xs text-emerald-400">{success}</p>}
        </div>

        {/* Codes table */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-sm font-semibold text-white">All Codes</span>
            <button onClick={fetchCodes} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Refresh</button>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-600">Loading…</div>
          ) : codes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-600">No codes yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Code", "Discount", "Used / Max", "Status", "Created", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-white">{c.code}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {c.percent_off != null ? `${c.percent_off}% off` : c.amount_off != null ? `$${(c.amount_off / 100).toFixed(2)} off` : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.times_redeemed}{c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.active ? "text-emerald-400" : "text-zinc-600"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${c.active ? "bg-emerald-400" : "bg-zinc-600"}`} />
                        {c.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(c.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {c.active && (
                        <button
                          onClick={() => handleDeactivate(c.id)}
                          className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
