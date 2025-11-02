// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import QuoteFormWithAI from "./components/QuoteFormWithAI.jsx";
import "./index.css";  // Keep this (has Tailwind)
// Remove: import "./App.css";  ← Don't import this

ReactDOM.createRoot(document.getElementById("root")).render(<QuoteFormWithAI />);