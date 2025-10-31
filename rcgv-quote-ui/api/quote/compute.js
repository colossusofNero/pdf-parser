// api/quote/compute.js
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get backend URL from environment variable
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    
    // Forward request to Python backend
    const response = await fetch(`${backendUrl}/quote/compute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (error) {
    console.error("Compute error:", error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Internal server error" 
    });
  }
}