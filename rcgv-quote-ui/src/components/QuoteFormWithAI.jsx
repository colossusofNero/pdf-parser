// src/components/QuoteFormWithAI.jsx
import { useEffect, useState, useRef } from "react";

const apiBase = "";
const OVERRIDE_PASS = "";

const EXAMPLE = {
  name: "Alex Martinez",
  email: "alex@example.com",
  phone: "555-123-4567",
  owner: "RCG Holdings LLC",
  address: "12345 N 84th St, Scottsdale, AZ 85260",
  purchase_date: "2025-06-15",
  tax_year: 2025,
  tax_deadline: "October",
  purchase_price: "2,550,000",
  zip_code: "85260",
  land_mode: "percent",
  land_value: "10",
  capex: "No",
  capex_date: "",
  capex_amount: "",
  is_1031: "No",
  pad_deferred_growth: "0",
  year_built: 2005,
  sqft_building: "38,000",
  acres_land: "2.0",
  property_type: "Multi-Family",
  floors: 2,
  multiple_properties: 1,
  rush: "No Rush",
  price_override: ""
};

export default function QuoteFormWithAI() {
  const [form, setForm] = useState(EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // AI Assistant state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toNumber = (x) => Number(String(x ?? "").replace(/[$,]/g, "")) || 0;
  const toPercent = (x) => {
    const n = Number(String(x ?? "").replace(/[%]/g, ""));
    return !isFinite(n) ? 0 : n > 1 ? n / 100 : n;
  };
  const money = (n) =>
    isFinite(n)
      ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : "—";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  async function compute() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
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
        land_value: known_land_value
          ? toNumber(src.land_value)
          : toPercent(src.land_value),
        known_land_value,
        rush: src.rush,
        premium: "No",
        referral: "No",
        price_override: src.price_override ? toNumber(src.price_override) : 0
      };

      const r = await fetch(`${apiBase}/quote/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function sendAiMessage() {
    if (!aiInput.trim()) return;

    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setAiLoading(true);

    try {
      const context = `Current form data: ${JSON.stringify(form, null, 2)}`;
      const response = await fetch(`${apiBase}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: context },
            ...aiMessages,
            { role: "user", content: userMsg }
          ]
        })
      });

      if (!response.ok) throw new Error("AI request failed");

      const data = await response.json();
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply }
      ]);

      if (data.draft) {
        setForm((f) => ({ ...f, ...data.draft }));
      }
    } catch (e) {
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." }
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  // ---------- PDF DISPLAY ----------
  const PDFDisplay = ({ quoteData, formData }) => {
    if (!quoteData) return null;

    const formatMoney = (n) =>
      n == null || isNaN(n)
        ? "$0.00"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
          }).format(n);

    const formatNumber = (n) =>
      n == null || isNaN(n) ? "0" : Number(n).toLocaleString();

    const getSeasonalDiscount = () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      if (
        (month === 10 && day >= 15) ||
        (month === 11 && day <= 15) ||
        (month === 4 && day >= 15) ||
        (month === 5 && day <= 15)
      ) {
        return { rate: 0.1, label: "10% Seasonal Discount!" };
      }
      if (
        (month === 11 && day >= 16) ||
        (month === 12 && day <= 15) ||
        (month === 5 && day >= 16) ||
        (month === 6 && day <= 15)
      ) {
        return { rate: 0.05, label: "5% Seasonal Discount!" };
      }
      return { rate: 0, label: null };
    };

    const seasonalDiscount = getSeasonalDiscount();
    const quoteDate = new Date();
    const expirationDate = new Date(quoteDate);
    expirationDate.setDate(expirationDate.getDate() + 30);

    const purchasePrice = toNumber(formData.purchase_price);
    const landValue =
      formData.land_mode === "percent"
        ? purchasePrice * (parseFloat(formData.land_value || 0) / 100)
        : toNumber(formData.land_value);
    const buildingValue = purchasePrice - landValue;
    const parts = quoteData.parts || {};
    const baseQuote = quoteData.base_quote || quoteData.final_quote || 0;

    const discountMultiplier = 1 - seasonalDiscount.rate;
    const payUpfront = baseQuote * 0.91 * discountMultiplier;
    const pay5050 = (baseQuote / 2) * discountMultiplier;
    const payOverTime = (baseQuote / 4) * discountMultiplier;
    const originalWithSeasonal = baseQuote * discountMultiplier;

    const fullSchedule = [
      { year: 2025, cost_seg_est: 66073, std_dep: 113694, trad_cost_seg: 113694, bonus_dep: 569423 },
      { year: 2026, cost_seg_est: 83446, std_dep: 177172, trad_cost_seg: 177172, bonus_dep: 102805 },
      // ... (rest of the years unchanged)
      { year: 2052, cost_seg_est: 59119, std_dep: 37710, trad_cost_seg: 37710, bonus_dep: 37710 }
    ];

    const totals = {
      cost_seg_est: fullSchedule.reduce((s, r) => s + r.cost_seg_est, 0),
      std_dep: fullSchedule.reduce((s, r) => s + r.std_dep, 0),
      trad_cost_seg: fullSchedule.reduce((s, r) => s + r.trad_cost_seg, 0),
      bonus_dep: fullSchedule.reduce((s, r) => s + r.bonus_dep, 0)
    };

    return (
      // >>> Only this section prints
      <div id="quote-pdf" className="pdf-display w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-8">
        {/* Professional Header */}
        <div className="text-white p-8 relative" style={{ background: "linear-gradient(to right, #232940, #558ca5)" }}>
          {seasonalDiscount.label && (
            <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
              🎉 {seasonalDiscount.label}
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

        {/* Validity Banner */}
        <div className="bg-yellow-50 border-b-2 border-yellow-300 px-8 py-3 flex justify-between items-center">
          <div>
            <span className="font-semibold text-gray-700">Quote Date:</span>
            <span className="ml-2 text-gray-900">
              {quoteDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="bg-red-100 border border-red-300 px-4 py-1 rounded-full">
            <span className="font-semibold text-red-700">Valid Until:</span>
            <span className="ml-2 text-red-900 font-bold">
              {expirationDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Company & Contact Info */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Company Information</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold">Owner:</span> {formData.owner}</div>
                <div><span className="font-semibold">Property:</span> {formData.address}</div>
                <div><span className="font-semibold">Type:</span> {formData.property_type}</div>
                <div><span className="font-semibold">Year Built:</span> {formData.year_built}</div>
                <div><span className="font-semibold">Building Area:</span> {formatNumber(toNumber(formData.sqft_building))} sq ft</div>
                <div><span className="font-semibold">Land Area:</span> {formData.acres_land} acres</div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Contact Information</h2>
              <div className="space-y-2 text-sm">
                <div><span className="font-semibold">Name:</span> {formData.name}</div>
                <div><span className="font-semibold">Email:</span> {formData.email}</div>
                <div><span className="font-semibold">Phone:</span> {formData.phone}</div>
                <div><span className="font-semibold">Purchase Date:</span> {formData.purchase_date}</div>
                <div><span className="font-semibold">Tax Year:</span> {formData.tax_year}</div>
                <div><span className="font-semibold">Tax Deadline:</span> {formData.tax_deadline}</div>
              </div>
            </div>
          </div>

          {/* Professional Fee Structure */}
          <div className="border-2 rounded-lg p-6" style={{ backgroundColor: "#e8f4f8", borderColor: "#558ca5" }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#232940" }}>Professional Fee Structure</h2>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border-2 border-green-400 shadow-sm">
                <div className="text-sm font-semibold text-gray-600 mb-1">Pay Upfront (9% Discount)</div>
                <div className="text-3xl font-bold text-green-600">{formatMoney(payUpfront)}</div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-blue-400 shadow-sm">
                <div className="text-sm font-semibold text-gray-600 mb-1">50/50 Split</div>
                <div className="text-3xl font-bold text-blue-600">{formatMoney(pay5050)}</div>
                <div className="text-xs text-gray-500 mt-1">Now / Upon Completion</div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-purple-400 shadow-sm">
                <div className="text-sm font-semibold text-gray-600 mb-1">Pay Over Time</div>
                <div className="text-3xl font-bold text-purple-600">{formatMoney(payOverTime)}</div>
                <div className="text-xs text-gray-500 mt-1">Quarterly installments</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Standard Fee (before discounts):</div>
              <div className="text-2xl font-bold text-gray-900">{formatMoney(originalWithSeasonal)}</div>
            </div>
          </div>

          {/* Valuation Breakdown */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Valuation Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="font-semibold">Purchase Price:</span><span>{formatMoney(purchasePrice)}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Land Value:</span><span>{formatMoney(landValue)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Building Value:</span><span className="font-bold">{formatMoney(buildingValue)}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="font-semibold">Base Quote:</span><span>{formatMoney(baseQuote)}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Rush Fee:</span><span>{formData.rush !== "No Rush" ? formData.rush : "None"}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Final Quote:</span><span className="font-bold text-blue-600">{formatMoney(quoteData.final_quote)}</span></div>
              </div>
            </div>
          </div>

          {/* --- force the page break between page 1 and 2 --- */}
          <div className="page-break"></div>

          {/* Depreciation Schedule */}
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
                  {fullSchedule.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2 font-semibold">{row.year}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.cost_seg_est)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.std_dep)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.trad_cost_seg)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-green-600">{formatMoney(row.bonus_dep)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 border-t-2 border-blue-300 font-bold">
                    <td className="px-4 py-3">TOTALS</td>
                    <td className="px-4 py-3 text-right">{formatMoney(totals.cost_seg_est)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(totals.std_dep)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(totals.trad_cost_seg)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatMoney(totals.bonus_dep)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Key Tax Benefits</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-green-700 mb-2">✓ Accelerated Depreciation</div>
                <p className="text-gray-700">Maximize first-year deductions with bonus depreciation strategies</p>
              </div>
              <div>
                <div className="font-semibold text-green-700 mb-2">✓ Improved Cash Flow</div>
                <p className="text-gray-700">Reduce tax liability and increase available capital</p>
              </div>
              <div>
                <div className="font-semibold text-green-700 mb-2">✓ IRS-Compliant</div>
                <p className="text-gray-700">Detailed engineering-based study meets all IRS requirements</p>
              </div>
              <div>
                <div className="font-semibold text-green-700 mb-2">✓ Professional Guarantee</div>
                <p className="text-gray-700">Full audit support and defense included</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center space-y-3">
            <button
              onClick={() => window.print()}
              className="no-print text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
              style={{ backgroundColor: "#558ca5" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#457a8f")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#558ca5")}
            >
              Print or Save as PDF
            </button>
            <p className="text-sm text-gray-600">This quote is valid for 30 days from the quote date above</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t-2 border-gray-300 p-6 text-center text-xs text-gray-600">
          <p className="font-semibold">Quote Generated: {quoteDate.toLocaleDateString()}</p>
          <p className="mt-1 text-red-600 font-semibold">Valid Until: {expirationDate.toLocaleDateString()} (30 days)</p>
          <p className="mt-3 text-gray-500">RCG Valuation • Cost Segregation Specialists</p>
        </div>
      </div>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    compute();
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header with Logo (don’t print) */}
      <div className="no-print bg-white border-b-2 shadow-sm" style={{ borderColor: "#558ca5" }}>
        <div className="w-full max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <img
              src="https://i.imgur.com/CzRehap.jpeg"
              alt="RCGV Logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#232940" }}>RCGV Quote Assistant</h1>
            <p className="text-sm" style={{ color: "#558ca5" }}>Cost Segregation Specialists</p>
          </div>
        </div>
      </div>

      {/* AI Assistant Floating Button (don’t print) */}
      <button
        onClick={() => setAiOpen(!aiOpen)}
        className="no-print fixed bottom-8 right-8 z-40 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 border-2 border-white"
        style={{ backgroundColor: "#558ca5" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#457a8f")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#558ca5")}
        aria-label="Toggle AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* AI Chat Panel (don’t print) */}
      {aiOpen && (
        <div className="no-print fixed bottom-28 right-8 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col border-2" style={{ borderColor: "#558ca5" }}>
          {/* ...existing AI panel content unchanged... */}
          {/* (Keep your chat markup; add no-print only to the wrapper as shown) */}
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-4xl mx-auto p-6">
        {/* Form Section (don’t print) */}
        <div className="no-print bg-white rounded-lg shadow-md p-6 mb-8">
          {/* ...existing form fields & Compute button... */}
          {/* Keep your form as-is; wrapper now has no-print */}
        </div>

        {/* PDF output */}
        <PDFDisplay quoteData={result} formData={form} />

        {/* Errors */}
        {err && (
          <div className="no-print mt-4 text-red-600">
            <strong>Error:</strong> {err}
          </div>
        )}
      </div>
    </div>
  );
}
