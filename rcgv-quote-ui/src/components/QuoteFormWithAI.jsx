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
  const money = (n) => isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

  // Auto-scroll chat
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
        land_value: known_land_value ? toNumber(src.land_value) : toPercent(src.land_value),
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
    setAiMessages(prev => [...prev, { role: "user", content: userMsg }]);
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
      setAiMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      
      // If AI suggests form updates, apply them
      if (data.draft) {
        setForm(f => ({ ...f, ...data.draft }));
      }
    } catch (e) {
      setAiMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setAiLoading(false);
    }
  }

  // PDF Display Component
  const PDFDisplay = ({ quoteData, formData }) => {
    if (!quoteData) return null;

    const formatMoney = (n) => {
      return n == null || isNaN(n) 
        ? "$0.00" 
        : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    };

    const formatNumber = (n) => {
      return n == null || isNaN(n) ? "0" : Number(n).toLocaleString();
    };

    const getSeasonalDiscount = () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      
      if ((month === 10 && day >= 15) || (month === 11 && day <= 15) ||
          (month === 4 && day >= 15) || (month === 5 && day <= 15)) {
        return { rate: 0.10, label: "10% Seasonal Discount!" };
      }
      
      if ((month === 11 && day >= 16) || (month === 12 && day <= 15) ||
          (month === 5 && day >= 16) || (month === 6 && day <= 15)) {
        return { rate: 0.05, label: "5% Seasonal Discount!" };
      }
      
      return { rate: 0, label: null };
    };

    const seasonalDiscount = getSeasonalDiscount();
    const quoteDate = new Date();
    const expirationDate = new Date(quoteDate);
    expirationDate.setDate(expirationDate.getDate() + 30);

    const purchasePrice = toNumber(formData.purchase_price);
    const landValue = formData.land_mode === 'percent' 
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
      {year: 2025, cost_seg_est: 66073, std_dep: 113694, trad_cost_seg: 113694, bonus_dep: 569423},
      {year: 2026, cost_seg_est: 83446, std_dep: 177172, trad_cost_seg: 177172, bonus_dep: 102805},
      {year: 2027, cost_seg_est: 83446, std_dep: 145582, trad_cost_seg: 145582, bonus_dep: 90169},
      {year: 2028, cost_seg_est: 83446, std_dep: 124860, trad_cost_seg: 124860, bonus_dep: 81881},
      {year: 2029, cost_seg_est: 83446, std_dep: 120001, trad_cost_seg: 120001, bonus_dep: 79937},
      {year: 2030, cost_seg_est: 83446, std_dep: 104065, trad_cost_seg: 104065, bonus_dep: 73563},
      {year: 2031, cost_seg_est: 83446, std_dep: 90465, trad_cost_seg: 90465, bonus_dep: 68122},
      {year: 2032, cost_seg_est: 83446, std_dep: 90465, trad_cost_seg: 90465, bonus_dep: 68122},
      {year: 2033, cost_seg_est: 83446, std_dep: 90528, trad_cost_seg: 90528, bonus_dep: 68148},
      {year: 2034, cost_seg_est: 83469, std_dep: 90479, trad_cost_seg: 90479, bonus_dep: 68137},
      {year: 2035, cost_seg_est: 83446, std_dep: 90528, trad_cost_seg: 90528, bonus_dep: 68148},
      {year: 2036, cost_seg_est: 83469, std_dep: 90479, trad_cost_seg: 90479, bonus_dep: 68137},
      {year: 2037, cost_seg_est: 83446, std_dep: 90528, trad_cost_seg: 90528, bonus_dep: 68148},
      {year: 2038, cost_seg_est: 83469, std_dep: 90479, trad_cost_seg: 90479, bonus_dep: 68137},
      {year: 2039, cost_seg_est: 83446, std_dep: 90528, trad_cost_seg: 90528, bonus_dep: 68148},
      {year: 2040, cost_seg_est: 83469, std_dep: 71861, trad_cost_seg: 71861, bonus_dep: 60690},
      {year: 2041, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2042, cost_seg_est: 83469, std_dep: 53242, trad_cost_seg: 53242, bonus_dep: 53242},
      {year: 2043, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2044, cost_seg_est: 83469, std_dep: 53242, trad_cost_seg: 53242, bonus_dep: 53242},
      {year: 2045, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2046, cost_seg_est: 83469, std_dep: 53242, trad_cost_seg: 53242, bonus_dep: 53242},
      {year: 2047, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2048, cost_seg_est: 83469, std_dep: 53242, trad_cost_seg: 53242, bonus_dep: 53242},
      {year: 2049, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2050, cost_seg_est: 83469, std_dep: 53242, trad_cost_seg: 53242, bonus_dep: 53242},
      {year: 2051, cost_seg_est: 83446, std_dep: 53228, trad_cost_seg: 53228, bonus_dep: 53228},
      {year: 2052, cost_seg_est: 59119, std_dep: 37710, trad_cost_seg: 37710, bonus_dep: 37710}
    ];

    const totals = {
      cost_seg_est: fullSchedule.reduce((sum, row) => sum + row.cost_seg_est, 0),
      std_dep: fullSchedule.reduce((sum, row) => sum + row.std_dep, 0),
      trad_cost_seg: fullSchedule.reduce((sum, row) => sum + row.trad_cost_seg, 0),
      bonus_dep: fullSchedule.reduce((sum, row) => sum + row.bonus_dep, 0)
    };

    return (
      <div className="pdf-display w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-8">
        {/* Professional Header */}
        <div className="text-white p-8 relative" style={{ background: 'linear-gradient(to right, #232940, #558ca5)' }}>
          {seasonalDiscount.label && (
            <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
              🎉 {seasonalDiscount.label}
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="bg-white p-3 rounded-lg shadow-lg">
              <img 
                src="https://i.imgur.com/CzRehap.jpeg" 
                alt="RCG Logo" 
                className="h-16 w-16 object-contain"
              />
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
            <span className="ml-2 text-gray-900">{quoteDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="bg-red-100 border border-red-300 px-4 py-1 rounded-full">
            <span className="font-semibold text-red-700">Valid Until:</span>
            <span className="ml-2 text-red-900 font-bold">{expirationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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

          {/* Engagement Fee */}
          <div className="border-2 rounded-lg p-6" style={{ backgroundColor: '#e8f4f8', borderColor: '#558ca5' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#232940' }}>Professional Fee Structure</h2>
            
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

          {/* Cost Breakdown */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Valuation Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Purchase Price:</span>
                  <span>{formatMoney(purchasePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Land Value:</span>
                  <span>{formatMoney(landValue)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Building Value:</span>
                  <span className="font-bold">{formatMoney(buildingValue)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Base Quote:</span>
                  <span>{formatMoney(baseQuote)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Rush Fee:</span>
                  <span>{formData.rush !== "No Rush" ? formData.rush : "None"}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Final Quote:</span>
                  <span className="font-bold text-blue-600">{formatMoney(quoteData.final_quote)}</span>
                </div>
              </div>
            </div>
          </div>

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
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
              className="text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
              style={{ backgroundColor: '#558ca5' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#457a8f'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#558ca5'}
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
      {/* Header with Logo */}
      <div className="bg-white border-b-2 shadow-sm" style={{ borderColor: '#558ca5' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <img 
              src="https://i.imgur.com/CzRehap.jpeg" 
              alt="RCGV Logo" 
              className="h-12 w-12 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#232940' }}>RCGV Quote Assistant</h1>
            <p className="text-sm" style={{ color: '#558ca5' }}>Cost Segregation Specialists</p>
          </div>
        </div>
      </div>

      {/* AI Assistant Floating Button */}
      <button
        onClick={() => setAiOpen(!aiOpen)}
        className="fixed bottom-8 right-8 z-40 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 border-2 border-white"
        style={{ backgroundColor: '#558ca5' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#457a8f'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#558ca5'}
        aria-label="Toggle AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* AI Chat Panel */}
      {aiOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col">
          <div className="text-white p-4 rounded-t-lg flex justify-between items-center" style={{ backgroundColor: '#232940' }}>
            <h3 className="font-bold text-lg">AI Quote Assistant</h3>
            <button 
              onClick={() => setAiOpen(false)} 
              className="rounded-full p-1 transition"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.length === 0 && (
              <div className="text-gray-500 text-sm text-center mt-8">
                <p className="mb-2">👋 Hi! I'm your AI assistant.</p>
                <p>Ask me anything about:</p>
                <ul className="mt-2 text-left inline-block">
                  <li>• Property valuations</li>
                  <li>• Tax calculations</li>
                  <li>• Form questions</li>
                  <li>• Cost segregation benefits</li>
                </ul>
              </div>
            )}
            
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#558ca5' } : {}}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendAiMessage()}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={aiLoading}
              />
              <button
                onClick={sendAiMessage}
                disabled={aiLoading || !aiInput.trim()}
                className="text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: '#558ca5' }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#457a8f')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#558ca5')}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button 
                type="button" 
                onClick={() => setForm(EXAMPLE)} 
                className="px-4 py-2 rounded-xl border-2 bg-white hover:bg-gray-50 transition"
                style={{ borderColor: '#558ca5', color: '#232940' }}
              >
                Use Example Data
              </button>
              <button 
                onClick={handleSubmit}
                className="px-5 py-2 rounded-xl text-white disabled:opacity-50 transition" 
                style={{ backgroundColor: '#558ca5' }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#457a8f')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#558ca5')}
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
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          form.property_type === type
                            ? "text-white font-semibold"
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
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "percent");
                        set("land_value", "10");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "percent" && form.land_value === "10"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "percent" && form.land_value === "10" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      10%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "percent");
                        set("land_value", "15");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "percent" && form.land_value === "15"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "percent" && form.land_value === "15" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      15%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "percent");
                        set("land_value", "20");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "percent" && form.land_value === "20"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "percent" && form.land_value === "20" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      20%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "percent");
                        set("land_value", "25");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "percent" && form.land_value === "25"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "percent" && form.land_value === "25" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "percent");
                        set("land_value", "0");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "percent" && form.land_value === "0"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "percent" && form.land_value === "0" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      No Land Value
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("land_mode", "dollars");
                        set("land_value", "");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.land_mode === "dollars"
                          ? "bg-white text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.land_mode === "dollars" 
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      Known Land Value
                    </button>
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
                    <button
                      type="button"
                      onClick={() => set("rush", "No Rush")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.rush === "No Rush"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.rush === "No Rush"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      No Rush
                    </button>
                    <button
                      type="button"
                      onClick={() => set("rush", "4W $500")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.rush === "4W $500"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.rush === "4W $500"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      4W $500
                    </button>
                    <button
                      type="button"
                      onClick={() => set("rush", "2W $1000")}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        form.rush === "2W $1000"
                          ? "text-white font-semibold"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      style={form.rush === "2W $1000"
                        ? { borderColor: '#558ca5', backgroundColor: '#558ca5' }
                        : { borderColor: '#d1d5db' }}
                    >
                      2W $1000
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Internal Options (Separated) */}
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
          </div>
        </div>

        {/* PDF Display */}
        {result && <PDFDisplay quoteData={result} formData={form} />}
      </div>
    </div>
  );
}