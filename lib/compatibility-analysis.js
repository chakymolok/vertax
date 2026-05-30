const crypto = require('crypto');

const {
  makeBeatportCacheIdentity,
  getBeatportCache,
  setBeatportCache,
  upsertDiscogsTrackCache,
  safeRedis,
} = require('./redis-cache');

const { enrichTrackFromBeatport } = require('../api/beatport-lookup');

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'Vertax/1.0 +https://vertax.live';
const INDEX_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_COLLECTION_TRACKS = 5000;
const MAX_CANDIDATES = 8;
const MAX_RELEASE_TRACKS = 40;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё\s|.-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanString(value, maxLength) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  return text.slice(0, maxLength || 240);
}

function cleanBpm(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function cleanCamelot(value) {
  const text = String(value || '')
    .trim()
    .toUpperCase();
  return /^(1[0-2]|[1-9])[AB]$/.test(text) ? text : null;
}

function compactList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const text = cleanString(item, 80);
    const key = normalizeText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function firstGenre(value) {
  const list = compactList(value);
  return list[0] || null;
}

function stableTrackKey(track) {
  const releaseId = track.discogs_release_id || track.discogsId || track.discogsReleaseId;
  const position = cleanString(track.position || track.displayPosition, 40).toUpperCase();
  if (releaseId && position) return String(releaseId) + '|' + position;
  return [
    normalizeText(track.artist),
    normalizeText(track.title),
    cleanBpm(track.bpm) || '',
    cleanCamelot(track.camelot) || '',
  ].join('|');
}

function normalizedArtistTitle(track) {
  return [normalizeText(track.artist), normalizeText(track.title)].join('|');
}

function normalizeCollectionTrack(track, idx) {
  const artist = cleanString(track.artist || track.vinylArtist, 200);
  const title = cleanString(track.title, 240);
  if (!artist || !title) return null;
  const bpm = cleanBpm(track.bpm);
  const camelot = cleanCamelot(track.camelot);
  const genre = firstGenre(track.genre || track.style || track.genres || track.styles);
  const label = cleanString(track.label || track.vinylLabel || track.discogs_label, 180) || null;
  const releaseId = track.discogs_release_id || track.discogsId || track.discogsReleaseId || null;
  const position = cleanString(track.position || track.displayPosition, 40).toUpperCase() || null;
  return {
    id:
      cleanString(track.id, 160) ||
      crypto
        .createHash('sha1')
        .update(stableTrackKey(track) + '|' + idx)
        .digest('hex'),
    artist,
    title,
    mix: cleanString(track.mix, 160) || null,
    bpm,
    camelot,
    genre,
    label,
    record_title: cleanString(track.record_title || track.vinylTitle, 240) || null,
    discogs_release_id: releaseId,
    position,
    normalized_key: normalizedArtistTitle({ artist, title }),
  };
}

function normalizeCollectionPayload(collection) {
  const tracks = [];
  const recordIds = new Set();
  (Array.isArray(collection) ? collection : []).forEach((item, idx) => {
    if (Array.isArray(item && item.tracklist)) {
      const releaseId = item.discogsId || item.discogsReleaseId || item.discogs_release_id || null;
      const recordKey =
        releaseId || item.id || normalizeText((item.artist || '') + '|' + (item.title || ''));
      if (recordKey) recordIds.add(String(recordKey));
      item.tracklist.forEach((track, trackIdx) => {
        const normalized = normalizeCollectionTrack(
          {
            id: track.id,
            artist: track.artist || item.artist,
            title: track.title,
            mix: track.mix || track.mix_name,
            bpm: track.bpm,
            camelot: track.camelot,
            genre: track.genre || item.genre || item.style,
            style: track.style || item.style,
            label: track.label || item.label,
            record_title: item.title,
            vinylTitle: item.title,
            vinylArtist: item.artist,
            discogs_release_id: releaseId,
            position: track.position || track.displayPosition,
          },
          tracks.length + trackIdx
        );
        if (normalized) tracks.push(normalized);
      });
      return;
    }
    const normalized = normalizeCollectionTrack(item, idx);
    if (normalized) {
      tracks.push(normalized);
      if (normalized.discogs_release_id) recordIds.add(String(normalized.discogs_release_id));
    }
  });
  return { tracks, recordCount: recordIds.size || 0 };
}

function bpmBucket(bpm) {
  const n = cleanBpm(bpm);
  if (!n) return null;
  const start = Math.floor(n / 5) * 5;
  return start + '-' + (start + 5);
}

function genreFamily(genre) {
  const text = normalizeText(genre);
  if (!text) return null;
  const families = {
    dnb_jungle: ['drum bass', 'drum and bass', 'drum n bass', 'dnb', 'liquid funk'],
    jungle_fast_breaks: ['jungle', 'fast breaks'],
    fast_dnb_breakcore: ['fast dnb', 'breakcore'],
    hardcore_footwork: ['hardcore', 'gabber', 'speedcore'],
    footwork_juke: ['footwork', 'juke', 'teklife'],
    dubstep_grime_ukg: [
      'dubstep',
      '140',
      'deep dubstep',
      'grime',
      'uk garage',
      'ukg',
      '2 step',
      '2-step',
      'future garage',
      'bassline',
    ],
    electro_breaks: ['electro', 'breakbeat', 'breaks'],
    hiphop_trip_hop_breaks: ['hip hop', 'hip-hop', 'trip hop', 'trip-hop'],
    downtempo_halftime: ['downtempo', 'halftime', 'ambient'],
    disco_slow_house: ['disco', 'nu disco'],
    house_and_techno: ['house', 'deep house', 'techno', 'melodic house techno'],
    leftfield: ['idm', 'experimental', 'leftfield', 'abstract'],
    bass: ['uk bass', 'bass', 'club'],
    dub: ['dub'],
  };
  for (const family of Object.keys(families)) {
    if (
      families[family].some(
        (item) => text === normalizeText(item) || text.indexOf(normalizeText(item)) >= 0
      )
    ) {
      return family;
    }
  }
  return text;
}

function buildBuckets(tracks) {
  const buckets = { camelot: {}, bpm: {}, genre_family: {} };
  tracks.forEach((track, idx) => {
    if (track.camelot) {
      if (!buckets.camelot[track.camelot]) buckets.camelot[track.camelot] = [];
      buckets.camelot[track.camelot].push(idx);
    }
    const b = bpmBucket(track.bpm);
    if (b) {
      if (!buckets.bpm[b]) buckets.bpm[b] = [];
      buckets.bpm[b].push(idx);
    }
    const g = genreFamily(track.genre);
    if (g) {
      if (!buckets.genre_family[g]) buckets.genre_family[g] = [];
      buckets.genre_family[g].push(idx);
    }
  });
  return buckets;
}

function collectionIndexKey(userId, collectionHash) {
  return 'collection_index:' + userId + ':' + collectionHash;
}

function sanitizeUserId(value) {
  return cleanString(value, 160).replace(/[^a-z0-9_.:-]/gi, '_') || 'anonymous';
}

async function getCollectionIndex(userId, collectionHash) {
  const key = collectionIndexKey(sanitizeUserId(userId), cleanString(collectionHash, 160));
  const raw = await safeRedis('GET', [key], null);
  if (!raw) return null;
  await safeRedis('EXPIRE', [key, INDEX_TTL_SECONDS], null);
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function saveCollectionIndex(userId, collectionHash, collection) {
  const uid = sanitizeUserId(userId);
  const hash = cleanString(collectionHash, 160);
  const key = collectionIndexKey(uid, hash);
  const existing = await safeRedis('GET', [key], null);
  if (existing) {
    await safeRedis('EXPIRE', [key, INDEX_TTL_SECONDS], null);
    try {
      const parsed = JSON.parse(existing);
      return { status: 'already_exists', index: parsed };
    } catch (_) {}
  }
  const normalized = normalizeCollectionPayload(collection);
  if (normalized.tracks.length > MAX_COLLECTION_TRACKS) {
    const err = new Error('collection_too_large');
    err.status = 413;
    throw err;
  }
  const now = new Date().toISOString();
  const index = {
    user_id: uid,
    collection_hash: hash,
    created_at: now,
    updated_at: now,
    track_count: normalized.tracks.length,
    record_count: normalized.recordCount,
    tracks: normalized.tracks,
    buckets: buildBuckets(normalized.tracks),
  };
  await safeRedis('SET', [key, JSON.stringify(index), 'EX', INDEX_TTL_SECONDS], null);
  return { status: 'created', index };
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
    if (params[key] !== null && params[key] !== undefined && params[key] !== '')
      url.searchParams.set(key, params[key]);
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
    const err = new Error((data && data.message) || (data && data.error) || 'discogs_failed');
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

function isVinylResult(result) {
  const text = []
    .concat((result && result.format) || [])
    .concat((result && result.formats) || [])
    .join(' ')
    .toLowerCase();
  return !text || (text.indexOf('vinyl') >= 0 && text.indexOf('cd') < 0);
}

function mapCandidate(result) {
  const label = Array.isArray(result.label) ? result.label[0] : result.label;
  return {
    discogs_id: result.id,
    title: result.title || '',
    artist: result.title && result.title.indexOf(' - ') >= 0 ? result.title.split(' - ')[0] : '',
    cover_url: result.cover_image || result.thumb || '',
    label: label || '',
    year: result.year || null,
    country: result.country || '',
    format: Array.isArray(result.format) ? result.format.join(', ') : result.format || '',
    catalog_number: result.catno || '',
  };
}

async function searchDiscogsCandidates(query) {
  const data = await discogsJson('/database/search', {
    q: query,
    type: 'release',
    format: 'Vinyl',
    per_page: MAX_CANDIDATES,
  });
  return (data.results || []).filter(isVinylResult).slice(0, MAX_CANDIDATES).map(mapCandidate);
}

async function loadDiscogsRelease(releaseId) {
  return await discogsJson('/releases/' + encodeURIComponent(releaseId), {});
}

async function loadMarketplace(releaseId, release) {
  const lowest = release && release.lowest_price != null ? Number(release.lowest_price) : null;
  const num = release && release.num_for_sale != null ? Number(release.num_for_sale) : null;
  let suggested = null;
  try {
    const suggestions = await discogsJson(
      '/marketplace/price_suggestions/' + encodeURIComponent(releaseId),
      {}
    );
    const prices = Object.keys(suggestions || {})
      .map((key) =>
        suggestions[key] && suggestions[key].value != null ? Number(suggestions[key].value) : NaN
      )
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    if (prices.length) {
      const sum = prices.reduce((total, value) => total + value, 0);
      suggested = {
        average_price: Math.round((sum / prices.length) * 100) / 100,
        median_price: prices[Math.floor(prices.length / 2)],
        currency:
          (suggestions[Object.keys(suggestions)[0]] &&
            suggestions[Object.keys(suggestions)[0]].currency) ||
          'EUR',
        price_source: 'discogs_price_suggestions',
      };
    }
  } catch (_) {}
  if (Number.isFinite(lowest) || Number.isFinite(num)) {
    return {
      average_price: (suggested && suggested.average_price) || null,
      median_price: (suggested && suggested.median_price) || null,
      lowest_price: Number.isFinite(lowest) ? lowest : null,
      currency: (suggested && suggested.currency) || 'EUR',
      num_for_sale: Number.isFinite(num) ? num : null,
      price_source:
        (suggested && suggested.price_source) ||
        (Number.isFinite(lowest) ? 'discogs_lowest_price' : null),
    };
  }
  try {
    const stats = await discogsJson('/marketplace/stats/' + encodeURIComponent(releaseId), {});
    return {
      average_price: (suggested && suggested.average_price) || null,
      median_price: (suggested && suggested.median_price) || null,
      lowest_price:
        stats && stats.lowest_price && stats.lowest_price.value != null
          ? Number(stats.lowest_price.value)
          : null,
      currency:
        (suggested && suggested.currency) ||
        (stats && stats.lowest_price && stats.lowest_price.currency) ||
        null,
      num_for_sale: stats && stats.num_for_sale != null ? Number(stats.num_for_sale) : null,
      price_source:
        (suggested && suggested.price_source) ||
        (stats && stats.lowest_price ? 'discogs_marketplace_stats' : null),
    };
  } catch (_) {
    return {
      average_price: (suggested && suggested.average_price) || null,
      median_price: (suggested && suggested.median_price) || null,
      lowest_price: null,
      currency: (suggested && suggested.currency) || null,
      num_for_sale: null,
      price_source: (suggested && suggested.price_source) || null,
    };
  }
}

function releaseArtist(release) {
  const artists = ((release && release.artists) || [])
    .map((a) => String(a.name || '').replace(/\s\(\d+\)$/, ''))
    .filter(Boolean);
  return artists.join(' & ') || (release && release.artists_sort) || '';
}

function releaseLabel(release) {
  return (release && release.labels && release.labels[0] && release.labels[0].name) || '';
}

function releaseCatno(release) {
  return (release && release.labels && release.labels[0] && release.labels[0].catno) || '';
}

function releaseCoverUrl(release) {
  const images = Array.isArray(release && release.images) ? release.images : [];
  const primary = images.find((image) => image && image.type === 'primary') || images[0] || null;
  return (
    (primary && (primary.uri || primary.resource_url || primary.uri150)) ||
    (release && release.thumb) ||
    ''
  );
}

function releaseStyleOrGenre(release) {
  return firstGenre(release && release.styles) || firstGenre(release && release.genres);
}

function mapReleaseTrack(release, track, idx) {
  const title = cleanString(track && track.title, 240);
  if (!title) return null;
  return {
    id: crypto
      .createHash('sha1')
      .update(String(release.id || '') + '|' + (track.position || idx) + '|' + title)
      .digest('hex'),
    artist: releaseArtist(release),
    title,
    mix: null,
    duration: cleanString(track.duration, 40) || null,
    position: cleanString(track.position, 40).toUpperCase() || null,
    bpm: null,
    camelot: null,
    key: null,
    genre: releaseStyleOrGenre(release),
    enriched: false,
    source: null,
  };
}

function manualKeyFor(track) {
  return [track.position || '', normalizeText(track.artist), normalizeText(track.title)].join('|');
}

function manualMap(manualTracks) {
  const map = {};
  (Array.isArray(manualTracks) ? manualTracks : []).forEach((track) => {
    const normalized = {
      position: cleanString(track.position, 40).toUpperCase() || null,
      artist: cleanString(track.artist, 200),
      title: cleanString(track.title, 240),
      bpm: cleanBpm(track.bpm),
      camelot: cleanCamelot(track.camelot),
      key: cleanString(track.key, 80) || null,
      genre: firstGenre(track.genre),
    };
    if (!normalized.title || (!normalized.bpm && !normalized.camelot)) return;
    map[manualKeyFor(normalized)] = normalized;
  });
  return map;
}

async function enrichReleaseTrack(release, track, manual) {
  const manualHit = manual && manual[manualKeyFor(track)];
  if (manualHit && manualHit.bpm && manualHit.camelot) {
    const out = Object.assign({}, track, manualHit, { enriched: true, source: 'manual' });
    await upsertDiscogsTrackCache({
      artist_original: out.artist,
      title_original: out.title,
      label: releaseLabel(release),
      bpm: out.bpm,
      camelot: out.camelot,
      key_name: out.key || null,
      bpm_source: 'manual',
      key_source: 'manual',
      meta_status: 'manual',
      discogs_release_id: release.id,
      discogs_position: out.position,
      discogs_label: releaseLabel(release),
      discogs_catno: releaseCatno(release),
      discogs_genres: release.genres || [],
      discogs_styles: release.styles || [],
    });
    return out;
  }

  const identity = makeBeatportCacheIdentity(track.artist, track.title, releaseLabel(release));
  const cached = await getBeatportCache(identity);
  if (
    cached &&
    cached.body &&
    cached.body.matched !== false &&
    cached.body.bpm &&
    cached.body.camelot
  ) {
    return Object.assign({}, track, {
      bpm: cleanBpm(cached.body.bpm),
      camelot: cleanCamelot(cached.body.camelot),
      key: cached.body.key_name || null,
      genre: track.genre || cached.body.genre || cached.body.sub_genre || null,
      enriched: true,
      source: cached.type || 'redis',
      beatport_url: cached.body.beatport_url || null,
      sample_url: cached.body.sample_url || null,
      sample_duration_ms: cached.body.sample_duration_ms || null,
    });
  }

  try {
    const body = await enrichTrackFromBeatport(
      track.artist,
      track.title,
      '',
      releaseLabel(release)
    );
    await setBeatportCache(identity, body);
    if (body && body.matched !== false && body.bpm && body.camelot) {
      await upsertDiscogsTrackCache({
        artist_original: track.artist,
        title_original: track.title,
        label: releaseLabel(release),
        bpm: cleanBpm(body.bpm),
        camelot: cleanCamelot(body.camelot),
        key_name: body.key_name || null,
        bpm_source: 'beatport',
        key_source: 'beatport',
        meta_status: 'auto',
        confidence: body.confidence == null ? null : body.confidence,
        discogs_release_id: release.id,
        discogs_position: track.position,
        discogs_label: releaseLabel(release),
        discogs_catno: releaseCatno(release),
        discogs_genres: release.genres || [],
        discogs_styles: release.styles || [],
      });
      return Object.assign({}, track, {
        bpm: cleanBpm(body.bpm),
        camelot: cleanCamelot(body.camelot),
        key: body.key_name || null,
        genre: track.genre || body.genre || body.sub_genre || null,
        enriched: true,
        source: 'beatport',
        beatport_url: body.beatport_url || null,
        sample_url: body.sample_url || null,
        sample_duration_ms: body.sample_duration_ms || null,
      });
    }
  } catch (error) {
    console.warn('release track enrichment failed', error && error.message ? error.message : error);
  }
  return Object.assign({}, track, { enriched: false });
}

async function enrichReleaseTracks(release, manualTracks, options) {
  const manual = manualMap(manualTracks);
  const rawTracks = (release.tracklist || [])
    .filter(
      (track) => track && track.title && (track.position || track.type_ === 'track' || !track.type_)
    )
    .slice(0, MAX_RELEASE_TRACKS)
    .map((track, idx) => mapReleaseTrack(release, track, idx))
    .filter(Boolean);
  /* Soft deadline so analyze-release stays under Vercel's function timeout
   * even for big compilations. After the deadline we still emit a record for
   * every remaining track (so client UI is complete) but skip the expensive
   * Beatport network round-trip. They're flagged as not enriched and the
   * client can re-enrich them on-demand. */
  const deadlineMs =
    options && Number.isFinite(options.deadlineMs) ? options.deadlineMs : 45000;
  const deadlineAt = Date.now() + deadlineMs;
  const out = [];
  let exhausted = false;
  for (const track of rawTracks) {
    if (!exhausted && Date.now() < deadlineAt) {
      try {
        out.push(await enrichReleaseTrack(release, track, manual));
      } catch (error) {
        out.push(Object.assign({}, track, { enriched: false, source: 'error' }));
      }
    } else {
      exhausted = true;
      out.push(Object.assign({}, track, { enriched: false, source: 'skipped_deadline' }));
    }
  }
  return out;
}

function camelotParts(value) {
  const text = cleanCamelot(value);
  if (!text) return null;
  return { n: parseInt(text, 10), mode: text.slice(-1) };
}

function wrappedDiff(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function camelotCompatibility(a, b) {
  const x = camelotParts(a);
  const y = camelotParts(b);
  if (!x || !y) return { score: 0, reason: null };
  if (x.n === y.n && x.mode === y.mode)
    return { score: 1, reason: 'тот же Camelot ' + cleanCamelot(a) };
  if (x.mode === y.mode && wrappedDiff(x.n, y.n) === 1)
    return { score: 0.8, reason: 'соседний Camelot ' + cleanCamelot(b) };
  if (x.n === y.n && x.mode !== y.mode)
    return { score: 0.7, reason: 'смена лада ' + cleanCamelot(a) + ' → ' + cleanCamelot(b) };
  const boosted = ((x.n + 7 - 1) % 12) + 1;
  if (x.mode === y.mode && boosted === y.n)
    return { score: 0.5, reason: 'energy boost +7 по Camelot' };
  return { score: 0, reason: null };
}

function bpmCompatibility(a, b) {
  const x = cleanBpm(a);
  const y = cleanBpm(b);
  if (!x || !y) return { score: 0, reason: null };
  const pct = Math.abs(x - y) / Math.max(x, y);
  if (pct <= 0.03)
    return { score: 1, reason: 'BPM отличается на ' + Math.round(pct * 1000) / 10 + '%' };
  if (pct <= 0.06)
    return { score: 0.7, reason: 'BPM отличается на ' + Math.round(pct * 1000) / 10 + '%' };
  const ratios = [
    Math.abs(x * 2 - y) / Math.max(x * 2, y),
    Math.abs(x - y * 2) / Math.max(x, y * 2),
  ];
  const ratio = Math.min(ratios[0], ratios[1]);
  if (ratio <= 0.03) return { score: 0.6, reason: 'кратный BPM' };
  return { score: 0, reason: null };
}

function styleAffinity(a, b) {
  const fa = genreFamily(a);
  const fb = genreFamily(b);
  if (!fa || !fb) return { score: 1, reason: null };
  if (fa === fb) return { score: 1, reason: 'родственная ' + fa + '-семья' };
  return { score: 0.6, reason: 'разные жанровые семьи' };
}

function trackCompatibility(releaseTrack, collectionTrack) {
  const cam = camelotCompatibility(releaseTrack.camelot, collectionTrack.camelot);
  const bpm = bpmCompatibility(releaseTrack.bpm, collectionTrack.bpm);
  const style = styleAffinity(releaseTrack.genre, collectionTrack.genre);
  if (cam.score === 0 || bpm.score === 0) {
    return {
      score: 0,
      camelotScore: cam.score,
      bpmScore: bpm.score,
      styleAffinity: style.score,
      reasons: [],
    };
  }
  const score = cam.score * bpm.score * style.score;
  return {
    score: Math.round(score * 1000) / 1000,
    camelotScore: cam.score,
    bpmScore: bpm.score,
    styleAffinity: style.score,
    reasons: [cam.reason, bpm.reason, style.reason].filter(Boolean),
  };
}

function candidateCollectionTracks(index, track) {
  if (!index || !Array.isArray(index.tracks)) return [];
  if (index.tracks.length <= 2000) return index.tracks;
  const ids = new Set();
  const add = (bucket) => (bucket || []).forEach((idx) => ids.add(idx));
  if (index.buckets && index.buckets.camelot) add(index.buckets.camelot[track.camelot]);
  if (index.buckets && index.buckets.bpm) add(index.buckets.bpm[bpmBucket(track.bpm)]);
  const gf = genreFamily(track.genre);
  if (index.buckets && index.buckets.genre_family) add(index.buckets.genre_family[gf]);
  return ids.size
    ? Array.from(ids)
        .map((idx) => index.tracks[idx])
        .filter(Boolean)
    : index.tracks;
}

function analyzeMatches(releaseTracks, index) {
  const enrichedTracks = releaseTracks.filter(
    (track) => track.enriched && track.bpm && track.camelot
  );
  const matches = [];
  const unmatched = [];
  const densities = [];
  let tracksWithMatch = 0;

  enrichedTracks.forEach((track) => {
    const best = candidateCollectionTracks(index, track)
      .map((candidate) => {
        const compatibility = trackCompatibility(track, candidate);
        return { candidate, compatibility };
      })
      .filter((item) => item.compatibility.score > 0)
      .sort((a, b) => b.compatibility.score - a.compatibility.score)
      .slice(0, 3);
    const bestScore = best.length ? best[0].compatibility.score : 0;
    densities.push(bestScore);
    if (bestScore > 0.5) tracksWithMatch++;
    if (best.length) {
      matches.push({
        release_track: publicTrack(track),
        best_collection_matches: best.map((item) =>
          publicCollectionMatch(item.candidate, item.compatibility)
        ),
      });
    } else {
      unmatched.push(publicTrack(track));
    }
  });

  const harmonicOverlap = enrichedTracks.length ? tracksWithMatch / enrichedTracks.length : 0;
  const density = densities.length
    ? densities.reduce((sum, item) => sum + item, 0) / densities.length
    : 0;
  return { matches, unmatched, harmonicOverlap, density, enrichedCount: enrichedTracks.length };
}

function publicTrack(track) {
  return {
    title: track.title,
    artist: track.artist,
    position: track.position || null,
    bpm: track.bpm || null,
    camelot: track.camelot || null,
    key: track.key || null,
    genre: track.genre || null,
    enriched: !!track.enriched,
    source: track.source || null,
    sample_url: track.sample_url || null,
    beatport_url: track.beatport_url || null,
  };
}

function publicCollectionMatch(track, compatibility) {
  return {
    title: track.title,
    artist: track.artist,
    record_title: track.record_title || null,
    position: track.position || null,
    bpm: track.bpm || null,
    camelot: track.camelot || null,
    genre: track.genre || null,
    compatibility: compatibility.score,
    reasons: compatibility.reasons,
  };
}

function confidence(metadataCoverage, collectionSize, enrichedCount) {
  if (metadataCoverage >= 0.75 && collectionSize >= 100 && enrichedCount >= 3) return 'high';
  if (metadataCoverage >= 0.5 && collectionSize >= 30 && enrichedCount >= 2) return 'medium';
  return 'low';
}

function scaleLabel(score) {
  if (score < 30) return 'не вписывается в твою коллекцию';
  if (score < 55) return 'частично совместимо';
  if (score < 75) return 'хорошо ложится';
  return 'отличное дополнение';
}

function collectionProfile(index) {
  const tracks = Array.isArray(index && index.tracks) ? index.tracks : [];
  const genres = {};
  const families = {};
  const labels = {};
  const artists = {};
  const bpms = [];
  tracks.forEach((track) => {
    if (track.genre) genres[track.genre] = (genres[track.genre] || 0) + 1;
    if (track.label) labels[track.label] = (labels[track.label] || 0) + 1;
    if (track.artist) artists[track.artist] = (artists[track.artist] || 0) + 1;
    const family = genreFamily(track.genre);
    if (family) families[family] = (families[family] || 0) + 1;
    const bpm = cleanBpm(track.bpm);
    if (bpm) bpms.push(bpm);
  });
  const top = (obj, limit) =>
    Object.keys(obj)
      .map((key) => ({ name: key, count: obj[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 6);
  bpms.sort((a, b) => a - b);
  return {
    track_count: tracks.length,
    bpm_min: bpms.length ? bpms[0] : null,
    bpm_max: bpms.length ? bpms[bpms.length - 1] : null,
    bpm_median: bpms.length ? bpms[Math.floor(bpms.length / 2)] : null,
    top_genres: top(genres, 8),
    top_genre_families: top(families, 6),
    top_labels: top(labels, 10),
    top_artists: top(artists, 10),
  };
}

function recommendationLabel(score, conf, harmonicOverlap) {
  if (conf === 'low') return 'данных мало — не рекомендовать уверенно';
  if (score >= 75 && harmonicOverlap >= 0.3) return 'стоит рассмотреть к покупке';
  if (score >= 70 && harmonicOverlap >= 0.25) return 'можно рассмотреть к покупке';
  if (score >= 55) return 'только как специфический инструмент, не как очевидная покупка';
  return 'скорее пропустить для этой коллекции';
}

function autoSummary(result) {
  const score = result.scores.compatibility_score;
  const label = result.scores.scale_label;
  const total = result.release_track_count || 0;
  const enriched = result.breakdown.enriched_count || 0;
  const matched = result.breakdown.matched_track_count || 0;
  const bits = [];
  bits.push('Совместимость ' + score + '/100 — ' + label + '.');
  if (result.scores.confidence === 'low') {
    bits.push(
      'Оценка предварительная: BPM/Key найден только для ' + enriched + ' из ' + total + ' треков.'
    );
  } else {
    bits.push(matched + ' из ' + enriched + ' обогащённых треков релиза сочетаются с коллекцией.');
  }
  const top = result.matches && result.matches[0] && result.matches[0].best_collection_matches[0];
  if (top) {
    const rt = result.matches[0].release_track;
    bits.push(
      'Сильнейшее совпадение: ' +
        rt.title +
        ' (' +
        rt.camelot +
        ', ' +
        rt.bpm +
        ') ↔ ' +
        top.title +
        ' (' +
        top.camelot +
        ', ' +
        top.bpm +
        ').'
    );
  }
  if (result.release.rating) {
    bits.push(
      'Discogs: ' +
        result.release.rating +
        '/5' +
        (result.release.rating_count ? ' (' + result.release.rating_count + ' голосов)' : '') +
        '.'
    );
  }
  const market = result.release.marketplace || {};
  if (market.average_price || market.lowest_price || market.num_for_sale) {
    const price = market.average_price || market.lowest_price;
    bits.push(
      'Цена на Discogs: ' +
        (price
          ? (market.average_price ? 'примерно ' : 'от ') +
            price +
            (market.currency ? ' ' + market.currency : '')
          : 'цена неизвестна') +
        (market.num_for_sale ? ', ' + market.num_for_sale + ' в продаже' : '') +
        '.'
    );
  }
  return bits.join(' ');
}

async function analyzeReleaseAgainstIndex(options) {
  const release = options.release;
  const index = options.index;
  const marketplace = await loadMarketplace(release.id, release);
  /* Pass deadline down so enrichReleaseTracks can stop calling Beatport
   * before the Vercel function timeout hits. Default leaves a comfortable
   * margin for the rest of analyze + AI calls. */
  const enrichDeadlineMs = Number.isFinite(options.enrichment_deadline_ms)
    ? options.enrichment_deadline_ms
    : 45000;
  const releaseTracks = await enrichReleaseTracks(
    release,
    options.manual_tracks || [],
    { deadlineMs: enrichDeadlineMs }
  );
  const matchData = analyzeMatches(releaseTracks, index);
  const metadataCoverage = releaseTracks.length
    ? matchData.enrichedCount / releaseTracks.length
    : 0;
  const compatibilityScore = Math.round(
    100 * (0.65 * matchData.harmonicOverlap + 0.35 * matchData.density)
  );
  const rating =
    release && release.community && release.community.rating && release.community.rating.average
      ? Number(release.community.rating.average)
      : null;
  const ratingCount =
    release && release.community && release.community.rating && release.community.rating.count
      ? Number(release.community.rating.count)
      : null;
  const ratingNorm = rating ? rating / 5 : null;
  let purchaseScore = Math.round(
    100 * (0.8 * (compatibilityScore / 100) + 0.2 * (ratingNorm == null ? 0.5 : ratingNorm))
  );
  if (compatibilityScore < 55) purchaseScore = Math.min(purchaseScore, 45);
  else if (compatibilityScore < 70) purchaseScore = Math.min(purchaseScore, 59);
  const conf = confidence(metadataCoverage, index.track_count || 0, matchData.enrichedCount);
  const recommended =
    compatibilityScore >= 70 && matchData.harmonicOverlap >= 0.25 && conf !== 'low';
  const result = {
    release: {
      title: release.title || '',
      artist: releaseArtist(release),
      catalog_number: releaseCatno(release),
      discogs_id: release.id,
      cover_url: releaseCoverUrl(release),
      year: release.year || null,
      country: release.country || '',
      discogs_url: release.uri || '',
      format: (release.formats || [])
        .map((f) =>
          [f.name]
            .concat(f.descriptions || [])
            .filter(Boolean)
            .join(' ')
        )
        .filter(Boolean)
        .join(' / '),
      label: releaseLabel(release),
      genres: compactList(release.genres || []),
      styles: compactList(release.styles || []),
      notes: cleanString(release.notes, 900) || '',
      videos: (release.videos || [])
        .slice(0, 5)
        .map((video) => ({
          title: cleanString(video && video.title, 160),
          description: cleanString(video && video.description, 220),
        }))
        .filter((video) => video.title || video.description),
      rating,
      rating_count: ratingCount,
      marketplace,
    },
    scores: {
      compatibility_score: compatibilityScore,
      purchase_score: purchaseScore,
      scale_label: scaleLabel(compatibilityScore),
      recommended,
      confidence: conf,
      recommendation_label: recommendationLabel(
        compatibilityScore,
        conf,
        matchData.harmonicOverlap
      ),
    },
    breakdown: {
      harmonic_overlap: Math.round(matchData.harmonicOverlap * 100) / 100,
      collection_density: Math.round(matchData.density * 100) / 100,
      metadata_coverage: Math.round(metadataCoverage * 100) / 100,
      discogs_rating_norm: ratingNorm == null ? null : Math.round(ratingNorm * 100) / 100,
      enriched_count: matchData.enrichedCount,
      matched_track_count: matchData.matches.filter(
        (item) =>
          item.best_collection_matches &&
          item.best_collection_matches[0] &&
          item.best_collection_matches[0].compatibility > 0.5
      ).length,
      collection_track_count: index.track_count || 0,
    },
    collection_profile: collectionProfile(index),
    release_track_count: releaseTracks.length,
    matches: matchData.matches.slice(0, 24),
    unmatched_release_tracks: matchData.unmatched.slice(0, 24),
    tracks_not_enriched: releaseTracks
      .filter((track) => !track.enriched || !track.bpm || !track.camelot)
      .map(publicTrack),
  };
  result.auto_summary = autoSummary(result);
  return result;
}

module.exports = {
  INDEX_TTL_SECONDS,
  MAX_COLLECTION_TRACKS,
  normalizeCollectionPayload,
  saveCollectionIndex,
  getCollectionIndex,
  searchDiscogsCandidates,
  loadDiscogsRelease,
  analyzeReleaseAgainstIndex,
  trackCompatibility,
  collectionProfile,
  confidence,
  sanitizeUserId,
};
