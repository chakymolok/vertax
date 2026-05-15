const { getAccessToken } = require('../beatport-auth');
const {
  safeRedis,
  setBeatportCache,
  normalizeTrackRecord,
  beatportPayloadFromRecord
} = require('../redis-cache');
const {
  fetchBeatportTrack,
  mapTrack,
  trackId
} = require('../beatport-lookup');

const TRACK_SET_KEY = 'vertax:beatport:tracks';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isAuthorized(req) {
  const token = process.env.ADMIN_TOKEN || '';
  const header = String(req.headers.authorization || '');
  return Boolean(token && header === 'Bearer ' + token);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function identityForKey(key, record) {
  return {
    normalized: record && record.track_key || key.replace(/^vertax:beatport:track:/, ''),
    hash: key.replace(/^vertax:beatport:track:/, ''),
    trackKey: key,
    missKey: key.replace(/^vertax:beatport:track:/, 'vertax:beatport:miss:')
  };
}

function extractBeatportId(record) {
  const beatport = beatportPayloadFromRecord(record) || {};
  return trackId(beatport)
    || trackId(record)
    || trackId({ url: beatport.beatport_url || record && record.beatport_url });
}

module.exports = async function adminRebuild(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { message: 'Method not allowed' });
    return;
  }
  if (!isAuthorized(req)) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  const startedAt = Date.now();
  const offset = Math.max(0, Number(req.query.offset || 0) || 0);
  const limitParam = Number(req.query.limit || 0) || 0;
  const pauseMs = Math.max(0, Number(req.query.pause_ms || 1000) || 1000);

  try {
    const keys = (await safeRedis('SMEMBERS', [TRACK_SET_KEY], []) || []).sort();
    const total = keys.length;
    const limit = limitParam > 0 ? limitParam : Math.max(0, total - offset);
    const batch = keys.slice(offset, offset + limit);
    const token = await getAccessToken();
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (let index = 0; index < batch.length; index++) {
      const key = batch[index];
      const position = offset + index + 1;
      console.log('[beatport-rebuild] start', position + '/' + total, key);

      try {
        const raw = await safeRedis('GET', [key], null);
        if (!raw) throw new Error('missing redis record');
        const parsed = JSON.parse(raw);
        const identity = identityForKey(key, parsed);
        const record = normalizeTrackRecord(identity, parsed);
        const id = extractBeatportId(record);
        if (!id) throw new Error('missing beatport track id');

        const fullTrack = await fetchBeatportTrack(token, id);
        const mapped = mapTrack(fullTrack, 1);
        await setBeatportCache(identity, mapped);
        updated += 1;
        console.log('[beatport-rebuild] updated', position + '/' + total, id, mapped.title || '');
      } catch (error) {
        failed += 1;
        const message = error && error.message ? error.message : String(error);
        console.log('[beatport-rebuild] failed', position + '/' + total, key, message);
        if (errors.length < 50) errors.push({ key, message });
      }

      if (index < batch.length - 1 && pauseMs > 0) await sleep(pauseMs);
    }

    send(res, 200, {
      total,
      offset,
      limit,
      processed: batch.length,
      updated,
      failed,
      next_offset: offset + batch.length < total ? offset + batch.length : null,
      done: offset + batch.length >= total,
      elapsed_ms: Date.now() - startedAt,
      errors
    });
  } catch (error) {
    send(res, 500, { message: error && error.message ? error.message : 'Rebuild failed' });
  }
};
