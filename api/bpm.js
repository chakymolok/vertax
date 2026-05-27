const GETSONGBPM_BASE = 'https://api.getsong.co';

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

module.exports = async function bpmProxy(req, res) {
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

  const key = process.env.GETSONGBPM_KEY || '';
  if (!key) {
    sendJson(res, 503, { error: 'getsongbpm_key_missing' });
    return;
  }

  const incoming = new URL(req.url, 'https://vertax.local');
  const lookup = String(incoming.searchParams.get('lookup') || '').trim();
  if (!lookup) {
    sendJson(res, 400, { error: 'lookup_required' });
    return;
  }

  const upstream = new URL('/search/', GETSONGBPM_BASE);
  upstream.searchParams.set('api_key', key);
  upstream.searchParams.set('type', 'both');
  upstream.searchParams.set('lookup', lookup);

  try {
    const upstreamRes = await fetch(upstream.toString(), {
      headers: { Accept: 'application/json' },
    });
    const text = await upstreamRes.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch (_) {
      body = { error: 'getsongbpm_bad_json', raw: text };
    }
    sendJson(res, upstreamRes.status, body);
  } catch (error) {
    sendJson(res, 502, {
      error: 'getsongbpm_proxy_failed',
      message: error && error.message ? error.message : String(error),
    });
  }
};
