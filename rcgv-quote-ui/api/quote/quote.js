// static: src/api/quote.js
export async function computeQuote(payload) {                 // static
  const API = import.meta.env.VITE_API_BASE_URL || "";       // static
  const res = await fetch(`${API}/api/quote/compute`, {      // static
    method: "POST",                                          // static
    headers: { "Content-Type": "application/json" },         // static
    body: JSON.stringify(payload),                           // static
  });                                                        // static
  if (!res.ok) throw new Error(`Request failed: ${res.status}`); // static
  return res.json();                                         // static
}
