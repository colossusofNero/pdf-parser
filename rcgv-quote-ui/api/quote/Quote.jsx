// static: inside a React component file (e.g., src/pages/Quote.jsx)
import { useState } from "react";                            // static
import { computeQuote } from "../api/quote";                 // static

export default function QuotePage() {                        // static
  const [result, setResult] = useState(null);                // static
  const [loading, setLoading] = useState(false);             // static
  const [error, setError] = useState(null);                  // static

  async function onSubmit(formValues) {                      // static
    setLoading(true); setError(null);                        // static
    try {
      const data = await computeQuote(formValues);           // static
      setResult(data);                                       // static
    } catch (e) {
      setError(e.message);                                   // static
    } finally {
      setLoading(false);                                     // static
    }
  }

  // ...render your form, call onSubmit(payload) on submit... // static
  return null;                                               // static
}
