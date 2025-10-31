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
    isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

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

    // Calculate seasonal discount
    const getSeasonalDiscount = () => {
      const today = new Date();
      const month = today.getMonth() + 1; // 1-12
      const day = today.getDate();
      
      // 10% discount periods: Oct 15 - Nov 15, Apr 15 - May 15
      if ((month === 10 && day >= 15) || (month === 11 && day <= 15) ||
          (month === 4 && day >= 15) || (month === 5 && day <= 15)) {
        return { rate: 0.10, label: "10% Seasonal Discount!" };
      }
      
      // 5% discount periods: Nov 16 - Dec 15, May 16 - Jun 15
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
    
    // Apply seasonal discount to all payment options
    const discountMultiplier = 1 - seasonalDiscount.rate;
    const payUpfront = baseQuote * 0.91 * discountMultiplier;
    const pay5050 = (baseQuote / 2) * discountMultiplier;
    const payOverTime = (baseQuote / 4) * discountMultiplier;
    const originalWithSeasonal = baseQuote * discountMultiplier;

    // Sample depreciation schedule (replace with actual data from backend when available)
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

    // Calculate totals
    const totals = {
      cost_seg_est: fullSchedule.reduce((sum, row) => sum + row.cost_seg_est, 0),
      std_dep: fullSchedule.reduce((sum, row) => sum + row.std_dep, 0),
      trad_cost_seg: fullSchedule.reduce((sum, row) => sum + row.trad_cost_seg, 0),
      bonus_dep: fullSchedule.reduce((sum, row) => sum + row.bonus_dep, 0)
    };

    return (
      <div className="w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-8 relative">
          {seasonalDiscount.label && (
            <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold text-sm animate-pulse shadow-lg">
              🎉 {seasonalDiscount.label}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <div className="text-blue-900 font-bold text-3xl">RCG</div>
            </div>
            <div>
              <h1 className="text-4xl font-bold">Cost Segregation Quote</h1>
              <p className="text-blue-200 text-lg tracking-wide">VALUATION</p>
            </div>
          </div>
        </div>

        {/* Quote Date and Expiration Banner */}
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

        {/* Main Content */}
        <div className="p-8">
          {/* Company Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-lg font-semibold mb-3 text-blue-900">Company:</h2>
              <p className="text-gray-700 mb-4">{formData.owner || formData.name || 'Valued Client'}</p>
              
              <h2 className="text-lg font-semibold mb-3 text-blue-900">
                {formData.property_type || 'Multi-Family'} Property - Address:
              </h2>
              <p className="text-gray-700">{formData.address || '123 Main St, Yourtown, US, ' + (formData.zip_code || '00000')}</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Purchase Price</span>
                <p className="text-2xl font-bold text-blue-900">{formatMoney(purchasePrice)}</p>
              </div>
              <hr/>
              <div className="flex justify-between">
                <span className="font-semibold">Capital Improvements</span>
                <p>{formatMoney(formData.capex === 'Yes' ? toNumber(formData.capex_amount) : 0)}</p>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Building (plus CapEx)</span>
                <p className="text-xl font-bold text-green-700">{formatMoney(buildingValue)}</p>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Land</span>
                <p>{formatMoney(landValue)}</p>
              </div>
              <hr/>
              <div className="flex justify-between">
                <span className="font-semibold">Purchase Date</span>
                <p>{formData.purchase_date}</p>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">SqFt Building</span>
                <p>{formatNumber(formData.sqft_building)}</p>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Acres Land</span>
                <p>{formData.acres_land}</p>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Due Date</span>
                <p>{formData.tax_deadline} {formData.tax_year}</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8">
            <h3 className="font-semibold mb-3 text-blue-900">RCG Contact:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Scott Roelofs</p>
                <p>O: 331.248.7245  C: 480.276.5626</p>
                <p className="text-blue-600">info@rcgvaluation.com</p>
                <p className="text-blue-600">rcgvaluation.com</p>
              </div>
              <div>
                <p className="text-gray-600">6929 N Hayden Rd Suite C4-494</p>
                <p className="text-gray-600">Scottsdale, AZ 85250</p>
              </div>
            </div>
          </div>

          {/* Engagement Fee */}
          <div className="bg-gradient-to-br from-blue-50 to-white border-4 border-blue-900 rounded-xl p-8 mb-8 shadow-lg">
            <h2 className="text-3xl font-bold text-blue-900 mb-6 text-center">Engagement Fee</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border-2 border-blue-900 p-6 rounded-lg text-center shadow-md">
                <div className="text-sm text-gray-600 mb-2">Originally Quoted</div>
                {seasonalDiscount.rate > 0 && (
                  <div className="text-2xl font-bold text-gray-400 line-through mb-1">{formatMoney(baseQuote)}</div>
                )}
                <div className="text-5xl font-bold text-blue-900 mb-2">{formatMoney(originalWithSeasonal)}</div>
                {seasonalDiscount.rate > 0 && (
                  <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold inline-block">
                    {(seasonalDiscount.rate * 100).toFixed(0)}% Seasonal Savings!
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">Rush Fee: {formatMoney(parts.rush_fee || 0)}</div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg shadow-md transform hover:scale-105 transition">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold">Pay Upfront**</div>
                    <div className="bg-yellow-400 text-green-900 text-xs font-bold px-2 py-1 rounded">
                      Save {seasonalDiscount.rate > 0 ? (9 + seasonalDiscount.rate * 100).toFixed(0) : '9'}%!
                    </div>
                  </div>
                  <div className="text-3xl font-bold">{formatMoney(payUpfront)}</div>
                </div>
                
                <div className="bg-white border-2 border-gray-300 p-4 rounded-lg shadow-sm">
                  <div className="font-semibold mb-1">Pay 50/50</div>
                  <div className="text-2xl font-bold text-gray-800">{formatMoney(pay5050)}</div>
                  <div className="text-xs text-gray-500">50% upfront, 50% on delivery</div>
                </div>
                
                <div className="bg-white border-2 border-gray-300 p-4 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold">Pay Over Time</div>
                    <div className="text-blue-600 font-bold text-lg">affirm</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">{formatMoney(payOverTime)}</div>
                  <div className="text-xs text-gray-500">(Up to 36 months)</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-xs text-gray-700">
              ** The Upfront payment needs to be paid within 15 days of execution of the engagement letter or the Engagement Fee will revert to the "Originally Quoted" value.
            </div>
          </div>

          {/* Full Depreciation Schedule */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2 text-blue-900">What you have vs. What we offer</h2>
            <p className="text-sm text-gray-600 mb-4 italic">
              Notice: All columns total to the same amount ({formatMoney(buildingValue)}). 
              We don't create depreciation—we accelerate it to year one for maximum tax benefit.
            </p>
            <div className="overflow-x-auto rounded-lg shadow max-h-96 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-blue-900 text-white sticky top-0 z-10">
                  <tr>
                    <th className="border border-blue-800 p-2 text-left">Year</th>
                    <th className="border border-blue-800 p-2 text-right">Cost Seg Est</th>
                    <th className="border border-blue-800 p-2 text-right">Std. Dep</th>
                    <th className="border border-blue-800 p-2 text-right">Trad. Cost Seg</th>
                    <th className="border border-blue-800 p-2 text-right bg-green-800">Bonus Dep ⭐</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {fullSchedule.map((row, idx) => (
                    <tr key={row.year} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="border p-2 font-semibold">{row.year}</td>
                      <td className="border p-2 text-right">{formatMoney(row.cost_seg_est)}</td>
                      <td className="border p-2 text-right">{formatMoney(row.std_dep)}</td>
                      <td className="border p-2 text-right">{formatMoney(row.trad_cost_seg)}</td>
                      <td className="border p-2 text-right font-bold text-green-700 bg-green-50">
                        {formatMoney(row.bonus_dep)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-100 font-bold sticky bottom-0">
                  <tr>
                    <td className="border border-blue-900 p-3 text-lg">Total</td>
                    <td className="border border-blue-900 p-3 text-right text-lg">{formatMoney(totals.cost_seg_est)}</td>
                    <td className="border border-blue-900 p-3 text-right text-lg">{formatMoney(totals.std_dep)}</td>
                    <td className="border border-blue-900 p-3 text-right text-lg">{formatMoney(totals.trad_cost_seg)}</td>
                    <td className="border border-blue-900 p-3 text-right text-lg bg-green-200 font-bold">{formatMoney(totals.bonus_dep)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-600 mt-3 italic">
              *Full depreciation schedule with all {fullSchedule.length} years shown. 
              Totals prove we depreciate the exact same amount—just faster for you.
            </p>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-50 border p-6 rounded-lg mb-8">
            <h2 className="text-xl font-bold mb-4 text-blue-900">Quote Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Base Rate:</span>
                <span className="font-bold">{formatMoney(parts.base_rate)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Cost Basis:</span>
                <span className="font-bold">{formatMoney(parts.cost_basis)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">CB Factor:</span>
                <span className="font-bold">{parts.cb_factor?.toFixed(3) || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">ZIP Factor:</span>
                <span className="font-bold">{parts.zip_factor?.toFixed(3) || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Rush Fee:</span>
                <span className="font-bold">{formatMoney(parts.rush_fee)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Premium:</span>
                <span className="font-bold">{((parts.premium_uplift_pct || 0) * 100).toFixed(1)}%</span>
              </div>
              {seasonalDiscount.rate > 0 && (
                <div className="flex justify-between border-b pb-2 col-span-2 md:col-span-3">
                  <span className="text-yellow-700 font-semibold">Seasonal Discount:</span>
                  <span className="font-bold text-yellow-700">-{(seasonalDiscount.rate * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Property Type Badge */}
          <div className="text-center mb-6">
            <div className="inline-block bg-blue-900 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg">
              {formData.property_type || 'Multi-Family'}
            </div>
            {formData.floors && (
              <div className="inline-block ml-4 bg-gray-700 text-white px-6 py-3 rounded-full font-semibold">
                {formData.floors} {formData.floors === 1 ? 'Floor' : 'Floors'}
              </div>
            )}
          </div>

          {/* Print Button */}
          <div className="text-center">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition"
            >
              Print or Save as PDF
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t-2 border-gray-300 p-6 text-center text-xs text-gray-600">
          <p className="font-semibold">Quote Generated: {quoteDate.toLocaleDateString()}</p>
          <p className="mt-1 text-red-600 font-semibold">Valid Until: {expirationDate.toLocaleDateString()} (30 days)</p>
          <p className="mt-1">{formData.property_type || 'Multi-Family'} Property</p>
          <p className="mt-1">*Previously Accumulated Depreciation</p>
        </div>
      </div>
    );
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); compute(); }}>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={fillExample} className="px-4 py-2 rounded-xl border bg-white">
          Use Example Data
        </button>
        <button type="submit" className="px-5 py-2 rounded-xl bg-sky-600 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Computing…" : "Compute Quote"}
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
              <TabBtn active={form.land_mode === "percent"} onClick={() => set("land_mode", "percent")}>Percent (0–100)</TabBtn>
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
          <Field label="Price Override ($) — requires password">
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

      {/* PDF Display replaces simple summary */}
      {result && <PDFDisplay quoteData={result} formData={form} />}
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