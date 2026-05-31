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
  seedLabelKey,
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

/* List candidates with paging + sort + filter. Returns lean rows
 * (without full tracklists) so the admin grid stays snappy. */
async function listCandidatesPaged(body) {
  const releases = await exportCandidates(10000);
  const labelFilter = body && body.label ? String(body.label).toLowerCase() : '';
  const genreFilter = body && body.genre_family ? String(body.genre_family) : '';
  const search = body && body.q ? String(body.q).toLowerCase() : '';
  const sortBy = (body && body.sort_by) || 'updated_at';
  const sortDir = body && body.sort_dir === 'asc' ? 1 : -1;
  const limit = Math.max(1, Math.min(500, Number(body && body.limit) || 50));
  const offset = Math.max(0, Number(body && body.offset) || 0);

  const filtered = releases.filter((release) => {
    if (labelFilter && String(release.label || '').toLowerCase() !== labelFilter) return false;
    if (genreFilter && String(release.genre_family || '') !== genreFilter) return false;
    if (search) {
      const hay = (
        String(release.artist || '') +
        ' ' +
        String(release.title || '') +
        ' ' +
        String(release.catalog_number || '')
      ).toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    let av, bv;
    if (sortBy === 'updated_at' || sortBy === 'ingested_at' || sortBy === 'marketplace_refreshed_at') {
      av = Date.parse((sortBy === 'marketplace_refreshed_at'
        ? (a.marketplace && a.marketplace.refreshed_at)
        : a[sortBy]) || '') || 0;
      bv = Date.parse((sortBy === 'marketplace_refreshed_at'
        ? (b.marketplace && b.marketplace.refreshed_at)
        : b[sortBy]) || '') || 0;
    } else if (sortBy === 'year') {
      av = Number(a.year) || 0;
      bv = Number(b.year) || 0;
    } else if (sortBy === 'track_count' || sortBy === 'enriched_track_count') {
      av = Number(a[sortBy]) || 0;
      bv = Number(b[sortBy]) || 0;
    } else if (sortBy === 'metadata_coverage') {
      av = Number(a.metadata_coverage) || 0;
      bv = Number(b.metadata_coverage) || 0;
    } else if (sortBy === 'lowest_price') {
      av = Number(a.marketplace && a.marketplace.lowest_price) || 0;
      bv = Number(b.marketplace && b.marketplace.lowest_price) || 0;
    } else {
      av = String(a[sortBy] || '').toLowerCase();
      bv = String(b[sortBy] || '').toLowerCase();
      return av < bv ? -1 * sortDir : av > bv ? 1 * sortDir : 0;
    }
    return (av - bv) * sortDir;
  });

  return {
    ok: true,
    total: filtered.length,
    offset,
    limit,
    has_more: offset + limit < filtered.length,
    rows: filtered.slice(offset, offset + limit).map(compactReleaseForAdmin),
  };
}

/* For a single release: refetch Discogs marketplace + Beatport samples
 * for any tracks lacking sample_url. Returns the updated compact view. */
async function enrichSingleCandidate(body) {
  const id = String((body && body.discogs_id) || '').trim();
  if (!id) return { ok: false, error: 'discogs_id_required' };

  const all = await exportCandidates(10000);
  const release = all.find((r) => String(r.discogs_id) === id);
  if (!release) return { ok: false, error: 'not_found', discogs_id: id };

  /* 1) Marketplace refresh (always fresh for single-shot enrichment) */
  const marketplace = await refreshMarketplaceBatch({ limit: 1, only_id: id, older_than_hours: 0 });

  /* 2) Beatport sample backfill for THIS release's tracks */
  const tracks = Array.isArray(release.tracks) ? release.tracks : [];
  let samplesUpdated = 0;
  for (const track of tracks) {
    if (track.sample_url) continue;
    const tid = track.beatport_track_id;
    if (!tid) continue;
    try {
      const fresh = await fetchBeatportTrack(tid);
      if (!fresh) continue;
      const mapped = mapTrack(fresh, 1, { artist: track.artist, title: track.title });
      if (mapped && mapped.sample_url) {
        track.sample_url = mapped.sample_url;
        track.sample_duration_ms = mapped.sample_duration_ms || track.sample_duration_ms || null;
        samplesUpdated++;
      }
      await sleep(300);
    } catch (_) {}
  }
  if (samplesUpdated > 0) {
    /* Persist back to candidate cache */
    const { saveReleaseCandidate } = require('../../lib/release-candidates');
    await saveReleaseCandidate(release);
  }
  return {
    ok: true,
    discogs_id: id,
    marketplace_updated: marketplace && marketplace.updated ? marketplace.updated : 0,
    samples_updated: samplesUpdated,
    release: compactReleaseForAdmin(release),
  };
}

/* Read label config + return counts of how many releases each label
 * has actually ingested (via candidate index keys). */
async function listCandidateLabels() {
  const config = loadCandidateLabelConfig();
  const releases = await exportCandidates(10000);
  const counts = {};
  releases.forEach((r) => {
    const label = String(r.label || '').toLowerCase();
    if (label) counts[label] = (counts[label] || 0) + 1;
  });
  const out = config.map((label) => {
    return {
      name: label.name,
      discogs_label_id: label.discogs_label_id || null,
      priority: label.priority || 'medium',
      enabled: label.enabled !== false,
      genre_family: label.genre_family || 'other',
      max_batches_per_run: label.max_batches_per_run || 1,
      candidate_count: counts[String(label.name).toLowerCase()] || 0,
    };
  });
  /* Also include any labels we have releases for but not in config */
  const knownNames = new Set(config.map((l) => String(l.name).toLowerCase()));
  Object.keys(counts).forEach((name) => {
    if (!knownNames.has(name)) {
      out.push({
        name: name,
        unmanaged: true,
        candidate_count: counts[name],
      });
    }
  });
  out.sort((a, b) => (b.candidate_count || 0) - (a.candidate_count || 0));
  return { ok: true, labels: out };
}

/* ============================================================
   COLLECTION TAB — full vertax:beatport:track:* browser
   ============================================================ */

/* Paginated list of cached Beatport tracks with filter + sort.
 * Backed by scanKeys; bounded fan-out so it stays responsive. */
async function listTracksPaged(body) {
  const offset = Math.max(0, Number(body && body.offset) || 0);
  const limit = Math.max(1, Math.min(200, Number(body && body.limit) || 50));
  const q = body && body.q ? String(body.q).toLowerCase() : '';
  const onlyMissingSample = !!(body && body.only_missing_sample);
  const onlyMissingBpm = !!(body && body.only_missing_bpm);
  const onlyManual = !!(body && body.only_manual);
  const sortBy = (body && body.sort_by) || 'savedAt';
  const sortDir = body && body.sort_dir === 'asc' ? 1 : -1;

  const keys = (await scanKeys(TRACK_KEY_PATTERN)).sort();
  const rows = [];
  /* Bounded: if the cache grows past ~5k, this still finishes < 5s on the
   * Hobby plan because each record is a single Redis GET. */
  for (const key of keys) {
    const raw = await safeRedis('GET', [key], null);
    if (!raw) continue;
    let record;
    try { record = JSON.parse(raw); } catch (_) { continue; }
    const flat = readTrack(record) || {};
    if (q) {
      const hay = (
        String(flat.artist_original || flat.artist || '') + ' ' +
        String(flat.title_original || flat.title || '') + ' ' +
        String(flat.label || '')
      ).toLowerCase();
      if (hay.indexOf(q) < 0) continue;
    }
    if (onlyMissingSample && flat.sample_url) continue;
    if (onlyMissingBpm && flat.bpm) continue;
    if (onlyManual && !(String(flat.meta_status || '').toLowerCase() === 'admin' || String(flat.bpm_source || '').toLowerCase() === 'admin')) continue;
    rows.push({
      key,
      artist: flat.artist_original || flat.artist || '',
      title: flat.title_original || flat.title || '',
      label: flat.label || '',
      bpm: flat.bpm || null,
      camelot: flat.camelot || null,
      key_name: flat.key_name || null,
      genre: flat.genre || null,
      sub_genre: flat.sub_genre || null,
      sample_url: flat.sample_url || null,
      beatport_url: flat.beatport_url || null,
      beatport_track_id: flat.beatport_track_id || null,
      bpm_source: flat.bpm_source || null,
      key_source: flat.key_source || null,
      meta_status: flat.meta_status || null,
      savedAt: flat.savedAt || null,
    });
  }

  rows.sort((a, b) => {
    let av, bv;
    if (sortBy === 'savedAt') {
      av = Date.parse(a.savedAt || '') || 0;
      bv = Date.parse(b.savedAt || '') || 0;
    } else if (sortBy === 'bpm') {
      av = Number(a.bpm) || 0;
      bv = Number(b.bpm) || 0;
    } else {
      av = String(a[sortBy] || '').toLowerCase();
      bv = String(b[sortBy] || '').toLowerCase();
      return av < bv ? -1 * sortDir : av > bv ? 1 * sortDir : 0;
    }
    return (av - bv) * sortDir;
  });

  return {
    ok: true,
    total: rows.length,
    keys_scanned: keys.length,
    offset,
    limit,
    has_more: offset + limit < rows.length,
    rows: rows.slice(offset, offset + limit),
  };
}

/* Inline-edit a single track. Used by admin to set BPM / camelot manually.
 * Marks meta_status='admin' so future enrichments don't overwrite. */
async function updateTrack(body) {
  const key = String((body && body.key) || '').trim();
  if (!key) return { ok: false, error: 'key_required' };
  const raw = await safeRedis('GET', [key], null);
  if (!raw) return { ok: false, error: 'not_found' };
  let record;
  try { record = JSON.parse(raw); } catch (_) { return { ok: false, error: 'parse_error' }; }
  const flat = readTrack(record) || {};
  const patch = {};
  if (body && body.bpm != null) {
    const n = Number(body.bpm);
    if (Number.isFinite(n) && n > 0) {
      patch.bpm = Math.round(n);
      patch.bpm_source = 'admin';
    }
  }
  if (body && body.camelot != null) {
    const text = String(body.camelot).trim().toUpperCase();
    if (/^(1[0-2]|[1-9])[AB]$/.test(text)) {
      patch.camelot = text;
      patch.key_source = 'admin';
    }
  }
  if (body && body.key_name != null) {
    patch.key_name = String(body.key_name).trim() || null;
    if (patch.key_name) patch.key_source = 'admin';
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
  patch.meta_status = 'admin';
  const merged = Object.assign({}, flat, patch, { savedAt: new Date().toISOString() });
  await safeRedis('SET', [key, JSON.stringify(merged)], null);
  return { ok: true, key, patch, track: merged };
}

/* Per-track enrich: refetch from Beatport by beatport_track_id and merge
 * the missing fields (sample_url, genre, etc) without touching admin values. */
async function enrichSingleTrack(body) {
  const key = String((body && body.key) || '').trim();
  if (!key) return { ok: false, error: 'key_required' };
  const raw = await safeRedis('GET', [key], null);
  if (!raw) return { ok: false, error: 'not_found' };
  let record;
  try { record = JSON.parse(raw); } catch (_) { return { ok: false, error: 'parse_error' }; }
  const flat = readTrack(record) || {};
  const tid = flat.beatport_track_id || flat.id;
  if (!tid) return { ok: false, error: 'no_beatport_id' };
  const fresh = await fetchBeatportTrack(tid);
  if (!fresh) return { ok: false, error: 'beatport_fetch_failed' };
  const mapped = mapTrack(fresh, 1, { artist: flat.artist_original, title: flat.title_original });
  if (!mapped) return { ok: false, error: 'beatport_map_failed' };
  /* Merge: keep admin-set BPM/Camelot, fill in anything missing. */
  const merged = Object.assign({}, mapped, flat);
  if (!flat.sample_url && mapped.sample_url) merged.sample_url = mapped.sample_url;
  if (!flat.sample_duration_ms && mapped.sample_duration_ms) merged.sample_duration_ms = mapped.sample_duration_ms;
  if (!flat.genre && mapped.genre) merged.genre = mapped.genre;
  if (!flat.sub_genre && mapped.sub_genre) merged.sub_genre = mapped.sub_genre;
  if (!flat.label && mapped.label) merged.label = mapped.label;
  if (!flat.beatport_url && mapped.beatport_url) merged.beatport_url = mapped.beatport_url;
  merged.savedAt = new Date().toISOString();
  await safeRedis('SET', [key, JSON.stringify(merged)], null);
  return { ok: true, key, track: merged };
}

/* ============================================================
   SEED BY GENRE — picks the best under-covered label from that family
   ============================================================ */
async function seedByGenre(body) {
  const family = String((body && body.genre_family) || '').trim();
  const limit = Math.max(1, Math.min(25, Number(body && body.limit) || 10));
  if (!family) return { ok: false, error: 'genre_family_required' };

  const config = loadCandidateLabelConfig().filter((l) =>
    l.enabled !== false && String(l.genre_family || '') === family && l.discogs_label_id
  );
  if (!config.length) return { ok: false, error: 'no_labels_for_family', genre_family: family };

  /* Pick label with the OLDEST last_run_at (or never run) so we round-robin. */
  let pick = null;
  let oldest = Infinity;
  for (const label of config) {
    const stateKey = seedLabelKey(label.discogs_label_id);
    const raw = await safeRedis('GET', [stateKey], null);
    let lastRun = 0;
    if (raw) {
      try { lastRun = Date.parse(JSON.parse(raw).last_run_at || '') || 0; } catch (_) {}
    }
    if (lastRun < oldest) { oldest = lastRun; pick = label; }
  }
  if (!pick) return { ok: false, error: 'no_label_pickable' };

  const result = await seedCandidates({
    label_id: pick.discogs_label_id,
    label_name: pick.name,
    genre_family: family,
    limit,
  });
  return Object.assign({}, result, {
    picked_label: { id: pick.discogs_label_id, name: pick.name, last_run_at_ms: oldest },
    genre_family: family,
  });
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
    if (body.action === 'list_candidates_paged') {
      const result = await listCandidatesPaged(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'enrich_candidate') {
      const result = await enrichSingleCandidate(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'list_candidate_labels') {
      const result = await listCandidateLabels();
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'list_tracks_paged') {
      const result = await listTracksPaged(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'update_track') {
      const result = await updateTrack(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'enrich_track') {
      const result = await enrichSingleTrack(body);
      send(res, result.ok ? 200 : 400, result);
      return;
    }
    if (body.action === 'seed_by_genre') {
      const result = await seedByGenre(body);
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
