// CommonJS, zero deps, cannot crash on import
exports.config = { runtime: 'nodejs' };
module.exports = (_req, res) => {
  res.status(200).json({ ok: true, node: process.version, now: Date.now() });
};
