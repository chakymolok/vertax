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

function isHalfTimeGenre(genre, subGenre, bpm) {
  const n = Number(bpm);
  if (!Number.isFinite(n)) return false;
  const g = String(genre || '').trim().toLowerCase();
  const sg = String(subGenre || '').trim().toLowerCase();
  if (g === 'drum & bass' && n < 100) return true;
  if (g === 'dubstep' && n < 90) return true;
  if ((g === '140 / deep dubstep / grime' || sg === '140 / deep dubstep / grime') && n < 90) return true;
  return false;
}

function normalizeBeatportPayload(payload) {
  if (!payload || payload.matched === false) return payload || { matched: false };
  const out = Object.assign({}, payload);
  const bpm = Number(out.bpm);
  if (Number.isFinite(bpm)) {
    out.bpm = Math.round(bpm);
    if (isHalfTimeGenre(out.genre, out.sub_genre, out.bpm)) {
      out.original_bpm = out.original_bpm || out.bpm;
      out.bpm = out.bpm * 2;
      out.halftime_corrected = true;
    }
  } else {
    out.bpm = null;
  }
  return out;
}

function beatportPayloadFromRecord(record) {
  if (!record || record.matched === false) return null;
  if (record.beatport) return normalizeBeatportPayload(record.beatport);
  return normalizeBeatportPayload({
    bpm: record.bpm == null ? null : record.bpm,
    camelot: record.camelot || null,
    key_name: record.key_name || null,
    genre: record.genre || null,
    sub_genre: record.sub_genre || null,
    label: record.label || null,
    release_year: record.release_year || null,
    mix_name: record.mix_name || null,
    beatport_url: record.beatport_url || null,
    confidence: record.confidence == null ? null : record.confidence,
    source: 'beatport',
    id: record.id || null,
    slug: record.slug || null,
    artist: record.artist || null,
    title: record.title || null
  });
}

function normalizeTrackRecord(identity, body) {
  if (!body || body.matched === false) return body || { matched: false };
  const now = new Date().toISOString();
  if (body.beatport || body.curated) {
    const beatport = normalizeBeatportPayload(body.beatport || {});
    return Object.assign({}, body, {
      matched: true,
      track_key: body.track_key || identity.normalized,
      redis_key: body.redis_key || identity.trackKey,
      beatport,
      curated: body.curated || {},
      updated_at: body.updated_at || now
    });
  }
  return {
    matched: true,
    track_key: body.track_key || identity.normalized,
    redis_key: identity.trackKey,
    beatport: beatportPayloadFromRecord(body) || {},
    curated: {},
    created_at: body.created_at || now,
    updated_at: now
  };
}

function resolvedField(curated, beatport, field) {
  return curated && curated[field] != null && curated[field] !== ''
    ? curated[field]
    : beatport && beatport[field] != null && beatport[field] !== ''
      ? beatport[field]
      : null;
}

function resolveTrackRecord(record) {
  if (!record || record.matched === false) return record || { matched: false };
  const curated = record.curated || {};
  const beatport = normalizeBeatportPayload(record.beatport || {});
  const resolved = {};
  const sources = {};
  [
    'bpm', 'camelot', 'key_name', 'genre', 'sub_genre', 'label',
    'release_year', 'mix_name', 'beatport_url', 'confidence',
    'id', 'slug', 'artist', 'title', 'original_bpm', 'halftime_corrected'
  ].forEach((field) => {
    const value = resolvedField(curated, beatport, field);
    if (value != null) {
      resolved[field] = value;
      sources[field] = curated[field] != null && curated[field] !== '' ? 'curated' : 'beatport';
    }
  });
  return Object.assign({
    matched: true,
    track_key: record.track_key,
    redis_key: record.redis_key,
    resolved,
    sources,
    curated: Object.keys(curated).length ? curated : null,
    beatport: Object.keys(beatport).length ? beatport : null,
    _has_curated: Object.keys(curated).length > 0
  }, resolved, {
    source: Object.keys(curated).length ? 'curated' : 'beatport'
  });
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
      const record = normalizeTrackRecord(identity, JSON.parse(trackRaw));
      if (record && record.beatport) {
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

  const existingRaw = await safeRedis('GET', [identity.trackKey], null);
  let existing = null;
  try { existing = existingRaw ? normalizeTrackRecord(identity, JSON.parse(existingRaw)) : null; } catch (_) {}
  const record = Object.assign({}, existing || {}, {
    matched: true,
    track_key: existing && existing.track_key || identity.normalized,
    redis_key: identity.trackKey,
    beatport: beatportPayloadFromRecord(body) || {},
    curated: existing && existing.curated || {},
    updated_at: new Date().toISOString()
  });
  if (!record.created_at) record.created_at = record.updated_at;
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
