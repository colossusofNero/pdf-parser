// src/components/QuoteForm.jsx
import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "";
const OVERRIDE_PASS = import.meta.env.VITE_OVERRIDE_PASS || "";

/** One-click example for learning (ALL FIELDS) */
const EXAMPLE = {
  // Contact / property identity
  name: "Alex Martinez",
  email: "alex@example.com",
  phone: "555-123-4567",
  owner: "RCG Holdings LLC",
  address: "12345 N 84th St, Scottsdale, AZ 85260",

  // Deal timing
  purchase_date: "2025-06-15",
  tax_year: 2025,
  tax_deadline: "October",

  // Pricing drivers (required for compute)
  purchase_price: "2,550,000",
  zip_code: "85260",
  land_mode: "percent", // "percent" | "dollars"
  land_value: "10",     // 10% if percent, $ if dollars

  // Investment details
  capex: "No",                // "Yes" | "No"
  capex_date: "",
  capex_amount: "",
  is_1031: "No",              // "Yes" | "No"
  pad_deferred_growth: "0",   // $ amount

  // Physicals
  year_built: 2005,
  sqft_building: "38,000",
  acres_land: "2.0",
  property_type: "Multi-Family",
  floors: 2,
  multiple_properties: 1,

  // Commercial terms
  rush: "No Rush",            // "No Rush" | "4W $500" | "2W $1000"
  price_override: ""
};

export default function QuoteForm() {
  const [form, setForm] = useState(EXAMPLE); // prefill
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setForm(EXAMPLE);
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // helpers
  const toNumber = (x) => Number(String(x ?? "").replace(/[$,]/g, "")) || 0;
  const toPercent = (x) => {
    const n = Number(String(x ?? "").replace(/[%]/g, ""));
    if (!isFinite(n)) return 0;
    return n > 1 ? n / 100 : n;
  };
  const money = (n) =>
    isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "â€”";

  function fillExample() {
    setForm(EXAMPLE);
    setErr("");
    setResult(null);
  }

  async function compute() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      // Use entered OR example values for compute-required fields
      const src = {
        purchase_price: form.purchase_price || EXAMPLE.purchase_price,
        zip_code: form.zip_code || EXAMPLE.zip_code,
        land_mode: form.land_mode || EXAMPLE.land_mode,
        land_value: form.land_value || EXAMPLE.land_value,
        rush: form.rush || EXAMPLE.rush,
        price_override: form.price_override || ""
      };

      const known_land_value = src.land_mode === "dollars";
      const payloadCompute = {
        purchase_price: toNumber(src.purchase_price),
        zip_code: parseInt(src.zip_code || "0", 10),
        land_value: known_land_value ? toNumber(src.land_value) : toPercent(src.land_value),
        known_land_value,
        rush: src.rush,
        premium: "No",
        referral: "No",
        price_override: src.price_override ? toNumber(src.price_override) : 0
      };

      // Save everything (backend tolerates extra fields)
      const payloadAll = {
        // identity
        name: form.name,
        email: form.email,
        phone: form.phone,
        owner: form.owner,
        address: form.address,

        // timing
        purchase_date: form.purchase_date,
        tax_year: Number(form.tax_year) || EXAMPLE.tax_year,
        tax_deadline: form.tax_deadline,

        // pricing drivers
        purchase_price: toNumber(form.purchase_price || EXAMPLE.purchase_price),
        zip_code: parseInt(form.zip_code || EXAMPLE.zip_code, 10),
        land_value: form.land_value || EXAMPLE.land_value,
        land_mode: form.land_mode || EXAMPLE.land_mode,

        // investment
        capex: form.capex,
        capex_date: form.capex === "Yes" ? form.capex_date : "",
        capex_amount: form.capex === "Yes" ? toNumber(form.capex_amount) : 0,
        is_1031: form.is_1031,
        pad_deferred_growth: toNumber(form.pad_deferred_growth || "0"),

        // physicals
        year_built: Number(form.year_built) || EXAMPLE.year_built,
        sqft_building: toNumber(form.sqft_building),
        acres_land: Number(String(form.acres_land || "").replace(/[,]/g, "")) || 0,
        property_type: form.property_type,
        floors: Number(form.floors) || 1,
        multiple_properties: Number(form.multiple_properties) || 1,

        // terms
        rush: form.rush,
        price_override: toNumber(form.price_override || "0")
      };

      // Best-effort save
      await fetch(`${apiBase}/quote/set_inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadAll)
      }).catch(() => {});

      // Compute
      const headers = { "Content-Type": "application/json" };
      if (payloadCompute.price_override > 0 && OVERRIDE_PASS) {
        headers["X-Override-Password"] = OVERRIDE_PASS;
      }
      const r = await fetch(`${apiBase}/quote/compute`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadCompute)
      });
      const text = await r.text();
      if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
      setResult(JSON.parse(text));
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); compute(); }}>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={fillExample} className="px-4 py-2 rounded-xl border bg-white">
          Use Example Data
        </button>
        <button type="submit" className="px-5 py-2 rounded-xl bg-sky-600 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Computingâ€¦" : "Compute Quote"}
        </button>
      </div>

      {/* Contact & Property Identity */}
      <Section title="Contact & Property">
        <Grid>
          <Field label="Name">
            <input className="field" value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Email">
            <input className="field" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" />
          </Field>
          <Field label="Phone">
            <input className="field" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" />
          </Field>
          <Field label="Legal Property Owner">
            <input className="field" value={form.owner || ""} onChange={(e) => set("owner", e.target.value)} placeholder="RCG Holdings LLC" />
          </Field>
          <Field label="Address (incl. ZIP)">
            <input className="field" value={form.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="12345 N 84th St, Scottsdale, AZ 85260" />
          </Field>
        </Grid>
      </Section>

      {/* Deal Timing */}
      <Section title="Deal Timing">
        <Grid>
          <Field label="Date of Purchase">
            <input type="date" className="field" value={form.purchase_date || ""} onChange={(e) => set("purchase_date", e.target.value)} />
          </Field>
          <Field label="Tax Year">
            <select className="field" value={form.tax_year || ""} onChange={(e) => set("tax_year", e.target.value)}>
              {Array.from({ length: 6 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Tax Deadline">
            <select className="field" value={form.tax_deadline || ""} onChange={(e) => set("tax_deadline", e.target.value)}>
              <option>March</option>
              <option>April</option>
              <option>October</option>
              <option>Other</option>
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Required for Compute */}
      <Section title="Core Pricing Inputs (Required)">
        <Grid>
          <Field label="Purchase Price ($)">
            <input className="field" value={form.purchase_price || ""} onChange={(e) => set("purchase_price", e.target.value)} placeholder="$2,550,000" aria-label="Purchase Price ($)" />
          </Field>
          <Field label="ZIP Code">
            <input className="field" value={form.zip_code || ""} onChange={(e) => set("zip_code", e.target.value)} placeholder="85260" aria-label="ZIP Code" />
          </Field>
          <Field label="Land Value input">
            <div className="flex gap-2">
              <TabBtn active={form.land_mode === "percent"} onClick={() => set("land_mode", "percent")}>Percent (0â€“100)</TabBtn>
              <TabBtn active={form.land_mode === "dollars"} onClick={() => set("land_mode", "dollars")}>Dollars ($)</TabBtn>
            </div>
          </Field>
          <Field label={form.land_mode === "percent" ? "Land % of Price" : "Land $ Amount"}>
            <input className="field" value={form.land_value || ""} onChange={(e) => set("land_value", e.target.value)} placeholder={form.land_mode === "percent" ? "10" : "250,000"} aria-label="Land Value" />
          </Field>
          <Field label="Rush">
            <select className="field" value={form.rush || ""} onChange={(e) => set("rush", e.target.value)} aria-label="Rush">
              <option>No Rush</option>
              <option>4W $500</option>
              <option>2W $1000</option>
            </select>
          </Field>
          <Field label="Price Override ($) â€” requires password">
            <input className="field" value={form.price_override || ""} onChange={(e) => set("price_override", e.target.value)} placeholder="(optional)" aria-label="Price Override" />
          </Field>
        </Grid>
      </Section>

      {/* Investment Details */}
      <Section title="Investment Details">
        <Grid>
          <Field label="Capital Improvements">
            <div className="flex gap-2">
              <RadioBtn name="capex" label="No" checked={form.capex === "No"} onChange={() => set("capex", "No")} />
              <RadioBtn name="capex" label="Yes" checked={form.capex === "Yes"} onChange={() => set("capex", "Yes")} />
            </div>
          </Field>
          {form.capex === "Yes" && (
            <>
              <Field label="Capital Improvements Date">
                <input type="date" className="field" value={form.capex_date || ""} onChange={(e) => set("capex_date", e.target.value)} />
              </Field>
              <Field label="Capital Improvements Amount ($)">
                <input className="field" value={form.capex_amount || ""} onChange={(e) => set("capex_amount", e.target.value)} placeholder="150,000" />
              </Field>
            </>
          )}
          <Field label="1031 Exchange">
            <div className="flex gap-2">
              <RadioBtn name="is_1031" label="No" checked={form.is_1031 === "No"} onChange={() => set("is_1031", "No")} />
              <RadioBtn name="is_1031" label="Yes" checked={form.is_1031 === "Yes"} onChange={() => set("is_1031", "Yes")} />
            </div>
          </Field>
          <Field label="PAD & Deferred Growth ($)">
            <input className="field" value={form.pad_deferred_growth || ""} onChange={(e) => set("pad_deferred_growth", e.target.value)} placeholder="0" />
          </Field>
        </Grid>
      </Section>

      {/* Physicals */}
      <Section title="Physical Details">
        <Grid>
          <Field label="Year Built">
            <select className="field" value={form.year_built || ""} onChange={(e) => set("year_built", e.target.value)}>
              {Array.from({ length: 86 }, (_, i) => 1940 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="SqFt Building">
            <input className="field" value={form.sqft_building || ""} onChange={(e) => set("sqft_building", e.target.value)} placeholder="38,000" />
          </Field>
          <Field label="Acres Land">
            <input className="field" value={form.acres_land || ""} onChange={(e) => set("acres_land", e.target.value)} placeholder="2.0" />
          </Field>
          <Field label="Type of Property">
            <select className="field" value={form.property_type || ""} onChange={(e) => set("property_type", e.target.value)}>
              <option>Multi-Family</option>
              <option>Office</option>
              <option>Retail</option>
              <option>Industrial</option>
              <option>Hotel</option>
              <option>Medical</option>
              <option>Self-Storage</option>
              <option>Mixed-Use</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Number of Floors">
            <select className="field" value={form.floors || 1} onChange={(e) => set("floors", e.target.value)}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Multiple Properties">
            <select className="field" value={form.multiple_properties || 1} onChange={(e) => set("multiple_properties", e.target.value)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      {err && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm whitespace-pre-wrap">{err}</div>
      )}

      {result && (
        <div className="card p-5">
          <h3 className="text-lg font-semibold mb-2">Quote Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <KV label="Base" value={money(result.base_quote)} />
            <KV label="Final" value={money(result.final_quote)} />
          </div>
          <div className="mt-4 border-t pt-3 text-sm">
            {Object.entries(result.parts || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5">
                <span className="text-slate-600">{k}</span>
                <span className="font-medium">
                  {typeof v === "number" ? money(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

/* UI bits */
function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border ${active ? "bg-sky-600 text-white border-sky-600" : "bg-white"}`}
    >
      {children}
    </button>
  );
}

function RadioBtn({ name, label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
