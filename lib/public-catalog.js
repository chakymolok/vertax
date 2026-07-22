const {
  CANDIDATES_ALL_KEY,
  RELEASE_KEY_PREFIX,
} = require('./release-candidates');
const {
  readTrack,
  safeRedis,
  scanKeys,
  upsertDiscogsTrackCache,
} = require('./redis-cache');
const { enrichServerTrackMetadata } = require('./track-metadata');

const PUBLIC_RELEASE_SET_KEY = 'vertax:public:releases';
const PUBLIC_RELEASE_KEY_PREFIX = 'vertax:public:release:';
const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'Vertax/1.0 +https://vertax.live';
const TRACK_KEY_PATTERN = 'vertax:beatport:track:*';

function cleanString(value, maxLength) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, maxLength || 240) : null;
}

function cleanArray(value, maxLength) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  return list
    .map((item) => cleanString(item, maxLength || 120))
    .filter((item) => {
      const key = String(item || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function cleanCamelot(value) {
  const text = String(value || '').trim().toUpperCase();
  return /^(1[0-2]|[1-9])[AB]$/.test(text) ? text : null;
}

function cleanHttpUrl(value, maxLength) {
  const text = cleanString(value, maxLength || 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'release'
  );
}

function publicReleaseKey(discogsId) {
  return PUBLIC_RELEASE_KEY_PREFIX + String(discogsId);
}

function releaseSlug(release) {
  return [
    slugify(release && release.artist),
    slugify(release && release.title),
    String(release && release.discogs_id || ''),
  ].filter(Boolean).join('-');
}

function coverFromVinyl(vinyl) {
  const images = Array.isArray(vinyl && vinyl.images) ? vinyl.images : [];
  return cleanHttpUrl(
    vinyl && (
      vinyl.cover_url ||
      vinyl.coverUrl ||
      vinyl.cover ||
      vinyl.cover_image ||
      vinyl.thumb ||
      (images[0] && (images[0].uri || images[0].uri150))
    ),
    1000
  );
}

function artistFromVinyl(vinyl) {
  if (vinyl && vinyl.artist) return cleanString(vinyl.artist, 240);
  const artists = Array.isArray(vinyl && vinyl.artists) ? vinyl.artists : [];
  return cleanString(
    artists.map((artist) => artist && (artist.name || artist.anv)).filter(Boolean).join(', '),
    240
  );
}

function labelFromVinyl(vinyl) {
  if (vinyl && vinyl.label) return cleanString(vinyl.label, 160);
  const labels = Array.isArray(vinyl && vinyl.labels) ? vinyl.labels : [];
  return cleanString(labels[0] && labels[0].name, 160);
}

function catnoFromVinyl(vinyl) {
  if (vinyl && vinyl.catno) return cleanString(vinyl.catno, 100);
  const labels = Array.isArray(vinyl && vinyl.labels) ? vinyl.labels : [];
  return cleanString(labels[0] && labels[0].catno, 100);
}

function normalizePublicTrack(track, fallbackArtist) {
  const flat = readTrack(track) || track || {};
  const title = cleanString(flat.title_original || flat.title, 240);
  if (!title) return null;
  const bpm = cleanNumber(flat.bpm);
  const camelot = cleanCamelot(flat.camelot);
  return {
    position: cleanString(flat.discogs_position || flat.position, 40),
    artist: cleanString(flat.artist_original || flat.artist || fallbackArtist, 240),
    title,
    duration: cleanString(flat.duration, 40),
    bpm,
    camelot,
    genre: cleanString(flat.genre, 120),
    sub_genre: cleanString(flat.sub_genre, 120),
    source: cleanString(flat.source || flat.bpm_source || flat.key_source, 40),
    sources: cleanArray(flat.sources, 40),
    bpm_source: cleanString(flat.bpm_source, 40),
    key_source: cleanString(flat.key_source, 40),
    key_name: cleanString(flat.key_name || flat.key, 80),
    beatport_url: cleanHttpUrl(flat.beatport_url, 1000),
    metadata_checked_at: cleanString(flat.metadata_checked_at, 40),
    enriched: Boolean(bpm || camelot),
  };
}

function normalizePublicRelease(vinyl, tracks, options) {
  const release = vinyl || {};
  const discogsId = cleanString(
    release.discogs_id || release.discogsId || release.id,
    40
  );
  if (!discogsId || !/^\d+$/.test(discogsId)) return null;
  const artist = artistFromVinyl(release);
  const normalizedTracks = (Array.isArray(tracks) ? tracks : release.tracklist || release.tracks || [])
    .map((track) => normalizePublicTrack(track, artist))
    .filter(Boolean);
  const enrichedCount = normalizedTracks.filter((track) => track.enriched).length;
  const now = new Date().toISOString();
  return {
    discogs_id: discogsId,
    artist,
    title: cleanString(release.title, 240),
    label: labelFromVinyl(release),
    catalog_number: catnoFromVinyl(release),
    year: release.year ? String(release.year).slice(0, 4) : null,
    country: cleanString(release.country, 120),
    format: cleanString(release.format || release.formats && release.formats[0] && release.formats[0].name, 120),
    genres: cleanArray(release.genres || release.genre, 120),
    styles: cleanArray(release.styles || release.style, 120),
    cover_url: coverFromVinyl(release),
    discogs_url: cleanHttpUrl(release.discogs_url || release.uri, 1000)
      || 'https://www.discogs.com/release/' + discogsId,
    tracks: normalizedTracks,
    track_count: normalizedTracks.length,
    enriched_track_count: enrichedCount,
    metadata_coverage: normalizedTracks.length
      ? Math.round((enrichedCount / normalizedTracks.length) * 100) / 100
      : 0,
    ingested_from: cleanString(options && options.ingested_from, 80) || 'discogs_app',
    ingested_at: cleanString(options && options.ingested_at, 40) || now,
    updated_at: now,
  };
}

function parseRecord(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeTrackLists(primary, fallback, fallbackArtist) {
  const map = new Map();
  const order = [];
  function keyFor(track, index) {
    const position = String(track && track.position || '').trim().toLowerCase();
    if (position) return 'position:' + position;
    return [
      String(track && track.artist || fallbackArtist || '').trim().toLowerCase(),
      String(track && track.title || '').trim().toLowerCase(),
      index,
    ].join('|');
  }
  (fallback || []).forEach((track, index) => {
    const normalized = normalizePublicTrack(track, fallbackArtist);
    if (!normalized) return;
    const key = keyFor(normalized, index);
    map.set(key, normalized);
    order.push(key);
  });
  (primary || []).forEach((track, index) => {
    const normalized = normalizePublicTrack(track, fallbackArtist);
    if (!normalized) return;
    const key = keyFor(normalized, index);
    const previous = map.get(key) || {};
    map.set(key, Object.assign({}, previous, normalized));
    if (order.indexOf(key) < 0) order.push(key);
  });
  return order.map((key) => map.get(key)).filter(Boolean);
}

function mergeReleaseRecords(primary, fallback) {
  if (!primary && !fallback) return null;
  const base = fallback || {};
  const latest = primary || {};
  const merged = Object.assign({}, base, latest);
  [
    'artist',
    'title',
    'label',
    'catalog_number',
    'year',
    'country',
    'format',
    'cover_url',
    'discogs_url',
  ].forEach((field) => {
    if (!latest[field] && base[field]) merged[field] = base[field];
  });
  merged.genres = cleanArray([].concat(latest.genres || [], base.genres || []), 120);
  merged.styles = cleanArray([].concat(latest.styles || [], base.styles || []), 120);
  merged.tracks = mergeTrackLists(latest.tracks, base.tracks, merged.artist);
  merged.track_count = merged.tracks.length;
  merged.enriched_track_count = merged.tracks.filter((track) => track.enriched).length;
  merged.metadata_coverage = merged.track_count
    ? Math.round((merged.enriched_track_count / merged.track_count) * 100) / 100
    : 0;
  merged.slug = releaseSlug(merged);
  return merged;
}

async function getPublicRelease(discogsId) {
  const id = String(discogsId || '').trim();
  if (!/^\d+$/.test(id)) return null;
  const values = await safeRedis(
    'MGET',
    [publicReleaseKey(id), RELEASE_KEY_PREFIX + id],
    []
  );
  const publicRecord = parseRecord(values && values[0]);
  const candidateRecord = parseRecord(values && values[1]);
  return mergeReleaseRecords(publicRecord, candidateRecord);
}

async function savePublicRelease(release) {
  if (!release || !release.discogs_id) {
    return { ok: false, error: 'discogs_id_required' };
  }
  const id = String(release.discogs_id);
  const currentRaw = await safeRedis('GET', [publicReleaseKey(id)], null);
  const current = parseRecord(currentRaw);
  const record = mergeReleaseRecords(release, current);
  record.updated_at = new Date().toISOString();
  record.ingested_at = release.ingested_at || current && current.ingested_at || record.updated_at;
  await safeRedis('SET', [publicReleaseKey(id), JSON.stringify(record)], null);
  await safeRedis('SADD', [PUBLIC_RELEASE_SET_KEY, id], null);
  return { ok: true, created: !current, release: record };
}

async function savePublicReleaseFromVinyl(vinyl, tracks, options) {
  const release = normalizePublicRelease(vinyl, tracks, options);
  if (!release) return { ok: false, error: 'invalid_release' };
  return savePublicRelease(release);
}

async function listReleaseIds() {
  const sets = await Promise.all([
    safeRedis('SMEMBERS', [PUBLIC_RELEASE_SET_KEY], []),
    safeRedis('SMEMBERS', [CANDIDATES_ALL_KEY], []),
  ]);
  return Array.from(
    new Set([].concat(sets[0] || [], sets[1] || []).map(String).filter((id) => /^\d+$/.test(id)))
  );
}

async function loadReleaseBatch(ids) {
  const out = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const keys = [];
    chunk.forEach((id) => {
      keys.push(publicReleaseKey(id), RELEASE_KEY_PREFIX + id);
    });
    const values = await safeRedis('MGET', keys, []) || [];
    chunk.forEach((id, index) => {
      const publicRecord = parseRecord(values[index * 2]);
      const candidateRecord = parseRecord(values[index * 2 + 1]);
      const release = mergeReleaseRecords(publicRecord, candidateRecord);
      if (release) out.push(release);
    });
  }
  return out;
}

async function listPublicReleases(input) {
  const options = input || {};
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 24));
  const query = cleanString(options.q, 120);
  const queryLower = String(query || '').toLowerCase();
  const ids = await listReleaseIds();
  const releases = (await loadReleaseBatch(ids))
    .filter((release) => release && (release.artist || release.title))
    .filter((release) => {
      if (!queryLower) return true;
      return [
        release.artist,
        release.title,
        release.label,
        release.catalog_number,
        release.genres && release.genres.join(' '),
        release.styles && release.styles.join(' '),
      ].join(' ').toLowerCase().indexOf(queryLower) >= 0;
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.updated_at || a.ingested_at || '') || 0;
      const bTime = Date.parse(b.updated_at || b.ingested_at || '') || 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a.artist || '').localeCompare(String(b.artist || ''), 'ru');
    });
  const start = (page - 1) * limit;
  return {
    page,
    limit,
    q: query || '',
    total: releases.length,
    page_count: Math.max(1, Math.ceil(releases.length / limit)),
    releases: releases.slice(start, start + limit),
  };
}

async function listAllPublicReleases() {
  const ids = await listReleaseIds();
  return (await loadReleaseBatch(ids))
    .filter((release) => release.tracks && release.tracks.length)
    .sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || ''), 'en'));
}

function discogsToken() {
  return process.env.DISCOGS_TOKEN || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN || '';
}

async function fetchDiscogsRelease(discogsId) {
  const token = discogsToken();
  if (!token) {
    const error = new Error('discogs_token_missing');
    error.status = 503;
    throw error;
  }
  const url = new URL('/releases/' + encodeURIComponent(discogsId), DISCOGS_BASE);
  url.searchParams.set('token', token);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    const error = new Error('Discogs release failed: HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function mergeCachedTracksIntoDiscogs(release, cachedTracks) {
  const cached = (cachedTracks || [])
    .map((track) => normalizePublicTrack(track, artistFromVinyl(release)))
    .filter(Boolean);
  const tracks = mergeTrackLists(cached, release && release.tracklist || [], artistFromVinyl(release));
  return normalizePublicRelease(release, tracks, {
    ingested_from: 'track_cache_backfill',
  });
}

async function loadCachedReleaseGroups() {
  const keys = (await scanKeys(TRACK_KEY_PATTERN)).sort();
  const groups = new Map();

  for (let offset = 0; offset < keys.length; offset += 200) {
    const chunk = keys.slice(offset, offset + 200);
    const values = await safeRedis('MGET', chunk, []) || [];
    values.forEach((raw) => {
      const flat = readTrack(parseRecord(raw)) || {};
      const releaseId = String(flat.discogs_release_id || '').trim();
      if (!/^\d+$/.test(releaseId)) return;
      if (!groups.has(releaseId)) groups.set(releaseId, []);
      groups.get(releaseId).push(flat);
    });
  }

  return {
    track_keys_scanned: keys.length,
    groups,
  };
}

async function syncPublicCatalogBatch(input) {
  const options = input || {};
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 10));
  const missingOnly = options.missing_only === true;
  const loaded = await loadCachedReleaseGroups();
  const catalogIds = await listReleaseIds();
  const catalogReleases = await loadReleaseBatch(catalogIds);
  const hydratedIds = new Set(
    catalogReleases
      .filter((release) => release && release.tracks && release.tracks.length)
      .map((release) => String(release.discogs_id))
  );
  const allReleaseIds = Array.from(
    new Set([].concat(Array.from(loaded.groups.keys()), catalogIds))
  )
    .sort((a, b) => Number(a) - Number(b));
  const eligibleIds = missingOnly
    ? allReleaseIds.filter((id) => !hydratedIds.has(id))
    : allReleaseIds;
  const selected = eligibleIds.slice(offset, offset + limit);
  let updated = 0;
  let failed = 0;
  const errors = [];

  for (let index = 0; index < selected.length; index += 1) {
    const releaseId = selected[index];
    try {
      const discogs = await fetchDiscogsRelease(releaseId);
      const release = mergeCachedTracksIntoDiscogs(
        discogs,
        loaded.groups.get(releaseId) || []
      );
      if (!release) throw new Error('release_normalization_failed');
      const result = await savePublicRelease(release);
      if (!result || !result.ok) {
        throw new Error(result && result.error || 'catalog_save_failed');
      }
      updated += 1;
      console.log(
        '[catalog-sync]',
        offset + index + 1,
        '/',
        eligibleIds.length,
        release.artist,
        '—',
        release.title
      );
    } catch (error) {
      failed += 1;
      if (errors.length < 30) {
        errors.push({
          discogs_release_id: releaseId,
          error: error && error.message ? error.message : String(error),
        });
      }
    }
    if (index < selected.length - 1) await sleep(1100);
  }

  const nextOffset = offset + selected.length;
  const remaining = missingOnly
    ? Math.max(0, eligibleIds.length - updated)
    : Math.max(0, eligibleIds.length - nextOffset);
  return {
    ok: true,
    mode: missingOnly ? 'missing_only' : 'all',
    track_keys_scanned: loaded.track_keys_scanned,
    total: allReleaseIds.length,
    missing_before_sync: missingOnly ? eligibleIds.length : null,
    offset,
    limit,
    processed_in_batch: selected.length,
    updated,
    failed,
    remaining,
    next_offset: !missingOnly && nextOffset < eligibleIds.length ? nextOffset : null,
    has_more: remaining > 0,
    errors,
  };
}

async function enrichPublicCatalogTracksBatch(input) {
  const options = input || {};
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 8));
  const retryAfterMs = Math.max(
    60 * 60 * 1000,
    Number(options.retry_after_ms) || 7 * 24 * 60 * 60 * 1000
  );
  const deadlineAt = Number(options.deadline_at) || Date.now() + 32000;
  const ids = await listReleaseIds();
  const releases = await loadReleaseBatch(ids);
  const queue = [];
  releases.forEach((release) => {
    (release.tracks || []).forEach((track, trackIndex) => {
      if (track && track.bpm && track.camelot) return;
      const checkedAt = Date.parse(track && track.metadata_checked_at || '') || 0;
      if (checkedAt && Date.now() - checkedAt < retryAfterMs) return;
      queue.push({ release, track, trackIndex });
    });
  });

  let processed = 0;
  let enriched = 0;
  let partial = 0;
  let missed = 0;
  let failed = 0;
  const errors = [];
  const touched = new Map();

  for (const item of queue.slice(0, limit)) {
    if (Date.now() + 2500 >= deadlineAt) break;
    const release = item.release;
    const track = item.track;
    const checkedAt = new Date().toISOString();
    try {
      const metadata = await enrichServerTrackMetadata({
        artist: track.artist || release.artist,
        title: track.title,
        label: release.label,
        bpm: track.bpm,
        camelot: track.camelot,
        key_name: track.key_name,
        genre: track.genre || release.styles && release.styles[0] || release.genres && release.genres[0],
        sub_genre: track.sub_genre,
        source: track.source,
        sources: track.sources,
        bpm_source: track.bpm_source,
        key_source: track.key_source,
        deadlineAt,
      });
      const next = Object.assign({}, track, metadata || {}, {
        metadata_checked_at: checkedAt,
      });
      next.enriched = Boolean(next.bpm || next.camelot);
      release.tracks[item.trackIndex] = next;
      touched.set(String(release.discogs_id), release);
      processed += 1;
      if (next.bpm && next.camelot) enriched += 1;
      else if (next.bpm || next.camelot) partial += 1;
      else missed += 1;

      if (metadata) {
        await upsertDiscogsTrackCache({
          artist_original: next.artist || release.artist,
          title_original: next.title,
          label: release.label,
          bpm: next.bpm,
          camelot: next.camelot,
          key_name: next.key_name || null,
          bpm_source: next.bpm_source || (next.bpm ? next.source : null),
          key_source: next.key_source || (next.camelot ? next.source : null),
          meta_status: 'auto',
          source: next.source,
          sources: next.sources,
          genre: next.genre,
          sub_genre: next.sub_genre,
          beatport_url: next.beatport_url,
          duration: next.duration,
          discogs_release_id: release.discogs_id,
          discogs_position: next.position,
          discogs_label: release.label,
          discogs_catno: release.catalog_number,
          discogs_genres: release.genres,
          discogs_styles: release.styles,
        });
      }
    } catch (error) {
      failed += 1;
      track.metadata_checked_at = checkedAt;
      touched.set(String(release.discogs_id), release);
      errors.push({
        discogs_release_id: release.discogs_id,
        position: track.position || null,
        error: error && error.message ? error.message : String(error),
      });
    }
  }

  for (const release of touched.values()) {
    release.enriched_track_count = (release.tracks || []).filter(
      (track) => track && (track.bpm || track.camelot)
    ).length;
    release.metadata_coverage = release.tracks.length
      ? Math.round((release.enriched_track_count / release.tracks.length) * 100) / 100
      : 0;
    await savePublicRelease(release);
  }

  return {
    ok: true,
    queued_before_batch: queue.length,
    requested_limit: limit,
    processed,
    enriched,
    partial,
    missed,
    failed,
    remaining: Math.max(0, queue.length - processed),
    errors: errors.slice(0, 20),
  };
}

async function getPublicCatalogStats() {
  const loaded = await loadCachedReleaseGroups();
  const catalogIds = await listReleaseIds();
  const releases = await loadReleaseBatch(catalogIds);
  const allReleaseIds = new Set(
    [].concat(catalogIds, Array.from(loaded.groups.keys())).map(String)
  );
  const readyIds = new Set();
  let catalogTracks = 0;
  let enrichedTracks = 0;
  let completeTracks = 0;

  releases.forEach((release) => {
    const tracks = Array.isArray(release && release.tracks) ? release.tracks : [];
    if (tracks.length) readyIds.add(String(release.discogs_id));
    catalogTracks += tracks.length;
    enrichedTracks += tracks.filter((track) => track && (track.bpm || track.camelot)).length;
    completeTracks += tracks.filter((track) => track && track.bpm && track.camelot).length;
  });

  return {
    ok: true,
    unique_releases_total: allReleaseIds.size,
    catalog_pages_ready: readyIds.size,
    releases_waiting_for_discogs: Math.max(0, allReleaseIds.size - readyIds.size),
    track_cache_entries: loaded.track_keys_scanned,
    catalog_track_entries: catalogTracks,
    catalog_tracks_enriched: enrichedTracks,
    catalog_tracks_complete: completeTracks,
    catalog_tracks_waiting_for_metadata: Math.max(0, catalogTracks - completeTracks),
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  PUBLIC_RELEASE_SET_KEY,
  PUBLIC_RELEASE_KEY_PREFIX,
  slugify,
  releaseSlug,
  normalizePublicTrack,
  normalizePublicRelease,
  mergeReleaseRecords,
  getPublicRelease,
  savePublicRelease,
  savePublicReleaseFromVinyl,
  listPublicReleases,
  listAllPublicReleases,
  fetchDiscogsRelease,
  mergeCachedTracksIntoDiscogs,
  syncPublicCatalogBatch,
  enrichPublicCatalogTracksBatch,
  getPublicCatalogStats,
};
