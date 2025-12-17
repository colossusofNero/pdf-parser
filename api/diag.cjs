function send(res, code, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(code).json(body);
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method Not Allowed', method: req.method });

  const out = { ok: true, node: process.version };
  try { await import('googleapis'); out.googleapis = 'ok'; }
  catch (e) { out.googleapis = `missing: ${String((e && e.message) || e)}`; }
  out.env = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_SHEET_NAME: !!process.env.GOOGLE_SHEETS_SHEET_NAME
  };
  return send(res, 200, out);
};
module.exports.config = { runtime: 'nodejs' };
