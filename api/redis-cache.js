const crypto = require('crypto');

const TRACK_SET_KEY = 'vertax:beatport:tracks';
const MISS_TTL_SECONDS = 7 * 24 * 60 * 60;

function getRedisUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
}

function getRedisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
}

function getRedisUrlSource() {
  if (process.env.UPSTASH_REDIS_REST_URL) return 'upstash';
  if (process.env.KV_REST_API_URL) return 'vercel_kv';
  return 'none';
}

function hasRedisEnv() {
  return Boolean(getRedisUrl() && getRedisToken());
}

function normalizeCachePart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*(original|extended|radio|edit|remix|mix|version|vip|dub|remaster|feat|ft|with)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*(original|extended|radio|edit|remix|mix|version|vip|dub|remaster|feat|ft|with)[^\]]*\]/gi, ' ')
    .replace(/\b(feat|ft|with)\.?\b/gi, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeBeatportCacheIdentity(artist, title, label) {
  const normalized = [
    normalizeCachePart(artist),
    normalizeCachePart(title),
    normalizeCachePart(label)
  ].join('|');
  const hash = crypto.createHash('sha1').update(normalized).digest('hex');
  return {
    normalized,
    hash,
    trackKey: 'vertax:beatport:track:' + hash,
    missKey: 'vertax:beatport:miss:' + hash
  };
}

const HALFTIME_GENRES = [
  'drum & bass',
  'jungle',
  'footwork',
  'footwork / juke',
  'juke / footwork'
];

const HALFTIME_SUB_GENRES = [
  'jungle',
  'footwork',
  'halftime'
];

function normalizeGenre(value) {
  return String(value || '').trim().toLowerCase();
}

function isHalfTimeGenre(genre, subGenre) {
  return HALFTIME_GENRES.indexOf(normalizeGenre(genre)) >= 0
    || HALFTIME_SUB_GENRES.indexOf(normalizeGenre(subGenre)) >= 0;
}

function normalizeBeatportPayload(payload) {
  if (!payload || payload.matched === false) return payload || { matched: false };
  const out = Object.assign({}, payload);
  const bpm = Number(out.bpm);
  if (Number.isFinite(bpm)) {
    out.bpm = Math.round(bpm);
    if (isHalfTimeGenre(out.genre, out.sub_genre) && out.bpm < 100) {
      out.original_bpm = out.original_bpm || out.bpm;
      out.bpm = out.bpm * 2;
      out.halftime_corrected = true;
    } else if (!(isHalfTimeGenre(out.genre, out.sub_genre) && out.halftime_corrected && out.original_bpm != null)) {
      delete out.original_bpm;
      delete out.halftime_corrected;
    }
  } else {
    out.bpm = null;
  }
  return out;
}

function readTrack(record) {
  if (!record || record.matched === false) return record || null;
  if (record.beatport) {
    return normalizeBeatportPayload(Object.assign({}, record.beatport, record.curated || {}));
  }
  return normalizeBeatportPayload(record);
}

function beatportPayloadFromRecord(record) {
  const flat = readTrack(record);
  if (!flat || flat.matched === false) return null;
  return normalizeBeatportPayload({
    artist_original: flat.artist_original || flat.artist || null,
    title_original: flat.title_original || flat.title || null,
    bpm: flat.bpm == null ? null : flat.bpm,
    camelot: flat.camelot || null,
    key_name: flat.key_name || null,
    genre: flat.genre || null,
    sub_genre: flat.sub_genre || null,
    label: flat.label || null,
    release_year: flat.release_year || null,
    mix_name: flat.mix_name || null,
    beatport_url: flat.beatport_url || null,
    beatport_track_id: flat.beatport_track_id || flat.id || null,
    confidence: flat.confidence == null ? null : flat.confidence,
    source: 'beatport',
    slug: flat.slug || null,
    original_bpm: flat.original_bpm == null ? null : flat.original_bpm,
    halftime_corrected: flat.halftime_corrected || false,
    savedAt: flat.savedAt || new Date().toISOString()
  });
}

function normalizeTrackRecord(identity, body) {
  const flat = beatportPayloadFromRecord(body);
  if (!flat || flat.matched === false) return body || { matched: false };
  return Object.assign({}, flat, {
    matched: true,
    track_key: flat.track_key || body.track_key || identity.normalized,
    redis_key: identity.trackKey,
    savedAt: new Date().toISOString()
  });
}

function resolveTrackRecord(record) {
  return readTrack(record) || record || { matched: false };
}

async function redisCommand(command, args) {
  if (!hasRedisEnv()) return null;

  const base = getRedisUrl().replace(/\/+$/, '');
  const response = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + getRedisToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([command].concat(args || []))
  });

  if (!response.ok) {
    const error = new Error('Redis command failed: ' + command + ' HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (data && data.error) {
    throw new Error('Redis command failed: ' + data.error);
  }
  return data ? data.result : null;
}

async function safeRedis(command, args, fallback) {
  try {
    return await redisCommand(command, args);
  } catch (error) {
    console.warn('Redis cache unavailable', error && error.message ? error.message : error);
    return fallback;
  }
}

async function getBeatportCache(identity) {
  const trackRaw = await safeRedis('GET', [identity.trackKey], null);
  if (trackRaw) {
    try {
      const parsed = JSON.parse(trackRaw);
      const record = normalizeTrackRecord(identity, parsed);
      if (parsed && parsed.beatport) {
        await safeRedis('SET', [identity.trackKey, JSON.stringify(record)], null);
      }
      return {
        type: 'track',
        body: resolveTrackRecord(record),
        record
      };
    } catch (_) {}
  }

  const missRaw = await safeRedis('GET', [identity.missKey], null);
  if (missRaw) {
    try {
      return {
        type: 'miss',
        body: JSON.parse(missRaw)
      };
    } catch (_) {}
  }

  return null;
}

async function setBeatportCache(identity, body) {
  if (!body || body.matched === false) {
    await safeRedis('SET', [identity.missKey, JSON.stringify(body || { matched: false }), 'EX', MISS_TTL_SECONDS], null);
    return;
  }

  const record = Object.assign({}, beatportPayloadFromRecord(body) || {}, {
    matched: true,
    track_key: body.track_key || identity.normalized,
    redis_key: identity.trackKey,
    source: 'beatport',
    savedAt: new Date().toISOString()
  });
  await safeRedis('SET', [identity.trackKey, JSON.stringify(record)], null);
  await safeRedis('SADD', [TRACK_SET_KEY, identity.trackKey], null);
}

async function deleteBeatportCache(identity) {
  await safeRedis('DEL', [identity.trackKey], null);
  await safeRedis('DEL', [identity.missKey], null);
  await safeRedis('SREM', [TRACK_SET_KEY, identity.trackKey], null);
}

async function countKeysByScan(pattern) {
  let cursor = '0';
  let total = 0;
  do {
    const result = await safeRedis('SCAN', [cursor, 'MATCH', pattern, 'COUNT', 500], null);
    if (!Array.isArray(result) || result.length < 2) return total;
    cursor = String(result[0] || '0');
    total += Array.isArray(result[1]) ? result[1].length : 0;
  } while (cursor !== '0');
  return total;
}

async function scanKeys(pattern) {
  let cursor = '0';
  const keys = [];
  do {
    const result = await safeRedis('SCAN', [cursor, 'MATCH', pattern, 'COUNT', 500], null);
    if (!Array.isArray(result) || result.length < 2) return keys;
    cursor = String(result[0] || '0');
    if (Array.isArray(result[1])) keys.push.apply(keys, result[1]);
  } while (cursor !== '0');
  return keys;
}

async function getCacheStats() {
  const ping = await safeRedis('PING', [], null);
  const totalTracks = Number(await safeRedis('SCARD', [TRACK_SET_KEY], 0)) || 0;
  const totalMisses = await countKeysByScan('vertax:beatport:miss:*');
  return {
    redis_enabled: hasRedisEnv(),
    redis_url_source: getRedisUrlSource(),
    redis_ping_ok: ping === 'PONG',
    total_tracks: totalTracks,
    total_misses: totalMisses
  };
}

async function exportBeatportCache(limit) {
  const keys = await safeRedis('SMEMBERS', [TRACK_SET_KEY], []) || [];
  const out = [];
  for (const key of keys.slice(0, limit || 1000)) {
    const raw = await safeRedis('GET', [key], null);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch (_) {}
  }
  return out;
}

module.exports = {
  MISS_TTL_SECONDS,
  getRedisUrlSource,
  redisCommand,
  safeRedis,
  normalizeCachePart,
  readTrack,
  scanKeys,
  makeBeatportCacheIdentity,
  normalizeBeatportPayload,
  normalizeTrackRecord,
  resolveTrackRecord,
  beatportPayloadFromRecord,
  getBeatportCache,
  setBeatportCache,
  deleteBeatportCache,
  getCacheStats,
  exportBeatportCache
};
