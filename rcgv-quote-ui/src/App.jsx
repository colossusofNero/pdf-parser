// src/App.jsx
import { useState, useEffect } from "react";
import QuoteFormWithAI from './components/QuoteFormWithAI.jsx';

export default function App() {
  return <QuoteFormWithAI />;
}
const apiBase = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [tab, setTab] = useState("assistant"); // "assistant" | "form"
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState([]);

  async function sendChat(text) {
    const content = text ?? msg;
    if (!content.trim()) return;
    setMsg("");
    setThread((t) => [...t, { role: "user", content }]);
    try {
      const r = await fetch(`${apiBase}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content }] })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || "Chat error");
      setThread((t) => [...t, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setThread((t) => [...t, { role: "assistant", content: `Error: ${e.message}` }]);
    }
  }

  // simple Enter key submit
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendChat();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [msg]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">RCGV Quote Assistant</h1>

        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-slate-200 p-1 mb-6">
          <button
            className={`px-4 py-2 rounded-lg ${tab==="assistant"?"bg-white shadow":""}`}
            onClick={()=>setTab("assistant")}
          >
            Assistant
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${tab==="form"?"bg-white shadow":""}`}
            onClick={()=>setTab("form")}
          >
            Form
          </button>
        </div>

        {tab==="assistant" ? (
          <div className="space-y-4">
            {/* history */}
            <div className="space-y-3">
              {thread.map((m,i)=>(
                <div key={i} className={`p-4 rounded-2xl ${m.role==="user"?"bg-white":"bg-sky-50"}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{m.role}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>

            {/* input */}
            <div className="card p-3 flex gap-3 items-center">
              <input
                className="field flex-1"
                placeholder={`Try: "Quote $2.55M, zip 85260, land 10%"`}
                value={msg}
                onChange={(e)=>setMsg(e.target.value)}
              />
              <button
                onClick={()=>sendChat()}
                className="px-5 py-2 rounded-xl bg-sky-600 text-white"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <QuoteForm />
        )}
      </div>
    </div>
  );
}
