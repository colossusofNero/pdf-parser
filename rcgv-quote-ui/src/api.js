const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function chat(messages) {
  const r = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ messages })
  });
  if (!r.ok) throw new Error(`Chat error ${r.status}`);
  return r.json(); // { reply, draft, last }
}
