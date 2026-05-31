const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('../../lib/beatport-auth');
const {
  markAdminManualFields,
  scanKeys,
  readTrack,
  safeRedis,
  setBeatportCache,
  upsertDiscogsTrackCache,
  getCacheStats,
} = require('../../lib/redis-cache');
const { getTelegramUserFromRequest, isAdminTelegramUser } = require('../../lib/telegram-auth');
const {
  candidateStats,
  candidateSeedStates,
  exportCandidates,
  refreshMarketplaceBatch,
  seedCandidates,
} = require('../../lib/release-candidates');
const {
  enrichTrackFromBeatport,
  fetchBeatportTrack,
  mapTrack,
  trackId,
} = require('../beatport-lookup');

const TRACK_KEY_PATTERN = 'vertax:beatport:track:*';
const CANDIDATE_LABELS_PATH = path.resolve(__dirname, '../../config/candidate-labels.json');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Telegram-Init-Data');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isAuthorized(req, body) {
  const token = process.env.ADMIN_TOKEN || '';
  const header = String(req.headers.authorization || '');
  if (token && header === 'Bearer ' + token) return true;
  const telegramAuth = getTelegramUserFromRequest(req, body);
  return isAdminTelegramUser(telegramAuth);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (_) {
      return Promise.resolve(null);
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 20 * 1024 * 1024) {
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanArray(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  return list
    .map((item) => String(item || '').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function cleanString(value, maxLength) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, maxLength || 120);
}

function cleanNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

function cleanCamelot(value) {
  const text = cleanString(value, 4);
  if (!text) return null;
  const upper = text.toUpperCase();
  return /^([1-9]|1[0-2])[AB]$/.test(upper) ? upper : null;
}

function normalizeBackupTrack(vinyl, track) {
  const artist = String(track.artist || track.vinylArtist || vinyl.artist || '').trim();
  const title = String(track.title || '').trim();
  if (!artist || !title) return null;

  const bpm = cleanNumber(track.bpm, 40, 240);
  const keyName = cleanString(track.key || track.key_name, 80);
  const camelot = cleanCamelot(track.camelot);
  const duration = cleanString(track.duration, 40);
  if (bpm === null && !keyName && !camelot && !duration) return null;

  return markAdminManualFields({
    artist_original: artist,
    title_original: title,
    label: cleanString(vinyl.label, 120),
    release_year: vinyl.year ? String(vinyl.year).slice(0, 4) : null,
    duration,
    discogs_release_id: vinyl.discogsId ? String(vinyl.discogsId) : null,
    discogs_position: cleanString(track.position, 40),
    discogs_catno: cleanString(vinyl.catno, 80),
    discogs_label: cleanString(vinyl.label, 120),
    discogs_genres: cleanArray(vinyl.genre || vinyl.genres),
    discogs_styles: cleanArray(vinyl.style || vinyl.styles),
    bpm,
    key_name: keyName,
    camelot,
    bpm_source: bpm !== null ? 'manual' : null,
    key_source: keyName || camelot ? 'manual' : null,
    confidence: cleanString(track.confidence, 40) || 'admin',
    meta_status: 'manual',
    original_bpm: cleanNumber(track.originalBpm || track.original_bpm, 40, 240),
    halftime_corrected: Boolean(track.halftimeCorrected || track.halftime_corrected),
  });
}

function getBackupVinyls(body) {
  if (Array.isArray(body && body.vinyls)) return body.vinyls;
  if (Array.isArray(body && body.collection)) return body.collection;
  if (body && body.backup && Array.isArray(body.backup.vinyls)) return body.backup.vinyls;
  return [];
}

function identityForKey(key, record) {
  return {
    normalized: (record && record.track_key) || key.replace(/^vertax:beatport:track:/, ''),
    hash: key.replace(/^vertax:beatport:track:/, ''),
    trackKey: key,
    missKey: key.replace(/^vertax:beatport:track:/, 'vertax:beatport:miss:'),
  };
}

function trackInput(record) {
  const flat = readTrack(record) || {};
  return {
    artist: String(flat.artist_original || flat.artist || '').trim(),
    title: String(flat.title_original || flat.title || '').trim(),
    mix: String(flat.mix_name || '').trim(),
    label: String(flat.label || '').trim(),
    beatportTrackId: String(
      flat.beatport_track_id || flat.id || trackId({ url: flat.beatport_url }) || ''
    ).trim(),
    confidence: Number(flat.confidence || 0) || 0,
  };
}

async function runImportBackup(body) {
  const vinyls = getBackupVinyls(body);
  if (!vinyls.length) return { ok: false, status: 400, message: 'backup has no vinyls' };

  let tracks_seen = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const vinyl of vinyls) {
    const tracklist = Array.isArray(vinyl && vinyl.tracklist) ? vinyl.tracklist : [];
    for (const track of tracklist) {
      tracks_seen += 1;
      const payload = normalizeBackupTrack(vinyl || {}, track || {});
      if (!payload) {
        skipped += 1;
        continue;
      }
      try {
        const result = await upsertDiscogsTrackCache(payload);
        if (result && result.ok) {
          updated += 1;
          if (result.created) created += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        if (errors.length < 30) {
          errors.push({
            artist: payload.artist_original,
            title: payload.title_original,
            error: error && error.message ? error.message : String(error),
          });
        }
      }
    }
  }

  return {
    ok: true,
    source: 'backup',
    admin_write: true,
    vinyls_seen: vinyls.length,
    tracks_seen,
    updated,
    created,
    skipped,
    errors,
  };
}

/* One-shot backfill: for cached Beatport tracks that lack sample_url,
 * re-fetch the track from Beatport and merge sample_url + sample_duration_ms
 * back into the cache. Existing entries pre-date the sample_url change. */
async function backfillBeatportSamples(body) {
  const limit = Math.max(1, Math.min(50, Number(body && body.limit) || 25));
  const dryRun = !!(body && body.dry_run);
  const keys = await scanKeys(TRACK_KEY_PATTERN);
  let examined = 0;
  let missing = 0;
  let updated = 0;
  let skipped_no_id = 0;
  let failed = 0;
  const errors = [];
  const token = dryRun ? null : await getAccessToken();
  for (const key of keys) {
    if (updated >= limit) break;
    examined++;
    const raw = await safeRedis('GET', [key], null);
    if (!raw) continue;
    let record;
    try { record = JSON.parse(raw); } catch (_) { continue; }
    const flat = readTrack(record) || {};
    if (flat.sample_url) continue;
    missing++;
    const tid = flat.beatport_track_id || flat.id;
    if (!tid) { skipped_no_id++; continue; }
    if (dryRun) continue;
    try {
      const fresh = await fetchBeatportTrack(token, tid);
      if (fresh) {
        const mapped = mapTrack(fresh, 1, { artist: flat.artist_original, title: flat.title_original });
        if (mapped && mapped.sample_url) {
          /* Merge only the sample fields — don't disturb other curated data. */
          const merged = Object.assign({}, flat, {
            sample_url: mapped.sample_url,
            sample_duration_ms: mapped.sample_duration_ms || flat.sample_duration_ms || null,
          });
          await safeRedis('SET', [key, JSON.stringify(merged)], null);
          updated++;
        }
      }
      await new Promise((r) => setTimeout(r, 350));
    } catch (error) {
      failed++;
      if (errors.length < 20)
        errors.push({ key, error: error && error.message ? error.message : String(error) });
    }
  }
  return {
    ok: true,
    keys_scanned: keys.length,
    examined,
    missing_sample: missing,
    updated,
    skipped_no_id,
    failed,
    dry_run: dryRun,
    errors,
  };
}

async function runRebuild(body, query) {
  const startedAt = Date.now();
  const offset = Math.max(0, Number(body.offset || query.offset || 0) || 0);
  const limitParam = Number(body.limit || query.limit || 0) || 0;
  const pauseMs = Math.max(0, Number(body.pause_ms || query.pause_ms || 1000) || 1000);

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
    try {
      const raw = await safeRedis('GET', [key], null);
      if (!raw) throw new Error('missing redis record');
      const parsed = JSON.parse(raw);
      const identity = identityForKey(key, parsed);
      const input = trackInput(parsed);
      let mapped;
      if (input.artist && input.title) {
        mapped = await enrichTrackFromBeatport(input.artist, input.title, input.mix, input.label);
      } else if (input.beatportTrackId) {
        const token = await getAccessToken();
        const fullTrack = await fetchBeatportTrack(token, input.beatportTrackId);
        mapped = mapTrack(fullTrack, input.confidence || 1, {});
      } else {
        throw new Error('missing artist_original/title_original and beatport_track_id');
      }

      if (!mapped || mapped.matched === false) {
        skippedNoMatch += 1;
        if (errors.length < 50)
          errors.push({ track_key: key, error: 'new lookup found no match; old record kept' });
        if (index < batch.length - 1 && pauseMs > 0) await sleep(pauseMs);
        continue;
      }

      await setBeatportCache(identity, mapped);
      updated += 1;
    } catch (error) {
      failed += 1;
      const message = error && error.message ? error.message : String(error);
      if (errors.length < 50) errors.push({ track_key: key, position, error: message });
    }

    if (index < batch.length - 1 && pauseMs > 0) await sleep(pauseMs);
  }

  return {
    ok: true,
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
    errors,
  };
}

function userIdsFromCollectionIndexKeys(keys) {
  const users = new Set();
  (keys || []).forEach((key) => {
    const match = String(key || '').match(/^collection_index:([^:]+):/);
    if (match && match[1]) users.add(match[1]);
  });
  return users;
}

function compactReleaseForAdmin(release) {
  return {
    discogs_id: release.discogs_id,
    artist: release.artist || '',
    title: release.title || '',
    label: release.label || '',
    genre_family: release.genre_family || '',
    year: release.year || null,
    catalog_number: release.catalog_number || '',
    metadata_coverage: release.metadata_coverage || 0,
    track_count: release.track_count || 0,
    enriched_track_count: release.enriched_track_count || 0,
    updated_at: release.updated_at || release.ingested_at || null,
    ingested_at: release.ingested_at || null,
    marketplace: release.marketplace || null,
    cover_url: release.cover_url || '',
    discogs_url: release.discogs_url || '',
  };
}

function loadCandidateLabelConfig() {
  try {
    const raw = fs.readFileSync(CANDIDATE_LABELS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.labels) ? parsed.labels : [];
  } catch (_) {
    return [];
  }
}

function adminSeedConfig(candidateStatsResult) {
  const byGenre = (candidateStatsResult && candidateStatsResult.by_genre_family) || {};
  const labels = loadCandidateLabelConfig().map((label) => {
    const family = String(label.genre_family || 'other');
    return {
      name: label.name || '',
      discogs_label_id: label.discogs_label_id || null,
      enabled: label.enabled !== false,
      priority: label.priority || 'medium',
      genre_family: family,
      max_batches_per_run: Number(label.max_batches_per_run) || 1,
      current_family_count: Number(byGenre[family]) || 0,
    };
  });
  const families = {};
  labels.forEach((label) => {
    const family = label.genre_family || 'other';
    families[family] = families[family] || {
      genre_family: family,
      configured_labels: 0,
      enabled_labels: 0,
      current_count: Number(byGenre[family]) || 0,
      missing_enabled_source: true,
    };
    families[family].configured_labels += 1;
    if (label.enabled && label.discogs_label_id) {
      families[family].enabled_labels += 1;
      families[family].missing_enabled_source = false;
    }
  });
  return {
    labels,
    families: Object.values(families).sort((a, b) =>
      String(a.genre_family).localeCompare(String(b.genre_family))
    ),
  };
}

async function adminOverview() {
  const [candidateStatsResult, seedStateResult, cacheStats] = await Promise.all([
    candidateStats(),
    candidateSeedStates(),
    getCacheStats(),
  ]);
  const [collectionIndexKeys, aiVerdictKeys, proposalKeys] = await Promise.all([
    scanKeys('collection_index:*'),
    scanKeys('ai_verdict:*'),
    scanKeys('vertax:proposal:*'),
  ]);
  const candidateSample = await exportCandidates(60);
  const recentCandidates = candidateSample
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a.updated_at || a.ingested_at || '') || 0;
      const bt = Date.parse(b.updated_at || b.ingested_at || '') || 0;
      return bt - at;
    })
    .slice(0, 24)
    .map(compactReleaseForAdmin);
  const indexUsers = userIdsFromCollectionIndexKeys(collectionIndexKeys);
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    users: {
      collection_index_count: collectionIndexKeys.length,
      collection_index_users: indexUsers.size,
      note: 'Local-first app: only users who touched server-side analysis are visible here.',
    },
    redis: cacheStats,
    candidates: candidateStatsResult,
    seed_config: adminSeedConfig(candidateStatsResult),
    seed: seedStateResult,
    temporary_cache: {
      ai_verdict_count: aiVerdictKeys.length,
    },
    proposals: {
      pending_count: proposalKeys.length,
    },
    recent_candidates: recentCandidates,
  };
}

module.exports = async function adminMaintenance(req, res) {
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
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    send(res, 400, { message: 'invalid JSON body' });
    return;
  }
  if (!isAuthorized(req, body)) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  try {
    if (body.action === 'admin_overview') {
      send(res, 200, await adminOverview());
      return;
    }
    if (body.action === 'import_backup') {
      const result = await runImportBackup(body);
      send(res, result.status || (result.ok ? 200 : 400), result);
      return;
    }
    if (body.action === 'rebuild') {
      send(res, 200, await runRebuild(body, req.query || {}));
      return;
    }
    if (body.action === 'seed_candidates') {
      const result = await seedCandidates(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'candidate_stats') {
      send(res, 200, await candidateStats());
      return;
    }
    if (body.action === 'candidate_seed_state') {
      send(res, 200, await candidateSeedStates());
      return;
    }
    if (body.action === 'export_candidates') {
      const candidates = await exportCandidates(body.limit);
      send(res, 200, { ok: true, type: 'candidates', count: candidates.length, candidates });
      return;
    }
    if (body.action === 'refresh_marketplace') {
      const result = await refreshMarketplaceBatch(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'backfill_beatport_samples') {
      const result = await backfillBeatportSamples(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    send(res, 400, { error: 'unknown_action' });
  } catch (error) {
    send(res, error && error.status ? error.status : 500, {
      ok: false,
      error: error && error.message ? error.message : 'maintenance_failed',
    });
  }
};
