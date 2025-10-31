export async function computeQuote(payload) {
  const API = import.meta.env.VITE_API_BASE_URL || "";
  const res = await fetch(`${API}/api/quote/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}
