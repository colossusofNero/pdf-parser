export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { record } = req.body || {};
    if (!record) return res.status(400).send('Missing record');

    const account = process.env.CASPIO_ACCOUNT;
    const clientId = process.env.CASPIO_CLIENT_ID;
    const clientSecret = process.env.CASPIO_CLIENT_SECRET;
    const tableName = 'A_Quote_Webapp_tbl';

    if (!account || !clientId || !clientSecret) {
      return res.status(500).send('Missing CASPIO_* env vars');
    }

    // 1) OAuth
    const tokenRes = await fetch(`https://${account}.caspio.com/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return res.status(500).send(`Auth failed: ${t}`);
    }
    const { access_token } = await tokenRes.json();

    // 2) Insert
    const url = `https://${account}.caspio.com/rest/v2/tables/${encodeURIComponent(tableName)}/records`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(record)
    });

    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e: any) {
    return res.status(500).send(String(e?.message || e));
  }
}
