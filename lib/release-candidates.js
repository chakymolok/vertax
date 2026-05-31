const {
  makeBeatportCacheIdentity,
  getBeatportCache,
  setBeatportCache,
  readTrack,
  safeRedis,
  upsertDiscogsTrackCache,
} = require('./redis-cache');
const { enrichTrackFromBeatport } = require('../api/beatport-lookup');

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'Vertax/1.0 +https://vertax.live';
const RELEASE_KEY_PREFIX = 'vertax:release:';
const CANDIDATES_ALL_KEY = 'vertax:candidates:all';
const LABEL_INDEX_PREFIX = 'vertax:candidates:by_label:';
const GENRE_INDEX_PREFIX = 'vertax:candidates:by_genre_family:';
const CAMELOT_INDEX_PREFIX = 'vertax:candidates:by_camelot:';
const BPM_INDEX_PREFIX = 'vertax:candidates:by_bpm_bucket:';
const SEED_LABEL_SET_KEY = 'vertax:seed:labels';
const SEED_LABEL_PREFIX = 'vertax:seed:label:';

function cleanString(value, maxLength) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  return text ? text.slice(0, maxLength || 240) : null;
}

function compactList(value, maxLength) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const text = cleanString(item, maxLength || 120);
    const key = String(text || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function cleanCamelot(value) {
  const text = String(value || '')
    .trim()
    .toUpperCase();
  return /^(1[0-2]|[1-9])[AB]$/.test(text) ? text : null;
}

function slug(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'unknown'
  );
}

function bpmBucket(bpm) {
  const n = Number(bpm);
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n);
  const start = Math.floor(rounded / 5) * 5;
  return start + '-' + (start + 4);
}

function genreFamily(genre, subGenre, styles) {
  const haystack = [genre, subGenre]
    .concat(styles || [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    haystack.includes('drum and bass') ||
    haystack.includes('drum n bass') ||
    haystack.includes('drum & bass') ||
    haystack.includes('dnb') ||
    haystack.includes('liquid funk')
  )
    return 'dnb_jungle';

  if (haystack.includes('jungle') || haystack.includes('fast breaks')) return 'jungle_fast_breaks';

  if (haystack.includes('breakcore') || haystack.includes('fast dnb')) return 'fast_dnb_breakcore';

  if (
    haystack.includes('hardcore') ||
    haystack.includes('gabber') ||
    haystack.includes('speedcore')
  )
    return 'hardcore_footwork';

  if (haystack.includes('footwork') || haystack.includes('juke') || haystack.includes('teklife'))
    return 'footwork_juke';

  if (
    haystack.includes('uk garage') ||
    haystack.includes('ukg') ||
    haystack.includes('2-step') ||
    haystack.includes('2 step') ||
    haystack.includes('future garage') ||
    haystack.includes('dubstep') ||
    haystack.includes('deep dubstep') ||
    haystack.includes('grime') ||
    haystack.includes('140') ||
    haystack.includes('bassline')
  )
    return 'dubstep_grime_ukg';

  if (haystack.includes('electro') || haystack.includes('breakbeat') || haystack.includes('breaks'))
    return 'electro_breaks';

  if (haystack.includes('hip hop') || haystack.includes('hip-hop') || haystack.includes('trip hop'))
    return 'hiphop_trip_hop_breaks';

  if (
    haystack.includes('downtempo') ||
    haystack.includes('halftime') ||
    haystack.includes('ambient')
  )
    return 'downtempo_halftime';

  if (haystack.includes('disco') || haystack.includes('nu disco')) return 'disco_slow_house';

  if (
    haystack.includes('house') ||
    haystack.includes('techno') ||
    haystack.includes('melodic house')
  )
    return 'house_and_techno';

  if (
    haystack.includes('idm') ||
    haystack.includes('experimental') ||
    haystack.includes('leftfield') ||
    haystack.includes('abstract')
  )
    return 'leftfield';

  if (
    haystack.includes('drum') ||
    haystack.includes('uk bass') ||
    haystack.includes('garage') ||
    haystack.includes('bass / club')
  )
    return 'bass';

  return 'other';
}

function releaseKey(discogsId) {
  return RELEASE_KEY_PREFIX + String(discogsId);
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function indexKeysForRelease(release) {
  const labelSlug = release && release.label_slug;
  const index = (release && release.candidate_index) || {};
  return {
    labels: labelSlug ? [LABEL_INDEX_PREFIX + labelSlug] : [],
    genreFamilies: (index.genre_families || []).map((value) => GENRE_INDEX_PREFIX + value),
    camelot: (index.camelot || []).map((value) => CAMELOT_INDEX_PREFIX + value),
    bpm: (index.bpm_buckets || []).map((value) => BPM_INDEX_PREFIX + value),
  };
}

async function removeReleaseCandidateFromIndexes(release) {
  if (!release || !release.discogs_id) return;
  const id = String(release.discogs_id);
  const keys = indexKeysForRelease(release);
  const all = [].concat(keys.labels, keys.genreFamilies, keys.camelot, keys.bpm);
  for (const key of all) await safeRedis('SREM', [key, id], null);
}

async function indexReleaseCandidate(release) {
  if (!release || !release.discogs_id) return;
  const id = String(release.discogs_id);
  await safeRedis('SADD', [CANDIDATES_ALL_KEY, id], null);
  const keys = indexKeysForRelease(release);
  const all = [].concat(keys.labels, keys.genreFamilies, keys.camelot, keys.bpm);
  for (const key of all) await safeRedis('SADD', [key, id], null);
}

async function getReleaseCandidate(discogsId) {
  const raw = await safeRedis('GET', [releaseKey(discogsId)], null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function saveReleaseCandidate(release) {
  if (!release || !release.discogs_id) return { ok: false, error: 'discogs_id_required' };
  const previous = await getReleaseCandidate(release.discogs_id);
  if (previous) await removeReleaseCandidateFromIndexes(previous);
  const now = new Date().toISOString();
  const record = Object.assign({}, release, {
    updated_at: now,
    ingested_at: release.ingested_at || (previous && previous.ingested_at) || now,
  });
  await safeRedis('SET', [releaseKey(record.discogs_id), JSON.stringify(record)], null);
  await indexReleaseCandidate(record);
  return { ok: true, created: !previous, updated: !!previous, release: record };
}

async function deleteReleaseCandidate(discogsId) {
  const previous = await getReleaseCandidate(discogsId);
  if (previous) await removeReleaseCandidateFromIndexes(previous);
  await safeRedis('DEL', [releaseKey(discogsId)], null);
  await safeRedis('SREM', [CANDIDATES_ALL_KEY, String(discogsId)], null);
  return { ok: true, deleted: !!previous };
}

async function getCandidateIdsByGap(input) {
  const keys = [];
  const camelot = input && input.camelot ? cleanCamelot(input.camelot) : null;
  if (camelot) keys.push(CAMELOT_INDEX_PREFIX + camelot);
  if (input && input.bpm_bucket) keys.push(BPM_INDEX_PREFIX + String(input.bpm_bucket));
  if (input && input.genre_family) keys.push(GENRE_INDEX_PREFIX + String(input.genre_family));
  if (!keys.length) return [];
  if (keys.length === 1) return (await safeRedis('SMEMBERS', [keys[0]], [])) || [];
  return (await safeRedis('SINTER', keys, [])) || [];
}

function discogsToken() {
  return process.env.DISCOGS_TOKEN || process.env.DISCOGS_PERSONAL_ACCESS_TOKEN || '';
}

async function discogsJson(path, params) {
  const token = discogsToken();
  if (!token) {
    const err = new Error('discogs_token_missing');
    err.status = 503;
    throw err;
  }
  const url = new URL(path, DISCOGS_BASE);
  Object.keys(params || {}).forEach((key) => {
    if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
      url.searchParams.set(key, params[key]);
    }
  });
  url.searchParams.set('token', token);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { error: 'discogs_bad_json' };
  }
  if (!response.ok) {
    const err = new Error((data && (data.message || data.error)) || 'discogs_failed');
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

function artistNameList(artists) {
  return (Array.isArray(artists) ? artists : [])
    .map((artist) =>
      cleanString(String((artist && artist.name) || '').replace(/\s\(\d+\)$/, ''), 160)
    )
    .filter(Boolean);
}

function releaseArtist(release) {
  return (
    artistNameList(release && release.artists).join(' & ') ||
    cleanString(release && release.artists_sort, 240) ||
    ''
  );
}

function releaseLabel(release) {
  return (
    (release && release.labels && release.labels[0] && cleanString(release.labels[0].name, 180)) ||
    null
  );
}

function releaseCatno(release) {
  return (
    (release && release.labels && release.labels[0] && cleanString(release.labels[0].catno, 120)) ||
    null
  );
}

function releaseFormat(release) {
  return (
    ((release && release.formats) || [])
      .map((format) =>
        [format && format.name]
          .concat((format && format.descriptions) || [])
          .filter(Boolean)
          .join(' ')
      )
      .filter(Boolean)
      .join(' / ') || null
  );
}

function releaseCoverUrl(release) {
  const images = Array.isArray(release && release.images) ? release.images : [];
  const primary = images.find((image) => image && image.type === 'primary') || images[0] || null;
  return (
    (primary && (primary.uri || primary.resource_url || primary.uri150)) ||
    (release && release.thumb) ||
    null
  );
}

async function loadMarketplace(releaseId, release) {
  const lowest = cleanNumber(release && release.lowest_price);
  const numForSale = cleanNumber(release && release.num_for_sale);
  if (lowest === null && numForSale === null) {
    try {
      const stats = await discogsJson('/marketplace/stats/' + encodeURIComponent(releaseId), {});
      return {
        lowest_price: cleanNumber(stats && stats.lowest_price && stats.lowest_price.value),
        currency: (stats && stats.lowest_price && stats.lowest_price.currency) || null,
        num_for_sale: cleanNumber(stats && stats.num_for_sale),
        price_source: stats && stats.lowest_price ? 'discogs_marketplace_stats' : null,
      };
    } catch (_) {}
  }
  return {
    lowest_price: lowest,
    currency: lowest !== null ? 'EUR' : null,
    num_for_sale: numForSale,
    price_source: lowest !== null ? 'discogs_lowest_price' : null,
  };
}

function trackArtist(track, fallbackArtist) {
  const artists = artistNameList(track && track.artists);
  return artists.join(' & ') || fallbackArtist || '';
}

function normalizeTrackFromCache(track, source) {
  const flat = readTrack(track) || track || {};
  const bpm = cleanNumber(flat.bpm);
  const camelot = cleanCamelot(flat.camelot);
  return {
    bpm,
    camelot,
    key_name: cleanString(flat.key_name, 120),
    genre: cleanString(flat.genre, 120),
    sub_genre: cleanString(flat.sub_genre, 120),
    source: source || flat.source || 'redis_or_beatport',
    beatport_track_id: flat.beatport_track_id || flat.id || null,
    beatport_url: flat.beatport_url || flat.url || null,
    sample_url: flat.sample_url || null,
    sample_duration_ms: flat.sample_duration_ms || null,
    enriched: Boolean(bpm && camelot),
  };
}

async function enrichCandidateTrack(input) {
  const artist = cleanString(input.artist, 200);
  const title = cleanString(input.title, 240);
  const label = cleanString(input.label, 180);
  if (!artist || !title) return { enriched: false };

  const identity = makeBeatportCacheIdentity(artist, title, label);
  const cached = await getBeatportCache(identity);
  if (cached && cached.body && cached.body.matched !== false) {
    return normalizeTrackFromCache(cached.body, 'redis');
  }

  const mapped = await enrichTrackFromBeatport(artist, title, '', label);
  await setBeatportCache(identity, mapped);
  if (!mapped || mapped.matched === false) return { enriched: false, source: 'beatport' };
  return normalizeTrackFromCache(mapped, 'beatport');
}

async function enrichDiscogsTrack(track, release, seedSource) {
  const fallbackArtist = releaseArtist(release);
  const artist = trackArtist(track, fallbackArtist);
  const title = cleanString(track && track.title, 240);
  const label = releaseLabel(release);
  const base = {
    position: cleanString(track && track.position, 40),
    artist,
    title,
    duration: cleanString(track && track.duration, 40),
    enriched: false,
  };
  if (!title) return base;

  try {
    const meta = await enrichCandidateTrack({ artist, title, label });
    const out = Object.assign({}, base, meta, {
      enriched_at: meta.enriched ? new Date().toISOString() : null,
    });
    if (meta.enriched) {
      out.source = meta.source || 'redis_or_beatport';
      await upsertDiscogsTrackCache({
        artist_original: artist,
        title_original: title,
        label,
        bpm: meta.bpm,
        camelot: meta.camelot,
        key_name: meta.key_name || null,
        bpm_source: meta.source || 'beatport',
        key_source: meta.source || 'beatport',
        meta_status: 'auto',
        confidence: 1,
        duration: base.duration,
        discogs_release_id: release && release.id,
        discogs_position: base.position,
        discogs_label: label,
        discogs_catno: releaseCatno(release),
        discogs_genres: release.genres || [],
        discogs_styles: release.styles || [],
      });
    }
    return out;
  } catch (error) {
    return Object.assign({}, base, {
      enriched: false,
      enrichment_error: error && error.message ? error.message : String(error),
      source: (seedSource && seedSource.type) || 'manual_seed',
    });
  }
}

function buildCandidateIndex(release) {
  const enrichedTracks = (release.tracks || []).filter(
    (track) => track && track.enriched && track.bpm && track.camelot
  );
  const camelot = uniqueValues(enrichedTracks.map((track) => cleanCamelot(track.camelot)));
  const bpmBuckets = uniqueValues(enrichedTracks.map((track) => bpmBucket(track.bpm)));
  const family = genreFamily(release.genres && release.genres[0], null, release.styles || []);
  const trackFamilies = uniqueValues(
    enrichedTracks.map((track) => genreFamily(track.genre, track.sub_genre, release.styles || []))
  );
  return {
    camelot,
    bpm_buckets: bpmBuckets,
    genre_families: uniqueValues([family].concat(trackFamilies)),
  };
}

async function normalizeReleaseCandidate(rawDiscogsRelease, enrichedTracks, options) {
  const release = rawDiscogsRelease || {};
  const tracks = Array.isArray(enrichedTracks) ? enrichedTracks : [];
  const enrichedCount = tracks.filter(
    (track) => track && track.enriched && track.bpm && track.camelot
  ).length;
  const label = releaseLabel(release);
  const marketplaceRaw = await loadMarketplace(release.id, release);
  const now = new Date().toISOString();
  /* `refreshed_at` lets the 4B marketplace-refresh batch select oldest entries
   * without touching the top-level updated_at (which moves on any save). */
  const marketplace = marketplaceRaw
    ? Object.assign({}, marketplaceRaw, { refreshed_at: now })
    : { refreshed_at: now };
  const familyOverride = cleanString(options && options.genre_family_override, 80);
  const record = {
    discogs_id: Number(release.id),
    artist: releaseArtist(release),
    title: cleanString(release.title, 240),
    label,
    label_slug: slug(label),
    year: release.year || null,
    country: cleanString(release.country, 120),
    format: releaseFormat(release),
    catalog_number: releaseCatno(release),
    genres: compactList(release.genres, 120),
    styles: compactList(release.styles, 120),
    genre_family:
      familyOverride ||
      genreFamily(release.genres && release.genres[0], null, release.styles || []),
    rating: cleanNumber(
      release.community && release.community.rating && release.community.rating.average
    ),
    rating_count: cleanNumber(
      release.community && release.community.rating && release.community.rating.count
    ),
    marketplace,
    cover_url: releaseCoverUrl(release),
    discogs_url:
      release.uri || (release.id ? 'https://www.discogs.com/release/' + release.id : null),
    tracks,
    metadata_coverage: tracks.length ? Math.round((enrichedCount / tracks.length) * 100) / 100 : 0,
    track_count: tracks.length,
    enriched_track_count: enrichedCount,
    candidate_index: null,
    ingested_from: 'manual_seed',
    seed_source: (options && options.seed_source) || null,
    ingested_at: now,
    updated_at: now,
  };
  record.candidate_index = buildCandidateIndex(record);
  return record;
}

async function ingestReleaseCandidate(releaseId, options) {
  const raw = await discogsJson('/releases/' + encodeURIComponent(releaseId), {});
  /* Reject non-vinyl releases at ingest. Discogs label-listing fetches return
   * ALL formats by default — CD, file, cassette. We only want physical vinyl. */
  if (!(options && options.allow_non_vinyl) && !looksLikeVinylFormat(raw)) {
    return { ok: false, error: 'not_vinyl', discogs_id: releaseId };
  }
  const tracklist = (raw.tracklist || []).filter(
    (track) => track && track.title && (!track.type_ || track.type_ === 'track' || track.position)
  );
  const tracks = [];
  for (let i = 0; i < tracklist.length; i++) {
    tracks.push(await enrichDiscogsTrack(tracklist[i], raw, options && options.seed_source));
    if (i < tracklist.length - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const release = await normalizeReleaseCandidate(raw, tracks, options);
  return await saveReleaseCandidate(release);
}

/* STRICT vinyl-only filter for candidate ingest.
 * Discogs `formats` is an array of objects: { name, descriptions[], qty, ... }
 * We require an explicit `name === 'Vinyl'` (case-insensitive) on at least one
 * format entry. EP / Album / Single alone are NOT enough — they apply to CD too.
 * Falls back to text scan only when `formats` is missing (legacy items). */
function looksLikeVinylFormat(item) {
  if (!item) return false;
  const formats = Array.isArray(item.formats) ? item.formats : [];
  if (formats.length) {
    for (const fmt of formats) {
      const name = String((fmt && fmt.name) || '').trim().toLowerCase();
      if (name === 'vinyl') return true;
    }
    /* Has explicit formats but none are vinyl — reject (CD/File/Cassette/etc). */
    return false;
  }
  /* Legacy fallback: scan text fields for hard non-vinyl markers. */
  const text = [item.format, item.title].filter(Boolean).join(' ').toLowerCase();
  if (!text) return false;
  if (/\b(cd|file|flac|wav|mp3|cassette|cdr|dvd|digital)\b/.test(text)) return false;
  return /\b(vinyl|12"|lp)\b/.test(text);
}

async function fetchLabelReleaseIds(labelId, offset, limit) {
  const wanted = Math.max(1, Math.min(25, limit || 20));
  const target = offset + wanted;
  const collected = [];
  let page = 1;
  let total = null;
  let guard = 0;

  while (collected.length < target && guard < 20) {
    guard += 1;
    const data = await discogsJson('/labels/' + encodeURIComponent(labelId) + '/releases', {
      page,
      per_page: 100,
      sort: 'year',
      sort_order: 'desc',
    });
    total =
      data && data.pagination && data.pagination.items != null
        ? Number(data.pagination.items)
        : total;
    const releases = Array.isArray(data && data.releases) ? data.releases : [];
    releases
      .filter((item) => item && item.id && String(item.type || 'release') !== 'master')
      .filter(looksLikeVinylFormat)
      .sort(
        (a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(b.id || 0) - Number(a.id || 0)
      )
      .forEach((item) => collected.push(Number(item.id)));
    if (!data.pagination || !data.pagination.pages || page >= data.pagination.pages) break;
    page += 1;
  }

  const ids = collected.slice(offset, offset + wanted);
  return {
    ids,
    total: total == null ? collected.length : total,
    has_more: ids.length === wanted && (total == null || offset + wanted < total),
    next_offset: ids.length ? offset + ids.length : null,
  };
}

function seedLabelKey(labelId) {
  return SEED_LABEL_PREFIX + String(labelId);
}

async function getCandidateSeedState(labelId) {
  const raw = await safeRedis('GET', [seedLabelKey(labelId)], null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function updateCandidateSeedState(input, result) {
  if (!input || !input.label_id || !result || !result.ok) return null;
  const labelId = Number(input.label_id);
  if (!Number.isFinite(labelId) || labelId <= 0) return null;
  const previous = (await getCandidateSeedState(labelId)) || {};
  const now = new Date().toISOString();
  const nextOffset =
    result.next_offset == null || result.has_more === false
      ? 0
      : Math.max(0, Number(result.next_offset) || 0);
  const state = {
    label_id: labelId,
    label_name: cleanString(input.label_name || previous.label_name, 180),
    last_offset: nextOffset,
    last_run_at: now,
    last_success_at: result.failed ? previous.last_success_at || null : now,
    total_saved: (Number(previous.total_saved) || 0) + (Number(result.saved) || 0),
    total_updated: (Number(previous.total_updated) || 0) + (Number(result.updated) || 0),
    total_failed: (Number(previous.total_failed) || 0) + (Number(result.failed) || 0),
  };
  await safeRedis('SET', [seedLabelKey(labelId), JSON.stringify(state)], null);
  await safeRedis('SADD', [SEED_LABEL_SET_KEY, String(labelId)], null);
  return state;
}

async function candidateSeedStates() {
  const ids = (await safeRedis('SMEMBERS', [SEED_LABEL_SET_KEY], [])) || [];
  const labels = [];
  for (const id of ids) {
    const state = await getCandidateSeedState(id);
    if (state) labels.push(state);
  }
  labels.sort((a, b) => String(a.label_name || '').localeCompare(String(b.label_name || '')));
  return { ok: true, labels };
}

async function seedCandidates(input) {
  const limit = Math.max(1, Math.min(25, Number(input && input.limit) || 20));
  const offset = Math.max(0, Number(input && input.offset) || 0);
  let mode = 'release_ids';
  let ids = [];
  let total = 0;
  let hasMore = false;
  let nextOffset = null;
  let seedSource = null;

  if (Array.isArray(input && input.release_ids) && input.release_ids.length) {
    const allIds = input.release_ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    total = allIds.length;
    ids = allIds.slice(offset, offset + limit);
    hasMore = offset + ids.length < total;
    nextOffset = hasMore ? offset + ids.length : null;
    seedSource = { type: 'release_ids', value: ids.join(',') };
  } else if (input && input.label_id) {
    mode = 'label_id';
    const batch = await fetchLabelReleaseIds(input.label_id, offset, limit);
    ids = batch.ids;
    total = batch.total;
    hasMore = batch.has_more;
    nextOffset = batch.next_offset;
    seedSource = { type: 'label_id', value: String(input.label_id) };
  } else {
    return { ok: false, error: 'release_ids_or_label_id_required' };
  }

  let saved = 0;
  let updated = 0;
  let failed = 0;
  let skipped_non_vinyl = 0;
  const errors = [];
  for (const releaseId of ids) {
    try {
      const result = await ingestReleaseCandidate(releaseId, {
        seed_source: seedSource,
        genre_family_override: input && input.genre_family,
      });
      if (result.created) saved += 1;
      else if (result.updated) updated += 1;
      else if (result.error === 'not_vinyl') skipped_non_vinyl += 1;
    } catch (error) {
      failed += 1;
      if (errors.length < 30)
        errors.push({
          release_id: releaseId,
          error: error && error.message ? error.message : String(error),
        });
    }
  }

  const result = {
    ok: true,
    mode,
    total,
    offset,
    limit,
    processed_in_batch: ids.length,
    saved,
    updated,
    failed,
    skipped_non_vinyl,
    next_offset: nextOffset,
    has_more: Boolean(hasMore),
    errors,
  };
  const seedState = await updateCandidateSeedState(input, result);
  if (seedState) result.seed_state = seedState;
  return result;
}

async function candidateStats() {
  const ids = (await safeRedis('SMEMBERS', [CANDIDATES_ALL_KEY], [])) || [];
  const byGenre = {};
  const byCamelot = {};
  const byBpm = {};
  const labels = new Map();
  let coverageSum = 0;
  let coverageCount = 0;
  let withCover = 0;
  let withMarketplace = 0;

  for (const id of ids) {
    const release = await getReleaseCandidate(id);
    if (!release) continue;
    if (release.genre_family)
      byGenre[release.genre_family] = (byGenre[release.genre_family] || 0) + 1;
    if (release.label) labels.set(release.label, (labels.get(release.label) || 0) + 1);
    ((release.candidate_index && release.candidate_index.camelot) || []).forEach((value) => {
      byCamelot[value] = (byCamelot[value] || 0) + 1;
    });
    ((release.candidate_index && release.candidate_index.bpm_buckets) || []).forEach((value) => {
      byBpm[value] = (byBpm[value] || 0) + 1;
    });
    if (release.metadata_coverage != null) {
      coverageSum += Number(release.metadata_coverage) || 0;
      coverageCount += 1;
    }
    if (release.cover_url) withCover += 1;
    if (release.marketplace && release.marketplace.lowest_price != null) withMarketplace += 1;
  }

  return {
    ok: true,
    total_candidates: ids.length,
    by_genre_family: byGenre,
    by_label_top: Array.from(labels.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    by_camelot: byCamelot,
    by_bpm_bucket: byBpm,
    metadata: {
      avg_metadata_coverage: coverageCount
        ? Math.round((coverageSum / coverageCount) * 100) / 100
        : 0,
      with_cover: withCover,
      with_marketplace: withMarketplace,
    },
  };
}

async function exportCandidates(limit) {
  const ids = (await safeRedis('SMEMBERS', [CANDIDATES_ALL_KEY], [])) || [];
  const out = [];
  for (const id of ids.slice(0, Math.max(1, Math.min(10000, Number(limit) || 1000)))) {
    const release = await getReleaseCandidate(id);
    if (release) out.push(release);
  }
  return out;
}

/* ============================================================
   STAGE 4B: marketplace refresh batches
   ============================================================
   Picks N candidate releases whose marketplace data is missing or
   stale (older than `older_than_hours`, default 168 = 1 week), refetches
   marketplace stats from Discogs, writes back ONLY the `marketplace`
   field (keeps indexes untouched — marketplace doesn't affect them).

   Safe to call repeatedly. Designed for a weekly GitHub Action cron.
   Linear scan is OK while candidate count < ~5000. If catalogue grows
   much larger, replace with a Redis ZSET keyed by refresh timestamp.
   ============================================================ */
async function refreshMarketplaceBatch(input) {
  const limit = Math.max(1, Math.min(50, Number(input && input.limit) || 25));
  const olderThanHours = Math.max(
    0,
    Number(input && input.older_than_hours) || 24 * 7
  );
  const cutoffMs = Date.now() - olderThanHours * 3600 * 1000;
  /* Single-shot mode: bypass cutoff and refresh exactly one ID. Used by
   * the admin per-row "Обогатить" button. */
  const onlyId = input && input.only_id ? String(input.only_id) : null;
  if (onlyId) {
    const release = await getReleaseCandidate(onlyId);
    if (!release) return { ok: false, error: 'not_found', updated: 0, failed: 0 };
    try {
      const marketplace = (await loadMarketplace(release.discogs_id, {})) || {};
      release.marketplace = Object.assign({}, marketplace, {
        refreshed_at: new Date().toISOString(),
      });
      await saveReleaseCandidate(release);
      return { ok: true, updated: 1, failed: 0, only_id: onlyId };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : 'refresh_failed', updated: 0, failed: 1 };
    }
  }
  const allIds = (await safeRedis('SMEMBERS', [CANDIDATES_ALL_KEY], [])) || [];

  /* Gather all stale records before sorting. Redis SET order is arbitrary, so
   * sampling the first N ids can leave old marketplace data untouched forever
   * once the candidate catalogue grows. */
  const stale = [];
  const scanCap = allIds.length;
  for (let i = 0; i < scanCap; i++) {
    const id = allIds[i];
    const release = await getReleaseCandidate(id);
    if (!release) continue;
    const refreshedAt =
      release.marketplace && release.marketplace.refreshed_at
        ? Date.parse(release.marketplace.refreshed_at)
        : 0;
    if (!refreshedAt || refreshedAt < cutoffMs) {
      stale.push({ id, ts: refreshedAt });
    }
  }
  stale.sort((a, b) => a.ts - b.ts);
  const picks = stale.slice(0, limit);

  let refreshed = 0;
  let failed = 0;
  const errors = [];
  for (const pick of picks) {
    try {
      const release = await getReleaseCandidate(pick.id);
      if (!release) continue;
      const freshMarketplace = await loadMarketplace(pick.id, {});
      const now = new Date().toISOString();
      const updated = Object.assign({}, release, {
        marketplace: Object.assign({}, freshMarketplace, { refreshed_at: now }),
        updated_at: now,
      });
      /* Direct SET without re-indexing: marketplace fields don't affect
       * label/genre/camelot/bpm indexes. */
      await safeRedis('SET', [releaseKey(pick.id), JSON.stringify(updated)], null);
      refreshed += 1;
      /* Discogs token rate limit: 60 req/min → ~1.1s pause. */
      await new Promise((r) => setTimeout(r, 1100));
    } catch (error) {
      failed += 1;
      if (errors.length < 30)
        errors.push({
          release_id: pick.id,
          error: error && error.message ? error.message : String(error),
        });
    }
  }

  return {
    ok: true,
    catalog_size: allIds.length,
    scanned: scanCap,
    stale_found: stale.length,
    limit,
    older_than_hours: olderThanHours,
    refreshed,
    failed,
    errors,
  };
}

module.exports = {
  RELEASE_KEY_PREFIX,
  CANDIDATES_ALL_KEY,
  SEED_LABEL_PREFIX,
  seedLabelKey,
  bpmBucket,
  genreFamily,
  saveReleaseCandidate,
  getReleaseCandidate,
  deleteReleaseCandidate,
  indexReleaseCandidate,
  removeReleaseCandidateFromIndexes,
  getCandidateIdsByGap,
  normalizeReleaseCandidate,
  ingestReleaseCandidate,
  seedCandidates,
  candidateStats,
  candidateSeedStates,
  exportCandidates,
  refreshMarketplaceBatch,
  looksLikeVinylFormat,
};
