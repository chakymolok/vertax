const {
  INDEX_TTL_SECONDS,
  MAX_COLLECTION_TRACKS,
  normalizeCollectionPayload,
  saveCollectionIndex,
  sanitizeUserId
} = require('../lib/compatibility-analysis');

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
      if (raw.length > 2 * 1024 * 1024) {
        raw = '';
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function collectionIndex(req, res) {
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

  const collectionHash = String(body.collection_hash || '').trim();
  const collection = Array.isArray(body.collection) ? body.collection : [];
  if (!userId || userId === 'anonymous') return send(res, 400, { ok: false, error: 'user_id_required' });
  if (!collectionHash) return send(res, 400, { ok: false, error: 'collection_hash_required' });
  if (!collection.length) return send(res, 400, { ok: false, error: 'collection_required' });

  const normalized = normalizeCollectionPayload(collection);
  if (normalized.tracks.length > MAX_COLLECTION_TRACKS) {
    return send(res, 413, { ok: false, error: 'collection_too_large', max_tracks: MAX_COLLECTION_TRACKS });
  }

  try {
    const result = await saveCollectionIndex(userId, collectionHash, collection);
    const index = result.index || {};
    send(res, 200, {
      ok: true,
      collection_hash: collectionHash,
      track_count: index.track_count || 0,
      record_count: index.record_count || 0,
      expires_in_days: Math.round(INDEX_TTL_SECONDS / 86400),
      status: result.status
    });
  } catch (error) {
    if (error && error.status === 413) {
      return send(res, 413, { ok: false, error: 'collection_too_large', max_tracks: MAX_COLLECTION_TRACKS });
    }
    send(res, 500, { ok: false, error: 'collection_index_failed', message: error && error.message ? error.message : 'failed' });
  }
};
