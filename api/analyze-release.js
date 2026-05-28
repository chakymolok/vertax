const {
  MAX_COLLECTION_TRACKS,
  getCollectionIndex,
  saveCollectionIndex,
  searchDiscogsCandidates,
  loadDiscogsRelease,
  analyzeReleaseAgainstIndex,
  sanitizeUserId
} = require('../lib/compatibility-analysis');
const { getAiVerdict } = require('../lib/ai-verdict');

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

function looksAmbiguous(candidates, query) {
  if (!candidates || candidates.length <= 1) return false;
  const q = String(query || '').trim().toLowerCase();
  if (/^\d+$/.test(q)) return candidates.length > 1;
  const first = candidates[0];
  const second = candidates[1];
  if (!first || !second) return false;
  if (String(first.catalog_number || '').toLowerCase() === q && String(second.catalog_number || '').toLowerCase() === q) return true;
  return candidates.length > 1;
}

async function resolveIndex(userId, body) {
  if (body.collection_hash) {
    const found = await getCollectionIndex(userId, body.collection_hash);
    if (found) return found;
    if (!Array.isArray(body.collection)) return null;
  }
  if (Array.isArray(body.collection)) {
    if (body.collection.length > MAX_COLLECTION_TRACKS) {
      const err = new Error('collection_too_large');
      err.status = 413;
      throw err;
    }
    const hash = String(body.collection_hash || 'fallback-' + Date.now()).trim();
    const saved = await saveCollectionIndex(userId, hash, body.collection);
    return saved.index;
  }
  return null;
}

module.exports = async function analyzeRelease(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const userId = sanitizeUserId(req.headers['x-user-id'] || req.headers['X-User-Id']);
  const body = await readJsonBody(req);
  if (!body) return send(res, 400, { error: 'bad_json' });
  if (!userId || userId === 'anonymous') return send(res, 400, { error: 'user_id_required' });

  if (body.action === 'ai_verdict') {
    try {
      const verdict = await getAiVerdict(body);
      return send(res, 200, Object.assign({ ok: true, status: 'ok' }, verdict));
    } catch (error) {
      const status = error && error.status ? error.status : 500;
      return send(res, status, {
        ok: false,
        error: status === 503 ? 'ai_unavailable' : 'ai_verdict_failed',
        message: error && error.message ? error.message : 'failed'
      });
    }
  }

  let index;
  try {
    index = await resolveIndex(userId, body);
  } catch (error) {
    if (error && error.status === 413) return send(res, 413, { error: 'collection_too_large', max_tracks: MAX_COLLECTION_TRACKS });
    return send(res, 500, { error: 'collection_index_failed', message: error && error.message ? error.message : 'failed' });
  }
  if (!index) {
    return send(res, 404, {
      error: 'collection_index_missing',
      message: 'Collection index not found or expired. Please sync collection first.'
    });
  }

  try {
    let releaseId = body.release_id;
    if (!releaseId) {
      const query = String(body.query || '').trim();
      if (!query) return send(res, 400, { error: 'query_or_release_id_required' });
      const candidates = await searchDiscogsCandidates(query);
      if (!candidates.length) return send(res, 404, { status: 'not_found', candidates: [] });
      if (looksAmbiguous(candidates, query)) {
        return send(res, 200, { status: 'needs_selection', candidates });
      }
      releaseId = candidates[0].discogs_id;
    }

    const release = await loadDiscogsRelease(releaseId);
    const analysis = await analyzeReleaseAgainstIndex({
      release,
      index,
      manual_tracks: body.manual_tracks || []
    });
    send(res, 200, Object.assign({ ok: true, status: 'ok', collection_hash: index.collection_hash }, analysis));
  } catch (error) {
    const status = error && error.status === 503 ? 503 : error && error.status === 429 ? 429 : 500;
    send(res, status, { error: 'analyze_release_failed', message: error && error.message ? error.message : 'failed' });
  }
};
