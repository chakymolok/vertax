const { recommendCandidates } = require('../lib/candidate-recommendations');
const { sanitizeUserId } = require('../lib/compatibility-analysis');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-User-Id');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 512 * 1024) {
        raw = '';
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function candidates(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const userId = sanitizeUserId(req.headers['x-user-id'] || req.headers['X-User-Id']);
  const body = await readJsonBody(req);
  if (!body) return send(res, 400, { ok: false, error: 'bad_json' });
  if (!userId || userId === 'anonymous')
    return send(res, 400, { ok: false, error: 'user_id_required' });
  if (!body.collection_hash)
    return send(res, 400, { ok: false, error: 'collection_hash_required' });

  try {
    const result = await recommendCandidates({ userId, body });
    if (result && result.error === 'collection_index_missing') return send(res, 404, result);
    send(res, 200, result);
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    send(res, status, {
      ok: false,
      error: error && error.message ? error.message : 'candidates_failed',
    });
  }
};
