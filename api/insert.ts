import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + health
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', hint: 'Use POST' });
  }

  const account = process.env.CASPIO_ACCOUNT;
  const clientId = process.env.CASPIO_CLIENT_ID;
  const clientSecret = process.env.CASPIO_CLIENT_SECRET;
  const tableName = 'A_Quote_Webapp_tbl';

  // Validate server env
  if (!account || !clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Server misconfigured',
      missing: {
        CASPIO_ACCOUNT: !!account,
        CASPIO_CLIENT_ID: !!clientId,
        CASPIO_CLIENT_SECRET: !!clientSecret
      },
      hint: 'Set these in Vercel Project Settings → Environment Variables (server-side, no VITE_)'
    });
  }

  // Validate body
  const record = (req.body as any)?.record;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      hint: 'POST JSON with { "record": { ...fields } }',
      example: { record: { Name_of_Prospect: 'Jane Doe', Purchase_Price: 123456 } }
    });
  }

  try {
    // 1) OAuth token
    const tokenRes = await fetch(`https://${account}.caspio.com/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return res.status(502).json({
        error: 'Caspio auth failed',
        status: tokenRes.status,
        body: tokenText
      });
    }
    let access_token: string | undefined;
    try {
      const parsed = JSON.parse(tokenText);
      access_token = parsed.access_token;
    } catch {
      return res.status(502).json({ error: 'Auth JSON parse failed', body: tokenText });
    }
    if (!access_token) {
      return res.status(502).json({ error: 'No access_token in auth response', body: tokenText });
    }

    // 2) Insert record
    const url = `https://${account}.caspio.com/rest/v2/tables/${encodeURIComponent(tableName)}/records`;
    const caspioRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(record)
    });

    const caspioText = await caspioRes.text();
    if (!caspioRes.ok) {
      // Bubble up Caspio’s error so you can see exactly why it failed
      return res.status(caspioRes.status).json({
        error: 'Caspio insert failed',
        status: caspioRes.status,
        body: caspioText
      });
    }

    // Success passthrough
    // Caspio typically returns inserted record metadata
    try {
      return res.status(caspioRes.status).json(JSON.parse(caspioText));
    } catch {
      return res.status(caspioRes.status).send(caspioText);
    }
  } catch (e: any) {
    return res.status(500).json({ error: 'Unhandled server error', message: String(e?.message || e) });
  }
}
