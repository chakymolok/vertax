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
      return {
        type: 'track',
        body: JSON.parse(trackRaw)
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

  await safeRedis('SET', [identity.trackKey, JSON.stringify(body)], null);
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
  makeBeatportCacheIdentity,
  getBeatportCache,
  setBeatportCache,
  deleteBeatportCache,
  getCacheStats,
  exportBeatportCache
};
