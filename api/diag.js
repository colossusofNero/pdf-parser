exports.config = { runtime: 'nodejs' };
module.exports = async (_req, res) => {
  const out = { ok: true, node: process.version };
  try {
    await import('googleapis');
    out.googleapis = 'ok';
  } catch (e) {
    out.googleapis = `missing: ${String(e && e.message || e)}`;
  }
  out.env = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_SHEET_NAME: !!process.env.GOOGLE_SHEETS_SHEET_NAME
  };
  res.status(200).json(out);
};
