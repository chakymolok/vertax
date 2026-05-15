const { lookupBeatportMetadata } = require('./beatport-lookup');

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

module.exports = async function cacheRefresh(req, res) {
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

  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();
  const label = String(req.query.label || '').trim();
  if (!artist || !title) {
    send(res, 400, { message: 'artist and title are required' });
    return;
  }

  try {
    const body = await lookupBeatportMetadata(artist, title, label, { forceRefresh: true });
    send(res, 200, Object.assign({}, body, { refreshed: true }));
  } catch (error) {
    const status = error && error.status === 429 ? 429 : 500;
    send(res, status, { message: error && error.message ? error.message : 'Cache refresh failed' });
  }
};
