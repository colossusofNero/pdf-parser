// api/insert.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export const config = { runtime: 'nodejs20.x' };

const HEADERS = [
  'Name_of_Prospect',
  'Address_of_Property',
  'Zip_Code',
  'Purchase_Price',
  'Capital_Improvements_Amount',
  'Building_Value',
  'Know_Land_Value',
  'Date_of_Purchase',
  'SqFt_Building',
  'Acres_Land',
  'Year_Built',
  'Bid_Amount_Original',
  'Pay_Upfront',
  'Pay_50_50_Amount',
  'Pay_Over_Time',
  'Rush_Fee',
  'Multiple_Properties_Quote',
  'First_Year_Bonus_Quote',
  'Tax_Year',
  'Tax_Deadline_Quote',
  'CapEx_Date',
  'Type_of_Property_Quote',
  'Contact_Name_First',
  'Contact_Name_Last',
  'Contact_Phone',
  'Email_from_App',
  'Quote_pdf'
] as const;

type RecordIn = Partial<Record<(typeof HEADERS)[number], string | number>>;

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Uint8Array[] = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}


function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const keyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '');
  const privateKey = keyRaw.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    throw new Error('Service account private key is not a valid PEM. Ensure \\n were preserved and converted.');
  }

  const auth = new google.auth.JWT(
    email,
    undefined,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      hasEnv: {
        GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        GOOGLE_SHEETS_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        GOOGLE_SHEETS_SHEET_NAME: !!process.env.GOOGLE_SHEETS_SHEET_NAME
      }
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', hint: 'Use POST or GET' });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) {
    return res.status(500).json({ error: 'Missing GOOGLE_SHEETS_SPREADSHEET_ID' });
  }

  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (e: any) {
    return res.status(400).json({ error: 'Unable to read JSON body', message: String(e?.message || e) });
  }

  const record: RecordIn | undefined = body?.record;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      hint: 'POST JSON with { "record": { ...fields } }'
    });
  }

  try {
    const sheets = getSheetsClient();

    // Ensure header row
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });
    const headerRow: string[] = headerResp.data.values?.[0] || [];

    if (headerRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS as unknown as string[]] }
      });
    } else {
      const missing = HEADERS.filter(h => !headerRow.includes(h));
      const extra = headerRow.filter(h => !HEADERS.includes(h as any));
      if (missing.length || extra.length) {
        return res.status(422).json({
          error: 'Header mismatch',
          missing,
          extra,
          expected: HEADERS,
          got: headerRow
        });
      }
    }

    // Build row in the exact header order
    const row = (HEADERS as unknown as string[]).map(k => {
      const v = (record as any)[k];
      return v === undefined || v === null ? '' : v;
    });

    // Append row
    const append = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    return res.status(200).json({
      ok: true,
      updatedRange: append.data.updates?.updatedRange,
      updatedRows: append.data.updates?.updatedRows
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Unhandled server error', message: String(e?.message || e) });
  }
}
