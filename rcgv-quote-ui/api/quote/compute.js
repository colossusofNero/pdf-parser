export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const payload = req.body;         // TODO: replace with your real logic
  // Example echo response:
  return res.status(200).json({ ok: true, result: "computed", payload });
}
