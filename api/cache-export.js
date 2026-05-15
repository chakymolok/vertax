const crypto = require('crypto');
const { exportBeatportCache, getCacheStats } = require('./redis-cache');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function cacheExport(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, { message: 'Method not allowed' });
    return;
  }

  const token = String(req.query.token || '');
  const expected = String(process.env.EXPORT_TOKEN || '');
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  const isAuthorized = expectedBuffer.length > 0
    && tokenBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(tokenBuffer, expectedBuffer);

  if (!isAuthorized) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1000));
  const tracks = await exportBeatportCache(limit);
  const stats = await getCacheStats();
  send(res, 200, {
    exported_at: Date.now(),
    limit,
    total_tracks: stats.total_tracks,
    tracks
  });
};
