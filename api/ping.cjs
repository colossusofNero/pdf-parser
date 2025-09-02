function send(res, code, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(code).json(body);
}
module.exports = (req, res) => {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method Not Allowed' });
  return send(res, 200, { ok: true, node: process.version, now: Date.now() });
};
module.exports.config = { runtime: 'nodejs' };
