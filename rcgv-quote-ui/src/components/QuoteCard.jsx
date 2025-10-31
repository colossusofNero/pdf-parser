// src/components/QuoteCard.jsx
import React from "react";

export default function QuoteCard({ last, onQuickAction }) {
  const p = last?.parts || {};
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h2 className="text-lg font-semibold mb-1">Quote Summary</h2>
      <p className="text-sm text-slate-500 mb-4">Live results from the agent calculator</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Base" value={money(last?.base_quote)} />
        <Stat label="Final" value={money(last?.final_quote)} />
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-1 mb-4 text-sm">
        {[
          ["Base rate", money(p.base_rate)],
          ["Cost basis", money(p.cost_basis)],
          ["cb_factor", num(p.cb_factor)],
          ["zip_factor", num(p.zip_factor)],
          ["Rush fee", money(p.rush_fee)],
          ["Premium uplift %", pct(p.premium_uplift_pct)],
          ["Referral %", pct(p.referral_pct)],
          ["Override", money(p.override)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-slate-600">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>

      <div className="text-sm font-medium mb-2">Quick actions</div>
      <div className="flex flex-wrap gap-2">
        <Chip onClick={() => onQuickAction("Set rush to 4W $500.")}>4W Rush</Chip>
        <Chip onClick={() => onQuickAction("Set rush to 2W $1000.")}>2W Rush</Chip>
        <Chip onClick={() => onQuickAction("Set rush to No Rush.")}>No Rush</Chip>
        <Chip onClick={() => onQuickAction("Mark premium as Yes.")}>Premium ✓</Chip>
        <Chip onClick={() => onQuickAction("Mark premium as No.")}>Premium ✕</Chip>
        <Chip onClick={() => onQuickAction("Apply referral 10%.")}>Referral 10%</Chip>
        <Chip onClick={() => onQuickAction("Remove referral.")}>Referral 0%</Chip>
      </div>
    </div>
  );
}

function Chip({ children, onClick }) {
  return <button className="px-3 py-2 rounded-xl border hover:bg-slate-50" onClick={onClick}>{children}</button>;
}
function Stat({ label, value }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value ?? "—"}</div>
    </div>
  );
}
function money(n){ return n==null||isNaN(n) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"USD"}); }
function pct(n){ return n==null||isNaN(n) ? "—" : `${(n*100).toFixed(1)}%`; }
function num(n){ return n==null||isNaN(n) ? "—" : Number(n.toFixed(3)); }
