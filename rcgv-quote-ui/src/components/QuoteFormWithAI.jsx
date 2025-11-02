import { useEffect, useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";

const EXAMPLE = {
  // Contact
  name: "Alex Martinez",
  email: "alex@example.com",
  phone: "555-123-4567",
  // Property
  owner: "RCG Holdings LLC",
  address: "12345 N 84th St, Scottsdale, AZ 85260",
  zip_code: "85260",
  property_type: "Multi-Family",
  year_built: 2005,
  sqft_building: "38,000",
  acres_land: "2.0",
  floors: 2,
  multiple_properties: 1,
  // Purchase & valuation
  purchase_price: "2,550,000",
  purchase_date: "2025-06-15",
  tax_year: 2025,
  tax_deadline: "October",
  land_mode: "percent",
  land_value: "10",
  capex: "No",
  capex_date: "",
  capex_amount: "",
  is_1031: "No",
  pad_deferred_growth: "0",
  rush: "No Rush",
  price_override: ""
};

const money = (n) =>
  isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "$0.00";
const num = (v) => Number(String(v ?? "").replace(/[$,]/g, "")) || 0;
const pct = (v) => {
  const n = Number(String(v ?? "").replace(/[%]/g, ""));
  if (!isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
};

export default function QuoteFormWithAI() {
  const [form, setForm] = useState(EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const chatEndRef = useRef(null);
  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), [aiMsgs]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function compute() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const knownLand = form.land_mode === "dollars";
      const payload = {
        purchase_price: num(form.purchase_price),
        zip_code: parseInt(form.zip_code || "0", 10),
        land_value: knownLand ? num(form.land_value) : pct(form.land_value),
        known_land_value: knownLand,
        rush: form.rush,
        premium: "No",
        referral: "No",
        price_override: form.price_override ? num(form.price_override) : 0
      };

      const r = await fetch(`${apiBase}/quote/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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

  async function sendAi() {
    const content = aiInput.trim();
    if (!content) return;
    setAiInput("");
    setAiMsgs((m) => [...m, { role: "user", content }]);
    setAiBusy(true);
    try {
      const context = `Current form data (JSON): ${JSON.stringify(form)}`;
      const r = await fetch(`${apiBase}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "system", content: context }, ...aiMsgs, { role: "user", content }]
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "AI error");
      setAiMsgs((m) => [...m, { role: "assistant", content: data.reply || "(no reply)" }]);
      if (data.draft && typeof data.draft === "object") setForm((f) => ({ ...f, ...data.draft }));
    } catch (e) {
      setAiMsgs((m) => [...m, { role: "assistant", content: "Sorry, I hit an error. Try again." }]);
    } finally {
      setAiBusy(false);
    }
  }

  const onSubmit = (e) => {
    e.preventDefault();
    compute();
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header (no-print) */}
      <div className="no-print bg-white border-b-2 shadow-sm" style={{ borderColor: "#558ca5" }}>
        <div className="w-full max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <img src="https://i.imgur.com/CzRehap.jpeg" alt="RCG" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#232940" }}>RCGV Quote Assistant</h1>
            <p className="text-sm" style={{ color: "#558ca5" }}>Cost Segregation Specialists</p>
          </div>
        </div>
      </div>

      {/* AI toggle (no-print) */}
      <button
        onClick={() => setAiOpen((v) => !v)}
        className="no-print fixed bottom-8 right-8 z-40 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 border-2 border-white"
        style={{ backgroundColor: "#558ca5" }}
        aria-label="Toggle AI">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
      </button>

      {/* AI panel (no-print) */}
      {aiOpen && (
        <div className="no-print fixed bottom-28 right-8 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col border-2" style={{ borderColor: "#558ca5" }}>
          <div className="p-3 border-b font-semibold" style={{ color: "#232940" }}>AI Quote Assistant</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {aiMsgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div className={`inline-block px-3 py-2 rounded ${m.role === "user" ? "bg-blue-100" : "bg-gray-100"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t flex gap-2">
            <input 
              className="w-full border rounded px-3 py-2" 
              value={aiInput} 
              onChange={(e) => setAiInput(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && sendAi()}
              placeholder="Ask about pricing, inputs, etc." 
            />
            <button onClick={sendAi} disabled={aiBusy} className="px-3 py-2 rounded text-white" style={{ backgroundColor: "#558ca5" }}>
              {aiBusy ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="w-full max-w-4xl mx-auto p-6">
        {/* FORM (no-print) */}
        <div className="no-print bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button 
                type="button" 
                onClick={() => setForm(EXAMPLE)} 
                className="px-6 py-2.5 rounded-lg border-2 bg-white hover:bg-gray-50 transition text-sm font-medium"
                style={{ borderColor: '#558ca5', color: '#232940' }}
              >
                Use Example Data
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-lg text-white disabled:opacity-50 transition text-sm font-medium shadow-md" 
                style={{ backgroundColor: '#558ca5' }}
                disabled={busy}
              >
                {busy ? "Computing…" : "Compute Quote"}
              </button>
            </div>

            {/* Contact Information */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
              <h3 className="font-bold text-lg mb-3" style={{ color: '#232940' }}>Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.name} 
                    onChange={(e) => set("name", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input 
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.email} 
                    onChange={(e) => set("email", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.phone} 
                    onChange={(e) => set("phone", e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Property Information */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
              <h3 className="font-bold text-lg mb-3" style={{ color: '#232940' }}>Property Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Owner/Entity</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.owner} 
                    onChange={(e) => set("owner", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Property Address</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.address} 
                    onChange={(e) => set("address", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ZIP Code</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.zip_code} 
                    onChange={(e) => set("zip_code", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Property Type</label>
                  <div className="flex flex-wrap gap-2">
                    {["Multi-Family", "Office", "Retail", "Industrial", "Mixed-Use", "Hotel", "Other"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set("property_type", type)}
                        className={`px-4 py-2 rounded-md border-2 transition text-sm font-medium ${
                          form.property_type === type
                            ? "text-white font-semibold shadow-md"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                        style={form.property_type === type
                          ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                          : { borderColor: '#d1d5db' }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year Built</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.year_built} 
                    onChange={(e) => set("year_built", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Building Sq Ft</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.sqft_building} 
                    onChange={(e) => set("sqft_building", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Land (Acres)</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.acres_land} 
                    onChange={(e) => set("acres_land", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Floors</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.floors} 
                    onChange={(e) => set("floors", e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Multiple Properties</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.multiple_properties} 
                    onChange={(e) => set("multiple_properties", e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Purchase & Valuation */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f8f9fa' }}>
              <h3 className="font-bold text-lg mb-3" style={{ color: '#232940' }}>Purchase & Valuation</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Price ($)</label>
                  <input 
                    className="w-full px-3 py-2 border rounded-lg" 
                    value={form.purchase_price} 
                    onChange={(e) => set("purchase_price", e.target.value)} 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Land Value</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "10%", mode: "percent", value: "10" },
                      { label: "15%", mode: "percent", value: "15" },
                      { label: "20%", mode: "percent", value: "20" },
                      { label: "25%", mode: "percent", value: "25" },
                      { label: "No Land Value", mode: "percent", value: "0" },
                      { label: "Known Land Value", mode: "dollars", value: "" }
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          set("land_mode", opt.mode);
                          set("land_value", opt.value);
                        }}
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          form.land_mode === opt.mode && (opt.mode === "dollars" || form.land_value === opt.value)
                            ? "text-white font-semibold"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                        style={form.land_mode === opt.mode && (opt.mode === "dollars" || form.land_value === opt.value)
                          ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                          : { borderColor: '#d1d5db' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.land_mode === "dollars" && (
                    <div className="mt-3">
                      <input 
                        className="w-full px-3 py-2 border rounded-lg" 
                        value={form.land_value}
                        onChange={(e) => set("land_value", e.target.value)}
                        placeholder="Enter dollar amount"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Purchase Date</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 border rounded-lg" 
                      value={form.purchase_date} 
                      onChange={(e) => set("purchase_date", e.target.value)} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Capital Expenditures?</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => set("capex", "No")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.capex === "No"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.capex === "No"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => set("capex", "Yes")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.capex === "Yes"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.capex === "Yes"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      Yes
                    </button>
                  </div>
                  {form.capex === "Yes" && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">CapEx Amount ($)</label>
                        <input 
                          className="w-full px-3 py-2 border rounded-lg" 
                          value={form.capex_amount} 
                          onChange={(e) => set("capex_amount", e.target.value)} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">CapEx Date</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border rounded-lg" 
                          value={form.capex_date} 
                          onChange={(e) => set("capex_date", e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">1031 Exchange?</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => set("is_1031", "No")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.is_1031 === "No"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.is_1031 === "No"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => set("is_1031", "Yes")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.is_1031 === "Yes"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.is_1031 === "Yes"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      Yes
                    </button>
                  </div>
                  {form.is_1031 === "Yes" && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium mb-1">PAD Deferred Growth ($)</label>
                      <input 
                        className="w-full px-3 py-2 border rounded-lg" 
                        value={form.pad_deferred_growth}
                        onChange={(e) => set("pad_deferred_growth", e.target.value)}
                        placeholder="Enter dollar amount"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tax Year</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg" 
                      value={form.tax_year} 
                      onChange={(e) => set("tax_year", e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tax Deadline</label>
                    <select 
                      className="w-full px-3 py-2 border rounded-lg" 
                      value={form.tax_deadline} 
                      onChange={(e) => set("tax_deadline", e.target.value)}
                    >
                      <option>April</option>
                      <option>October</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Rush Processing</label>
                  <div className="flex flex-wrap gap-2">
                    {["No Rush", "4W $500", "2W $1000"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set("rush", opt)}
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          form.rush === opt
                            ? "text-white font-semibold"
                            : "border-gray-300 bg-white hover:border-gray-400"
                        }`}
                        style={form.rush === opt
                          ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                          : { borderColor: '#d1d5db' }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Options */}
            <div className="border-2 p-4 rounded-lg" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: '#232940' }}>
                <span>⚠️ Internal Use Only</span>
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1">Price Override (optional)</label>
                <input 
                  className="w-full px-3 py-2 border rounded-lg bg-white" 
                  value={form.price_override} 
                  onChange={(e) => set("price_override", e.target.value)} 
                  placeholder="Leave blank for standard pricing"
                />
                <p className="text-xs text-gray-600 mt-1">Only use this field to manually override the calculated price</p>
              </div>
            </div>

            {err && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>
            )}
          </form>
        </div>

        {/* PDF Display */}
        <PDFDisplay result={result} form={form} />
      </div>
    </div>
  );
}

/* ---------------- PDF Display Component ---------------- */
function PDFDisplay({ result, form }) {
  if (!result) return (
    <div className="bg-white p-4 rounded-lg shadow-sm text-center text-gray-400">
      Fill the form and click <strong>Compute Quote</strong> to generate your PDF.
    </div>
  );

  const now = new Date();
  const expires = new Date(now); 
  expires.setDate(expires.getDate() + 30);

  const purchasePrice = num(form.purchase_price);
  const landVal = form.land_mode === "dollars" ? num(form.land_value) : purchasePrice * pct(form.land_value);
  const buildingValue = purchasePrice - landVal;

  const baseQuote = result.base_quote ?? result.final_quote ?? 0;

  const seasonal = (() => {
    const m = now.getMonth() + 1, d = now.getDate();
    if ((m === 10 && d >= 15) || (m === 11 && d <= 15) || (m === 4 && d >= 15) || (m === 5 && d <= 15))
      return { rate: 0.10, label: "10% Seasonal Discount!" };
    if ((m === 11 && d >= 16) || (m === 12 && d <= 15) || (m === 5 && d >= 16) || (m === 6 && d <= 15))
      return { rate: 0.05, label: "5% Seasonal Discount!" };
    return { rate: 0, label: null };
  })();

  const disc = 1 - seasonal.rate;
  const upfront = baseQuote * 0.91 * disc;
  const split5050 = (baseQuote / 2) * disc;
  const payOverTime = (baseQuote / 4) * disc;
  const standardBeforeDiscounts = baseQuote * disc;

  const schedule = [
    { y: 2025, cs: 66073, sd: 113694, ts: 113694, bd: 569423 },
    { y: 2026, cs: 83446, sd: 177172, ts: 177172, bd: 102805 },
    { y: 2027, cs: 83446, sd: 145582, ts: 145582, bd: 90169 },
    { y: 2028, cs: 83446, sd: 124860, ts: 124860, bd: 81881 },
    { y: 2029, cs: 83446, sd: 120001, ts: 120001, bd: 79937 },
    { y: 2030, cs: 83446, sd: 104065, ts: 104065, bd: 73563 },
    { y: 2031, cs: 83446, sd: 90465, ts: 90465, bd: 68122 },
    { y: 2032, cs: 83446, sd: 90465, ts: 90465, bd: 68122 },
    { y: 2033, cs: 83446, sd: 90528, ts: 90528, bd: 68148 },
    { y: 2034, cs: 83469, sd: 90479, ts: 90479, bd: 68137 },
    { y: 2035, cs: 83446, sd: 90528, ts: 90528, bd: 68148 },
    { y: 2036, cs: 83469, sd: 90479, ts: 90479, bd: 68137 },
    { y: 2037, cs: 83446, sd: 90528, ts: 90528, bd: 68148 },
    { y: 2038, cs: 83469, sd: 90479, ts: 90479, bd: 68137 },
    { y: 2039, cs: 83446, sd: 90528, ts: 90528, bd: 68148 },
    { y: 2040, cs: 83469, sd: 71861, ts: 71861, bd: 60690 },
    { y: 2041, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2042, cs: 83469, sd: 53242, ts: 53242, bd: 53242 },
    { y: 2043, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2044, cs: 83469, sd: 53242, ts: 53242, bd: 53242 },
    { y: 2045, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2046, cs: 83469, sd: 53242, ts: 53242, bd: 53242 },
    { y: 2047, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2048, cs: 83469, sd: 53242, ts: 53242, bd: 53242 },
    { y: 2049, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2050, cs: 83469, sd: 53242, ts: 53242, bd: 53242 },
    { y: 2051, cs: 83446, sd: 53228, ts: 53228, bd: 53228 },
    { y: 2052, cs: 59119, sd: 37710, ts: 37710, bd: 37710 }
  ];
  
  const tots = schedule.reduce((a, r) => ({
    cs: a.cs + r.cs, sd: a.sd + r.sd, ts: a.ts + r.ts, bd: a.bd + r.bd
  }), { cs: 0, sd: 0, ts: 0, bd: 0 });

  return (
    <div id="quote-pdf" className="pdf-display w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-8">
      {/* Header bar */}
      <div className="text-white p-8 relative" style={{ background: "linear-gradient(to right, #232940, #558ca5)" }}>
        {seasonal.label && (
          <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
            🎉 {seasonal.label}
          </div>
        )}
        <div className="flex items-center gap-6">
          <div className="bg-white p-3 rounded-lg shadow-lg">
            <img src="https://i.imgur.com/CzRehap.jpeg" alt="RCG Logo" className="h-16 w-16 object-contain" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Cost Segregation Quote</h1>
            <p className="text-blue-200 text-lg tracking-wider">VALUATION</p>
          </div>
        </div>
      </div>

      {/* Validity */}
      <div className="bg-yellow-50 border-b-2 border-yellow-300 px-8 py-3 flex justify-between items-center">
        <div>
          <span className="font-semibold text-gray-700">Quote Date:</span>
          <span className="ml-2 text-gray-900">
            {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <div className="bg-red-100 border border-red-300 px-4 py-1 rounded-full">
          <span className="font-semibold text-red-700">Valid Until:</span>
          <span className="ml-2 text-red-900 font-bold">
            {expires.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Company + Contact */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Company Information</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Owner:</span> {form.owner}</div>
              <div><span className="font-semibold">Property:</span> {form.address}</div>
              <div><span className="font-semibold">Type:</span> {form.property_type}</div>
              <div><span className="font-semibold">Year Built:</span> {form.year_built}</div>
              <div><span className="font-semibold">Building Area:</span> {num(form.sqft_building).toLocaleString()} sq ft</div>
              <div><span className="font-semibold">Land Area:</span> {form.acres_land} acres</div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Contact Information</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Name:</span> {form.name}</div>
              <div><span className="font-semibold">Email:</span> {form.email}</div>
              <div><span className="font-semibold">Phone:</span> {form.phone}</div>
              <div><span className="font-semibold">Purchase Date:</span> {form.purchase_date}</div>
              <div><span className="font-semibold">Tax Year:</span> {form.tax_year}</div>
              <div><span className="font-semibold">Tax Deadline:</span> {form.tax_deadline}</div>
            </div>
          </div>
        </div>

        {/* Fee structure */}
        <div className="border-2 rounded-lg p-6" style={{ backgroundColor: "#e8f4f8", borderColor: "#558ca5" }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: "#232940" }}>Professional Fee Structure</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-green-400 shadow-sm">
              <div className="text-sm font-semibold text-gray-600 mb-1">Pay Upfront (9% Discount)</div>
              <div className="text-3xl font-bold text-green-600">{money(upfront)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-blue-400 shadow-sm">
              <div className="text-sm font-semibold text-gray-600 mb-1">50/50 Split</div>
              <div className="text-3xl font-bold text-blue-600">{money(split5050)}</div>
              <div className="text-xs text-gray-500 mt-1">Now / Upon Completion</div>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-purple-400 shadow-sm">
              <div className="text-sm font-semibold text-gray-600 mb-1">Pay Over Time</div>
              <div className="text-3xl font-bold text-purple-600">{money(payOverTime)}</div>
              <div className="text-xs text-gray-500 mt-1">Quarterly installments</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Standard Fee (before discounts):</div>
            <div className="text-2xl font-bold text-gray-900">{money(standardBeforeDiscounts)}</div>
          </div>
        </div>

        {/* Valuation Breakdown */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Valuation Breakdown</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="font-semibold">Purchase Price:</span><span>{money(purchasePrice)}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Land Value:</span><span>{money(landVal)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Building Value:</span><span className="font-bold">{money(buildingValue)}</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="font-semibold">Base Quote:</span><span>{money(baseQuote)}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Rush Fee:</span><span>{form.rush !== "No Rush" ? form.rush : "None"}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Final Quote:</span><span className="font-bold text-blue-600">{money(result.final_quote)}</span></div>
            </div>
          </div>
        </div>

        {/* Force page break for printing */}
        <div className="page-break"></div>

        {/* Depreciation table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800 to-gray-600 text-white p-4">
            <h2 className="text-xl font-bold">27.5-Year Depreciation Schedule</h2>
            <p className="text-sm text-gray-300 mt-1">Estimated Annual Depreciation Comparison</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Year</th>
                  <th className="px-4 py-3 text-right font-bold">Cost Seg Est.</th>
                  <th className="px-4 py-3 text-right font-bold">Std. Depreciation</th>
                  <th className="px-4 py-3 text-right font-bold">Traditional Cost Seg</th>
                  <th className="px-4 py-3 text-right font-bold">Bonus Depreciation</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2 font-semibold">{r.y}</td>
                    <td className="px-4 py-2 text-right">{money(r.cs)}</td>
                    <td className="px-4 py-2 text-right">{money(r.sd)}</td>
                    <td className="px-4 py-2 text-right">{money(r.ts)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">{money(r.bd)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-100 border-t-2 border-blue-300 font-bold">
                  <td className="px-4 py-3">TOTALS</td>
                  <td className="px-4 py-3 text-right">{money(tots.cs)}</td>
                  <td className="px-4 py-3 text-right">{money(tots.sd)}</td>
                  <td className="px-4 py-3 text-right">{money(tots.ts)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{money(tots.bd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer + Print button */}
        <div className="text-center space-y-3">
          <button
            onClick={() => window.print()}
            className="no-print text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
            style={{ backgroundColor: "#558ca5" }}
          >
            Print or Save as PDF
          </button>
          <p className="text-sm text-gray-600">This quote is valid for 30 days from the quote date above</p>
        </div>
      </div>

      <div className="bg-gray-100 border-t-2 border-gray-300 p-6 text-center text-xs text-gray-600">
        <p className="font-semibold">Quote Generated: {now.toLocaleDateString()}</p>
        <p className="mt-1 text-red-600 font-semibold">Valid Until: {expires.toLocaleDateString()} (30 days)</p>
        <p className="mt-3 text-gray-500">RCG Valuation • Cost Segregation Specialists</p>
      </div>
    </div>
  );
}