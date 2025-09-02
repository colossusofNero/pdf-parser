const HEADERS = [
  'Name_of_Prospect','Address_of_Property','Zip_Code','Purchase_Price','Capital_Improvements_Amount',
  'Building_Value','Know_Land_Value','Date_of_Purchase','SqFt_Building','Acres_Land','Year_Built',
  'Bid_Amount_Original','Pay_Upfront','Pay_50_50_Amount','Pay_Over_Time','Rush_Fee','Multiple_Properties_Quote',
  'First_Year_Bonus_Quote','Tax_Year','Tax_Deadline_Quote','CapEx_Date','Type_of_Property_Quote',
  'Contact_Name_First','Contact_Name_Last','Contact_Phone','Email_from_App','Quote_pdf'
];

function send(res, code, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(code).json(body);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}

async function getSheets() {
  let google;
  try { ({ google } = await import('googleapis')); }
  catch { throw new Error('googleapis module not found. Add "googleapis" to dependencies and redeploy.'); }
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const keyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '');
  const privateKey = keyRaw.replace(/\\n/g, '\n');
  if (!email || !privateKey) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) throw new Error('Service account private key is not a valid PEM');
  const auth = new google.auth.JWT(email, undefined, privateKey, ['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

module.exports = async function handler(req, res) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

  if (req.method === 'OPTIONS' || req.method === 'HEAD') return send(res, 204, {});
  if (req.method === 'GET') {
    const out = {
      ok: true,
      hasEnv: {
        GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        GOOGLE_SHEETS_SPREADSHEET_ID: !!spreadsheetId,
        GOOGLE_SHEETS_SHEET_NAME: !!sheetName
      },
      keyNewlineStyle: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').includes('\n')
        ? 'real-newlines'
        : ((process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').includes('\\n') ? 'backslash-n' : 'unknown')
    };
    try {
      const sheets = await getSheets();
      const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
      out.sheetStatus = 'ok';
      out.header = (headerResp.data.values && headerResp.data.values[0]) || [];
    } catch (e) {
      out.sheetStatus = 'error';
      out.sheetError = String((e && e.message) || e);
    }
    return send(res, 200, out);
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  if (!spreadsheetId) return send(res, 500, { error: 'Missing GOOGLE_SHEETS_SPREADSHEET_ID' });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return send(res, 400, { error: 'Unable to read JSON body', message: String((e && e.message) || e) }); }

  const record = body && body.record;
  if (!record || typeof record !== 'object') return send(res, 400, { error: 'Bad Request', hint: 'POST JSON with { "record": { ... } }' });

  try {
    const sheets = await getSheets();

    const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
    const headerRow = (headerResp.data.values && headerResp.data.values[0]) || [];
    if (headerRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${sheetName}!A1`, valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] }
      });
    } else {
      const missing = HEADERS.filter(h => !headerRow.includes(h));
      const extra = headerRow.filter(h => !HEADERS.includes(h));
      if (missing.length || extra.length) {
        return send(res, 422, { error: 'Header mismatch', missing, extra, expected: HEADERS, got: headerRow });
      }
    }

    const row = HEADERS.map(k => record[k] == null ? '' : record[k]);
    const append = await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${sheetName}!A1`,
      valueInputOption: 'USER_EN_
