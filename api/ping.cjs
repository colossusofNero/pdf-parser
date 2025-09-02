function send(res, code, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(code).json(body);
}
module.exports = (req, res) => {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { error: 'Method Not Allowed', method: req.method });
  return send(res, 200, { ok: true, node: process.version, now: Date.now() });
};
module.exports.config = { runtime: 'nodejs' };
