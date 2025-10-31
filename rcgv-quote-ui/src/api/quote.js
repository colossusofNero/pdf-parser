// static: src/api/quote.js
const API = import.meta.env.VITE_API_BASE_URL || ""; // static (same-origin in prod)

// static
export async function computeQuote(payload) {
  const res = await fetch(`${API}/api/quote/compute`, { // static
    method: "POST",                                     // static (double quotes)
    headers: { "Content-Type": "application/json" },    // static
    body: JSON.stringify(payload),                      // static
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`); // static
  return res.json(); // static
}

// static
export async function setInputs(payload) {
  const res = await fetch(`${API}/api/quote/set_inputs`, { // static
    method: "POST",                                        // static
    headers: { "Content-Type": "application/json" },       // static
    body: JSON.stringify(payload),                         // static
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`); // static
  return res.json(); // static
}
