const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'Vertax/1.0 +https://vertax.live';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function getToken() {
  return process.env.DISCOGS_TOKEN || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN || '';
}

function clampPerPage(value, fallback, max) {
  var n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return String(Math.min(n, max));
}

function copySearchParam(from, to, key) {
  var value = from.searchParams.get(key);
  if (value) to.searchParams.set(key, value);
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  var token = getToken();
  if (!token) {
    sendJson(res, 500, { error: 'discogs_token_missing' });
    return;
  }

  var incoming = new URL(req.url, 'https://vertax.local');
  var action = incoming.searchParams.get('action') || incoming.searchParams.get('kind') || 'search';
  var upstream;

  if (action === 'search') {
    upstream = new URL('/database/search', DISCOGS_BASE);
    ['q', 'artist', 'title', 'release_title', 'catno', 'barcode', 'label', 'year', 'country'].forEach(function(key) {
      copySearchParam(incoming, upstream, key);
    });
    upstream.searchParams.set('type', incoming.searchParams.get('type') || 'release');
    upstream.searchParams.set('format', incoming.searchParams.get('format') || 'Vinyl');
    upstream.searchParams.set('per_page', clampPerPage(incoming.searchParams.get('per_page'), 8, 25));
  } else if (action === 'release') {
    var releaseId = incoming.searchParams.get('id');
    if (!/^\d+$/.test(String(releaseId || ''))) {
      sendJson(res, 400, { error: 'release_id_required' });
      return;
    }
    upstream = new URL('/releases/' + releaseId, DISCOGS_BASE);
  } else if (action === 'collection') {
    var username = incoming.searchParams.get('username');
    if (!username) {
      sendJson(res, 400, { error: 'username_required' });
      return;
    }
    upstream = new URL('/users/' + encodeURIComponent(username) + '/collection/folders/0/releases', DISCOGS_BASE);
    upstream.searchParams.set('per_page', clampPerPage(incoming.searchParams.get('per_page'), 100, 100));
    upstream.searchParams.set('page', String(parseInt(incoming.searchParams.get('page') || '1', 10) || 1));
  } else {
    sendJson(res, 400, { error: 'unknown_discogs_action' });
    return;
  }

  upstream.searchParams.set('token', token);

  try {
    var upstreamRes = await fetch(upstream.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      }
    });
    var text = await upstreamRes.text();
    var body;

    try {
      body = text ? JSON.parse(text) : {};
    } catch (_) {
      body = { error: 'discogs_bad_json' };
    }

    sendJson(res, upstreamRes.status, body);
  } catch (err) {
    console.error('Discogs proxy failed:', err && err.message ? err.message : err);
    sendJson(res, 502, { error: 'discogs_proxy_failed' });
  }
};
