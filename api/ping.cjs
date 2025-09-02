module.exports = (_req, res) => {
  res.status(200).json({ ok: true, node: process.version, now: Date.now() });
};
module.exports.config = { runtime: 'nodejs' };
