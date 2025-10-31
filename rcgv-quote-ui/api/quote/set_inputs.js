export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const payload = req.body; // TODO: persist/use inputs as needed
    return res.status(200).json({ ok: true, action: "set_inputs", payload });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "error" });
  }
}
