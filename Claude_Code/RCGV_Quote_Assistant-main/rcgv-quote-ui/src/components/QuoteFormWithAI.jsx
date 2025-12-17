import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
// import ElevenLabsWidget from "./ElevenLabsWidget";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";
console.log("🔧 DEBUG: API Base URL =", apiBase || "(empty - will use relative URLs)");
console.log("🔧 DEBUG: All env vars =", import.meta.env);

// Generate unique session ID for ElevenLabs
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const EXAMPLE = {
  // Contact (Sample Data)
  name: "Sample Client Name",
  email: "sample@example.com",
  phone: "555-000-0000",
  // Property (Sample Data)
  owner: "Sample Property Owner LLC",
  address: "123 Sample Street, Sample City, AZ 85000",
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

// ✅ UPDATED: Money formatter - no cents
const money = (n) =>
  isFinite(n)
    ? n.toLocaleString(undefined, { 
        style: "currency", 
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    : "$0";

const num = (v) => Number(String(v ?? "").replace(/[$,]/g, "")) || 0;
const pct = (v) => {
  const n = Number(String(v ?? "").replace(/[%]/g, ""));
  if (!isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
};

export default function QuoteFormWithAI() {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [quoteId, setQuoteId] = useState(null); // Track the saved quote ID
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ElevenLabs session ID for real-time form sync
  const [sessionId] = useState(() => generateSessionId());

  // AI state - keep your existing AI code
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), [aiMsgs]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAiInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Function to speak text with high-quality voice
  const speak = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Try to find a high-quality natural voice
    const voices = window.speechSynthesis.getVoices();

    // Prefer these voice names (in order of priority)
    const preferredVoices = [
      'Google US English',
      'Microsoft Zira - English (United States)',
      'Samantha',
      'Alex',
      'Microsoft David - English (United States)',
      'Google UK English Female',
      'Karen',
      'Victoria'
    ];

    // Find the first available preferred voice
    let selectedVoice = null;
    for (const prefName of preferredVoices) {
      selectedVoice = voices.find(v => v.name.includes(prefName));
      if (selectedVoice) break;
    }

    // Fallback: find any English female or male voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        (v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        (v.lang.startsWith('en') && v.name.toLowerCase().includes('zira')) ||
        (v.lang.startsWith('en') && v.name.toLowerCase().includes('samantha'))
      );
    }

    // Last fallback: any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Natural speech settings
    utterance.rate = 0.95;  // Slightly slower for clarity
    utterance.pitch = 1.0;   // Natural pitch
    utterance.volume = 1.0;  // Full volume

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Load voices when they become available
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices
      window.speechSynthesis.getVoices();
      // Some browsers need this event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Toggle voice recording
  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setIsListening(false);
      }
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function saveQuoteToSupabase(quoteData, quoteResult, status = 'draft') {
    try {
      const payload = {
        name: quoteData.name || null,
        email: quoteData.email || null,
        phone: quoteData.phone || null,
        owner: quoteData.owner || null,
        address: quoteData.address || null,
        zip_code: quoteData.zip_code || null,
        property_type: quoteData.property_type || null,
        year_built: quoteData.year_built || null,
        sqft_building: quoteData.sqft_building || null,
        acres_land: quoteData.acres_land || null,
        floors: quoteData.floors || null,
        multiple_properties: quoteData.multiple_properties || null,
        purchase_price: quoteData.purchase_price || null,
        purchase_date: quoteData.purchase_date || null,
        tax_year: quoteData.tax_year || null,
        tax_deadline: quoteData.tax_deadline || null,
        land_mode: quoteData.land_mode || null,
        land_value: quoteData.land_value || null,
        capex: quoteData.capex || null,
        capex_date: quoteData.capex_date || null,
        capex_amount: quoteData.capex_amount || null,
        is_1031: quoteData.is_1031 || null,
        pad_deferred_growth: quoteData.pad_deferred_growth || null,
        rush: quoteData.rush || null,
        price_override: quoteData.price_override || null,
        quote_result: quoteResult,
        status: status
      };

      if (status === 'submitted') {
        payload.submitted_at = new Date().toISOString();
      }

      let response;
      if (quoteId && status === 'draft') {
        // Update existing draft
        response = await supabase
          .from('nudges')
          .update(payload)
          .eq('id', quoteId)
          .select()
          .single();
      } else if (quoteId && status === 'submitted') {
        // Update to submitted
        response = await supabase
          .from('nudges')
          .update(payload)
          .eq('id', quoteId)
          .select()
          .single();
      } else {
        // Create new quote
        response = await supabase
          .from('nudges')
          .insert([payload])
          .select()
          .single();
      }

      if (response.error) throw response.error;
      
      if (response.data && !quoteId) {
        setQuoteId(response.data.id);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }
  }

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
        price_override: form.price_override ? num(form.price_override) : 0,
        property_type: form.property_type,
        sqft_building: num(form.sqft_building),
        acres_land: parseFloat(form.acres_land),
        floors: parseInt(form.floors),
        multiple_properties: parseInt(form.multiple_properties),
        purchase_date: form.purchase_date ? form.purchase_date : null,
        tax_year: parseInt(form.tax_year),
        capex: form.capex,
        capex_amount: form.capex === "Yes" ? num(form.capex_amount) : 0,
        capex_date: form.capex === "Yes" && form.capex_date ? form.capex_date : null,
        is_1031: form.is_1031,
        pad_deferred_growth: form.is_1031 === "Yes" ? num(form.pad_deferred_growth) : 0,
        name: form.name,
        email: form.email,
        phone: form.phone
      };

      const fullUrl = `${apiBase}/quote/document`;
      console.log("🚀 CALLING API:", fullUrl);
      console.log("📦 PAYLOAD:", payload);

      const r = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await r.text();
      if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
      const quoteResult = JSON.parse(text);
      console.log("📋 API Response property_label:", quoteResult.property_label);
      console.log("📋 Full API Response:", quoteResult);
      setResult(quoteResult);

      // Auto-save to Supabase as draft (non-blocking - don't fail if this errors)
      try {
        await saveQuoteToSupabase(form, quoteResult, 'draft');
      } catch (saveError) {
        console.warn('⚠️ Failed to auto-save to Supabase (quote still computed successfully):', saveError);
      }

    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    // Validate required fields
    if (!form.name || !form.email || !form.phone) {
      setErr("Please provide your name, email, and phone number before submitting for review.");
      return;
    }

    setSubmitting(true);
    setErr("");
    setSubmitSuccess(false);
    
    try {
      if (!result) {
        throw new Error("Please generate an estimate first before submitting for review.");
      }

      // Save/update with submitted status
      await saveQuoteToSupabase(form, result, 'submitted');
      setSubmitSuccess(true);
      setErr(""); // Clear any previous errors

      // Optional: Show success message for a few seconds
      setTimeout(() => setSubmitSuccess(false), 5000);

    } catch (e) {
      const errorMsg = e.message || String(e);
      // Provide a more user-friendly message for database errors
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('JWT')) {
        setErr('⚠️ Submission failed due to database permissions. Your estimate was generated successfully, but we couldn\'t save your contact request. Please try again or contact support.');
      } else {
        setErr(`Submission error: ${errorMsg}`);
      }
    } finally {
      setSubmitting(false);
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

      const reply = data.reply || "(no reply)";
      setAiMsgs((m) => [...m, { role: "assistant", content: reply }]);

      // Speak the response if voice is enabled
      if (voiceEnabled) {
        speak(reply);
      }

      // Update form with AI suggestions
      if (data.draft && typeof data.draft === "object") {
        setForm((f) => ({ ...f, ...data.draft }));
      }

      // Handle submission action if AI indicates it
      if (data.action === "submit" && result) {
        setTimeout(() => handleSubmit(), 1000);
      } else if (data.action === "compute") {
        setTimeout(() => compute(), 1000);
      }
    } catch (e) {
      const errorMsg = "Sorry, I hit an error. Try again.";
      setAiMsgs((m) => [...m, { role: "assistant", content: errorMsg }]);
      if (voiceEnabled) speak(errorMsg);
    } finally {
      setAiBusy(false);
    }
  }

  const handlePrint = () => {
    // Save original title
    const originalTitle = document.title;

    // Format filename: Quote_ClientName_PropertyAddress_QuoteDate.pdf
    const clientName = (form.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    const propertyAddress = (form.address || 'Property').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const quoteDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `Quote_${clientName}_${propertyAddress}_${quoteDate}`;

    // Set document title (browsers use this as default PDF filename)
    document.title = filename;

    // Restore original title after print dialog closes
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    // Open print dialog
    window.print();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    compute();
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header (no-print) */}
      <div className="no-print bg-white border-b-2 shadow-sm" style={{ borderColor: "#558ca5" }}>
        <div className="w-full max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <img src="https://i.imgur.com/CzRehap.jpeg" alt="RCG" className="h-20 w-20 object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "#232940" }}>RCGV Estimate Tool</h1>
            <p className="text-base" style={{ color: "#558ca5" }}>Cost Segregation Specialists</p>
          </div>
        </div>
      </div>


      {/* Main */}
      <div className="w-full max-w-5xl mx-auto p-6">
        {/* Use Sample Data Button - Moved to top */}
        <div className="no-print mb-6">
          <button
            type="button"
            onClick={() => setForm(EXAMPLE)}
            className="w-full max-w-md px-8 py-3 rounded-lg border-2 bg-white hover:bg-gray-50 transition font-semibold"
            style={{ borderColor: '#558ca5', color: '#558ca5' }}
          >
            Use Sample Data
          </button>
        </div>

        <form onSubmit={onSubmit} className="no-print space-y-4">
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
                  {["Multi-Family", "Residential/LTR", "Short-Term Rental", "Office", "Retail", "Industrial", "Warehouse", "Hotel", "Medical", "Restaurant", "Mixed-Use", "Other"].map((type) => (
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

          {/* Compute Quote Button - Left justified */}
          <div>
            <button
              type="submit"
              className="w-full max-w-md px-8 py-3 rounded-lg text-white disabled:opacity-50 transition font-semibold shadow-md"
              style={{ backgroundColor: '#558ca5' }}
              disabled={busy}
            >
              {busy ? "Computing…" : "Generate Estimate"}
            </button>
          </div>

          {/* Internal Options */}
          <div className="border-2 p-4 rounded-lg" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: '#232940' }}>
              <span>⚠️ Educational & Pre-Qualification Use Only</span>
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

        {/* PDF Display */}
        <PDFDisplay result={result} form={form} handlePrint={handlePrint} />

        {/* Submit & Request Button - Moved below quote */}
        {result && (
          <div className="no-print flex flex-col items-center mt-6 gap-4">
            <button
              type="button"
              onClick={submitForReview}
              className="w-full max-w-md px-8 py-3 rounded-lg text-white disabled:opacity-50 transition font-semibold shadow-md"
              style={{ backgroundColor: '#28a745' }}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "✓ Submit & Request a Contact"}
            </button>

            {/* Submission error message - shown right below submit button */}
            {err && !submitSuccess && (
              <div className="w-full max-w-md p-4 rounded-xl bg-red-50 border-2 border-red-500 text-red-700 font-medium flex items-start gap-2">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <span>{err}</span>
              </div>
            )}

            {/* Success message */}
            {submitSuccess && (
              <div className="w-full max-w-md p-4 rounded-xl bg-green-50 border-2 border-green-500 text-green-800 font-medium flex items-center gap-2">
                <span className="text-2xl">✓</span>
                <span>Estimate request submitted successfully! We'll contact you soon at {form.email}.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ElevenLabs Voice AI Widget - Always visible */}
      {/* <ElevenLabsWidget form={form} setForm={setForm} sessionId={sessionId} /> */}
    </div>
  );
}

/* ---------------- PDF Display Component ---------------- */
function PDFDisplay({ result, form, handlePrint }) {
  if (!result) return (
    <div className="bg-white p-4 rounded-lg shadow-sm text-center text-gray-400">
      Fill the form and click <strong>Generate Estimate</strong> to create your preliminary estimate.
    </div>
  );

  const now = new Date();
  const expires = new Date(now); 
  expires.setDate(expires.getDate() + 30);

  const purchasePrice = result.purchase_price || num(form.purchase_price);
  const landVal = result.land_value || 0;
  const buildingValue = result.building_value || (purchasePrice - landVal);

  // Use the payments object from the API response
  const payments = result.payments || {};
  const baseQuote = payments.originally_quoted || 0;
  const finalQuote = baseQuote;

  const seasonal = (() => {
    const m = now.getMonth() + 1, d = now.getDate();
    if ((m === 10 && d >= 15) || (m === 11 && d <= 15) || (m === 4 && d >= 15) || (m === 5 && d <= 15))
      return { rate: 0.10, label: "10% Seasonal Discount!" };
    if ((m === 11 && d >= 16) || (m === 12 && d <= 15) || (m === 5 && d >= 16) || (m === 6 && d <= 15))
      return { rate: 0.05, label: "5% Seasonal Discount!" };
    return { rate: 0, label: null };
  })();

  const disc = 1 - seasonal.rate;
  const upfront = (payments.pay_upfront || baseQuote * 0.91) * disc;
  const split5050 = (payments.pay_50_50 || baseQuote / 2) * disc;
  const payOverTime = (payments.pay_over_time_amount || baseQuote / 4) * disc;
  const standardBeforeDiscounts = baseQuote * disc;

  // Use schedule from API response
  const schedule = result.schedule || [];
  
  const tots = schedule.reduce((a, r) => ({
    cs: a.cs + (r.cost_seg_est || 0),
    sd: a.sd + (r.std_dep || 0),
    ts: a.ts + (r.trad_cost_seg || 0),
    bd: a.bd + (r.bonus_dep || 0)
  }), { cs: 0, sd: 0, ts: 0, bd: 0 });

  return (
    <div id="quote-pdf" className="pdf-display w-full max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-8">
      {/* ========== PAGE 1 ========== */}
      <div className="page-1" style={{ minHeight: '11in', pageBreakAfter: 'always' }}>
        {/* Header bar */}
        <div className="text-white p-4 relative" style={{ background: "linear-gradient(to right, #232940, #558ca5)" }}>
          {seasonal.label && (
            <div className="absolute top-3 right-3 bg-yellow-400 text-gray-900 px-3 py-1 rounded-full font-bold text-xs shadow-lg">
              🎉 {seasonal.label}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg shadow-lg">
              <img src="https://i.imgur.com/CzRehap.jpeg" alt="RCG Logo" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Preliminary Cost Segregation Estimate</h1>
              <p className="text-blue-200 text-xs tracking-wider">VALUATION</p>
            </div>
          </div>
        </div>

        {/* Global Disclaimer - Top Priority */}
        <div className="bg-yellow-100 border-t-4 border-b-4 border-yellow-600 px-4 py-2">
          <div className="text-center">
            <div className="text-sm font-bold text-gray-900 mb-1">⚠️ DISCLAIMER ⚠️</div>
            <p className="text-[10px] text-gray-800 leading-tight">
              This tool provides <strong>illustrative cost segregation estimates for educational and pre-qualification purposes only</strong>.
              It does not provide tax, legal, or accounting advice. Consult a qualified professional for your specific situation.
            </p>
          </div>
        </div>

        {/* Validity */}
        <div className="bg-yellow-50 border-b-2 border-yellow-300 px-4 py-1.5 flex justify-between items-center text-xs">
          <div>
            <span className="font-semibold text-gray-700">Estimate Date:</span>
            <span className="ml-2 text-gray-900">{now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
            <span className="font-semibold text-red-700">Valid Until:</span>
            <span className="ml-2 text-red-900 font-bold">{expires.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="bg-blue-50 border-2 border-blue-400 px-4 py-3 mx-4 mt-4 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="text-[10px] text-gray-800">
              <div className="font-bold text-blue-900 mb-1">PRELIMINARY ESTIMATE — FOR ILLUSTRATIVE PURPOSES ONLY</div>
              <p className="leading-relaxed">
                This estimate uses sample assumptions for demonstration and pre-qualification purposes.
                Actual results vary based on engineering analysis, property specifics, tax position, and IRS guidance.
                This is not a final quote or tax advice. Final pricing subject to engagement review and professional analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Company + Contact */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h2 className="text-sm font-bold text-gray-900 mb-2 border-b pb-1">Company Information</h2>
              <div className="space-y-1 text-[10px]">
                <div><span className="font-semibold">Owner:</span> {form.owner}</div>
                <div><span className="font-semibold">Property:</span> {form.address}</div>
                <div><span className="font-semibold">Type:</span> {form.property_type}</div>
                <div><span className="font-semibold">Year Built:</span> {form.year_built}</div>
                <div><span className="font-semibold">Building:</span> {num(form.sqft_building).toLocaleString()} sq ft</div>
                <div><span className="font-semibold">Land:</span> {form.acres_land} acres</div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h2 className="text-sm font-bold text-gray-900 mb-2 border-b pb-1">Contact Information</h2>
              <div className="space-y-1 text-[10px]">
                <div><span className="font-semibold">Name:</span> {form.name}</div>
                <div><span className="font-semibold">Email:</span> {form.email}</div>
                <div><span className="font-semibold">Phone:</span> {form.phone}</div>
                <div><span className="font-semibold">Purchase Date:</span> {form.purchase_date}</div>
                <div><span className="font-semibold">Tax Year:</span> {form.tax_year}</div>
                <div><span className="font-semibold">Tax Deadline:</span> {form.tax_deadline}</div>
              </div>
            </div>
          </div>

          {/* Fee structure + Valuation Breakdown */}
          <div className="grid md:grid-cols-2 gap-3">
            {/* Fee Structure */}
            <div className="border-2 rounded-lg p-3" style={{ backgroundColor: "#e8f4f8", borderColor: "#558ca5" }}>
              <h2 className="text-sm font-bold mb-2" style={{ color: "#232940" }}>Professional Fee Structure</h2>
              <div className="space-y-2">
                <div className="bg-white p-2 rounded border-2 border-green-400">
                  <div className="text-[9px] font-semibold text-gray-600">Pay Upfront (9% Discount)</div>
                  <div className="text-lg font-bold text-green-600">{money(upfront)}</div>
                </div>
                <div className="bg-white p-2 rounded border-2 border-blue-400">
                  <div className="text-[9px] font-semibold text-gray-600">50/50 Split</div>
                  <div className="text-lg font-bold text-blue-600">{money(split5050)}</div>
                  <div className="text-[8px] text-gray-500">Now / Upon Completion</div>
                </div>
                <div className="bg-white p-2 rounded border-2 border-purple-400">
                  <div className="text-[9px] font-semibold text-gray-600">Pay Over Time</div>
                  <div className="text-lg font-bold text-purple-600">{money(payOverTime)}</div>
                  <div className="text-[8px] text-gray-500">Quarterly installments</div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-[9px] text-gray-600">Standard Fee:</div>
                  <div className="text-base font-bold text-gray-900">{money(standardBeforeDiscounts)}</div>
                </div>
              </div>
            </div>

            {/* Valuation Breakdown */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <h2 className="text-sm font-bold text-gray-900 mb-2">Valuation Breakdown</h2>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between"><span className="font-semibold">Purchase Price:</span><span>{money(purchasePrice)}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Land Value:</span><span>{money(landVal)}</span></div>
                <div className="flex justify-between border-t pt-1.5 border-b pb-1.5"><span className="font-semibold">Building Value:</span><span className="font-bold">{money(buildingValue)}</span></div>
                
                <div className="flex justify-between"><span className="font-semibold">Service Fee:</span><span>{money(baseQuote)}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Rush Fee:</span><span>{form.rush !== "No Rush" ? form.rush : "None"}</span></div>
                <div className="flex justify-between border-t pt-1.5 mb-2"><span className="font-semibold">Estimated Professional Fee:</span><span className="font-bold text-blue-600">{money(finalQuote)}</span></div>
                
                {/* VALUE HIGHLIGHT */}
                <div className="bg-green-50 border-2 border-green-500 rounded p-2 mt-2">
                  <div className="text-[9px] font-bold text-green-800 mb-1">💰 ESTIMATED TAX IMPACT (ILLUSTRATIVE)</div>
                  <div className="text-xs font-semibold text-gray-700">Illustrative Year-1 Accelerated Depreciation:</div>
                  <div className="text-2xl font-bold text-green-700">{schedule.length > 0 ? money(schedule[0].bonus_dep) : "$0"}</div>
                  <div className="text-[8px] text-gray-600 mt-1">vs. {schedule.length > 0 ? money(schedule[0].std_dep) : "$0"} standard</div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg p-3">
            <h2 className="text-sm font-bold text-gray-900 mb-2">Why Cost Segregation?</h2>
            <div className="grid md:grid-cols-4 gap-2 text-[10px]">
              <div>
                <div className="font-bold text-green-700">✓ Accelerated</div>
                <p className="text-gray-700">Front-load deductions</p>
              </div>
              <div>
                <div className="font-bold text-green-700">✓ Cash Flow</div>
                <p className="text-gray-700">Reduce tax liability</p>
              </div>
              <div>
                <div className="font-bold text-green-700">✓ IRS-Compliant</div>
                <p className="text-gray-700">Engineered methodology</p>
              </div>
              <div>
                <div className="font-bold text-green-700">✓ Audit Support</div>
                <p className="text-gray-700">Documentation assistance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ========== PAGE 2 ========== */}
      <div className="page-2" style={{ minHeight: '0' }}>
        <div className="p-4">
          {/* Depreciation table - LIMIT TO 28 ROWS MAX */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-800 to-gray-600 text-white p-2">
              <h2 className="text-base font-bold">
                {result.property_label ? `${result.property_label} Depreciation Schedule` : `${form.property_type} Depreciation Schedule`}
              </h2>
              <p className="text-[10px] text-gray-300">Illustrative Comparison Based on Standard Assumptions</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-2 py-1 text-left font-bold">Year</th>
                    <th className="px-2 py-1 text-right font-bold text-gray-500">Std. Depreciation<br/><span className="text-[8px] font-normal">(What you have now)</span></th>
                    <th className="px-2 py-1 text-right font-bold text-blue-700">Traditional<br/>Cost Seg</th>
                    <th className="px-2 py-1 text-right font-bold bg-green-50 text-green-700">★ Accelerated<br/>Depreciation</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Show all years for complete depreciation schedule */}
                  {schedule.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-2 py-0.5 font-semibold">{r.year}</td>
                      <td className="px-2 py-0.5 text-right text-gray-500">{money(r.std_dep)}</td>
                      <td className="px-2 py-0.5 text-right text-blue-700">{money(r.trad_cost_seg)}</td>
                      <td className="px-2 py-0.5 text-right font-bold bg-green-50 text-green-700">{money(r.bonus_dep)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 border-t-2 border-blue-400 font-bold">
                    <td className="px-2 py-1.5">TOTALS</td>
                    <td className="px-2 py-1.5 text-right text-gray-600">{money(tots.sd)}</td>
                    <td className="px-2 py-1.5 text-right text-blue-700">{money(tots.ts)}</td>
                    <td className="px-2 py-1.5 text-right bg-green-100 text-green-800">{money(tots.bd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* VALUE CALLOUT */}
          <div className="bg-gradient-to-r from-green-100 to-green-50 border-2 border-green-500 rounded-lg p-3 mt-3">
            <div className="text-center">
              <div className="text-xs font-bold text-green-800 mb-1">★ RECOMMENDED: ACCELERATED DEPRECIATION ★</div>
              <div className="text-sm text-gray-700">Potentially increase your first-year deduction and accelerate tax savings</div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                <div className="bg-white rounded p-2">
                  <div className="text-gray-600">Standard (Current)</div>
                  <div className="font-bold text-gray-700">{schedule.length > 0 ? money(schedule[0].std_dep) : "$0"}</div>
                </div>
                <div className="bg-white rounded p-2">
                  <div className="text-blue-700">Traditional Cost Seg</div>
                  <div className="font-bold text-blue-800">{schedule.length > 0 ? money(schedule[0].trad_cost_seg) : "$0"}</div>
                </div>
                <div className="bg-green-200 rounded p-2 border-2 border-green-600">
                  <div className="text-green-800 font-bold">★ Accelerated Depreciation</div>
                  <div className="font-bold text-green-900 text-base">{schedule.length > 0 ? money(schedule[0].bonus_dep) : "$0"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer + Print button */}
          <div className="text-center space-y-2 mt-3">
            <button
              onClick={handlePrint}
              className="no-print text-white font-bold py-2 px-6 rounded-lg shadow-lg transition"
              style={{ backgroundColor: "#558ca5" }}
            >
              Print or Save as PDF
            </button>
            <p className="text-[10px] text-gray-600">This estimate is valid for 30 days from the estimate date above. Final pricing subject to engagement review.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t-2 border-gray-300 p-3 text-center text-[9px] text-gray-600 mt-auto">
          <p className="font-semibold">Estimate Generated: {now.toLocaleDateString()}</p>
          <p className="mt-0.5 text-red-600 font-semibold">Valid Until: {expires.toLocaleDateString()} (30 days)</p>
          <p className="mt-1 text-gray-500">RCG Valuation • Cost Segregation Specialists</p>
        </div>
      </div>
    </div>
  );
}