const {
  scanKeys,
  readTrack,
  safeRedis,
  setBeatportCache
} = require('../redis-cache');
const {
  enrichTrackFromBeatport
} = require('../beatport-lookup');

const TRACK_KEY_PATTERN = 'vertax:beatport:track:*';

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

function trackInput(record) {
  const flat = readTrack(record) || {};
  return {
    artist: String(flat.artist_original || flat.artist || '').trim(),
    title: String(flat.title_original || flat.title || '').trim(),
    mix: String(flat.mix_name || '').trim(),
    label: String(flat.label || '').trim(),
    confidence: Number(flat.confidence || 0) || 0
  };
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
    const keys = (await scanKeys(TRACK_KEY_PATTERN)).sort();
    const total = keys.length;
    const limit = limitParam > 0 ? limitParam : Math.max(0, total - offset);
    const batch = keys.slice(offset, offset + limit);
    let updated = 0;
    let failed = 0;
    let skippedNoMatch = 0;
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
        const input = trackInput(parsed);
        if (!input.artist || !input.title) throw new Error('missing artist_original/title_original');

        const mapped = await enrichTrackFromBeatport(input.artist, input.title, input.mix, input.label);
        if (!mapped || mapped.matched === false) {
          skippedNoMatch += 1;
          const message = 'new lookup found no match; old record kept';
          console.log('[beatport-rebuild] warning', position + '/' + total, key, message);
          if (errors.length < 50) errors.push({ track_key: key, error: message });
          if (index < batch.length - 1 && pauseMs > 0) await sleep(pauseMs);
          continue;
        }

        if (input.confidence && mapped.confidence < input.confidence) {
          console.log('[beatport-rebuild] warning lower confidence', key, 'old=' + input.confidence, 'new=' + mapped.confidence);
        }

        await setBeatportCache(identity, mapped);
        updated += 1;
        console.log('[beatport-rebuild] updated', position + '/' + total, mapped.beatport_track_id || '', mapped.title_original || '');
      } catch (error) {
        failed += 1;
        const message = error && error.message ? error.message : String(error);
        console.log('[beatport-rebuild] failed', position + '/' + total, key, message);
        if (errors.length < 50) errors.push({ track_key: key, error: message });
      }

      if (index < batch.length - 1 && pauseMs > 0) await sleep(pauseMs);
    }

    send(res, 200, {
      total,
      offset,
      limit,
      processed_in_batch: batch.length,
      next_offset: offset + batch.length < total ? offset + batch.length : null,
      has_more: offset + batch.length < total,
      updated,
      failed,
      skipped_no_match: skippedNoMatch,
      elapsed_ms: Date.now() - startedAt,
      errors
    });
  } catch (error) {
    send(res, 500, { message: error && error.message ? error.message : 'Rebuild failed' });
  }
};
