import { useState } from "react";                   // static
import { computeQuote, setInputs } from "../api/quote"; // static

export default function QuotePage() {               // static
  const [result, setResult] = useState(null);       // static
  const [error, setError] = useState(null);         // static
  const [loading, setLoading] = useState(false);    // static

  async function onSubmit(e) {                      // static
    e.preventDefault();                             // static
    setLoading(true); setError(null);               // static
    try {
      const payload = { /* REPLACE: build payload from state (double-quoted keys) */ }; // REPLACE
      await setInputs(payload);                     // static (optional)
      const data = await computeQuote(payload);     // static
      setResult(data);                              // static
    } catch (err) {
      setError(err.message);                        // static
    } finally {
      setLoading(false);                            // static
    }
  }

  return (
    <form onSubmit={onSubmit}>{/* REPLACE: your fields */}  {/* static */}
      <button type="submit">Compute</button>                 {/* static */}
      {loading && <p>Loading…</p>}                           {/* static */}
      {error && <p>Error: {error}</p>}                       {/* static */}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>} {/* static */}
    </form>
  );
}
