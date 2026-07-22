const { lookupBeatportMetadata } = require('../api/beatport-lookup');

const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
const ACOUSTICBRAINZ_BASE = 'https://acousticbrainz.org/api/v1';

const KEY_TO_CAMELOT = {
  'A minor': '8A',
  'A# minor': '3A',
  'B minor': '10A',
  'C minor': '5A',
  'C# minor': '12A',
  'D minor': '7A',
  'D# minor': '2A',
  'E minor': '9A',
  'F minor': '4A',
  'F# minor': '11A',
  'G minor': '6A',
  'G# minor': '1A',
  'A major': '11B',
  'A# major': '6B',
  'B major': '1B',
  'C major': '8B',
  'C# major': '3B',
  'D major': '10B',
  'D# major': '5B',
  'E major': '12B',
  'F major': '7B',
  'F# major': '2B',
  'G major': '9B',
  'G# major': '4B',
};

const FLAT_TO_SHARP = {
  Ab: 'G#',
  Bb: 'A#',
  Cb: 'B',
  Db: 'C#',
  Eb: 'D#',
  Fb: 'E',
  Gb: 'F#',
};

const HALFTIME_GENRES = [
  'drum & bass',
  'jungle',
  'footwork',
  'footwork / juke',
  'juke / footwork',
];
const HALFTIME_SUB_GENRES = ['jungle', 'footwork', 'halftime'];

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeGenre(value) {
  return cleanText(value).toLowerCase();
}

function normalizeBpm(bpm, genre, subGenre) {
  const value = Number(bpm);
  if (!Number.isFinite(value) || value <= 0) return null;
  const normalized = Math.round(value);
  const halftime =
    HALFTIME_GENRES.includes(normalizeGenre(genre)) ||
    HALFTIME_SUB_GENRES.includes(normalizeGenre(subGenre));
  return halftime && normalized < 100 ? normalized * 2 : normalized;
}

function normalizeKeyName(value) {
  let key = cleanText(value)
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\bmaj(?:or)?\.?\b/gi, 'major')
    .replace(/\bmin(?:or)?\.?\b/gi, 'minor')
    .replace(/\s*sharp\b/gi, '#')
    .replace(/\s*flat\b/gi, 'b');
  const parts = key.split(' ');
  if (parts[0] && FLAT_TO_SHARP[parts[0]]) {
    parts[0] = FLAT_TO_SHARP[parts[0]];
    key = parts.join(' ');
  }
  if (/^[A-G][#b]?$/.test(key)) key += ' major';
  const canonical = Object.keys(KEY_TO_CAMELOT).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );
  return canonical || null;
}

function cleanCamelot(value) {
  const text = cleanText(value).toUpperCase();
  return /^(1[0-2]|[1-9])[AB]$/.test(text) ? text : null;
}

function combineMetadata(base, incoming) {
  const current = base || {};
  const next = incoming || {};
  const sources = Array.from(
    new Set([].concat(current.sources || current.source || [], next.sources || next.source || []))
  ).filter(Boolean);
  return {
    bpm: current.bpm || next.bpm || null,
    camelot: current.camelot || next.camelot || null,
    key_name: current.key_name || next.key_name || null,
    bpm_source: current.bpm
      ? current.bpm_source || current.source || null
      : next.bpm
        ? next.bpm_source || next.source || null
        : null,
    key_source: current.camelot || current.key_name
      ? current.key_source || current.source || null
      : next.camelot || next.key_name
        ? next.key_source || next.source || null
        : null,
    genre: current.genre || next.genre || null,
    sub_genre: current.sub_genre || next.sub_genre || null,
    beatport_url: current.beatport_url || next.beatport_url || null,
    source: sources[0] || null,
    sources,
  };
}

function metadataComplete(meta) {
  return Boolean(meta && meta.bpm && meta.camelot);
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 4500);
  try {
    const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseGetSongBpm(data, genre, subGenre) {
  const song =
    data && Array.isArray(data.search) && data.search.length
      ? data.search[0]
      : data && data.song
        ? data.song
        : null;
  if (!song) return null;
  const rawKey = song.key_of || song.key || song.camelot;
  const camelot = cleanCamelot(rawKey);
  const keyName = camelot ? null : normalizeKeyName(rawKey);
  const out = {
    bpm: normalizeBpm(song.tempo || song.bpm, genre, subGenre),
    camelot: camelot || (keyName && KEY_TO_CAMELOT[keyName]) || null,
    key_name: keyName,
    source: 'getsongbpm',
  };
  return out.bpm || out.camelot ? out : null;
}

async function fetchGetSongBpm(artist, title, genre, subGenre) {
  const key = process.env.GETSONGBPM_KEY || '';
  if (!key) return null;
  const lookup =
    'song:' + cleanText(title).replace(/[^\w\s]/g, '').toLowerCase() +
    '+artist:' + cleanText(artist).replace(/[^\w\s]/g, '').toLowerCase();
  const url = new URL('/search/', 'https://api.getsong.co');
  url.searchParams.set('api_key', key);
  url.searchParams.set('type', 'both');
  url.searchParams.set('lookup', lookup);
  return parseGetSongBpm(await fetchJson(url, { headers: { Accept: 'application/json' } }), genre, subGenre);
}

async function fetchAcousticBrainz(artist, title, genre, subGenre) {
  const query =
    'artist:"' + cleanText(artist).replace(/"/g, '') +
    '" AND recording:"' + cleanText(title).replace(/"/g, '') + '"';
  const search = new URL('/recording/', MUSICBRAINZ_BASE);
  search.searchParams.set('query', query);
  search.searchParams.set('fmt', 'json');
  search.searchParams.set('limit', '1');
  const mb = await fetchJson(search, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Vertax/1.0 +https://vertax.live',
    },
  });
  const mbid = mb && mb.recordings && mb.recordings[0] && mb.recordings[0].id;
  if (!mbid) return null;
  const data = await fetchJson(
    ACOUSTICBRAINZ_BASE + '/' + encodeURIComponent(mbid) + '/low-level',
    {},
    5000
  );
  if (!data || !data.rhythm || !data.tonal) return null;
  const keyName = normalizeKeyName(
    [data.tonal.key_key, data.tonal.key_scale].filter(Boolean).join(' ')
  );
  const out = {
    bpm: normalizeBpm(data.rhythm.bpm, genre, subGenre),
    camelot: keyName ? KEY_TO_CAMELOT[keyName] : null,
    key_name: keyName,
    source: 'acousticbrainz',
  };
  return out.bpm || out.camelot ? out : null;
}

function normalizeSearchText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s*[\[(][^\])]+[\])]/g, ' ')
    .replace(/\b(original|remaster(?:ed)?|remix|mix|edit|version|vip)\b/gi, ' ')
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deezerScore(track, artist, title) {
  const wantedArtist = normalizeSearchText(String(artist || '').split(/\s*(?:,|&|\+|feat\.?|ft\.?)\s*/i)[0]);
  const wantedTitle = normalizeSearchText(title);
  const foundArtist = normalizeSearchText(track && track.artist && track.artist.name);
  const foundTitle = normalizeSearchText(track && (track.title || track.title_short));
  let score = 0;
  if (wantedArtist && foundArtist.includes(wantedArtist)) score += 2;
  if (
    wantedTitle &&
    (wantedTitle === foundTitle ||
      (wantedTitle.length >= 6 && foundTitle.includes(wantedTitle)) ||
      (foundTitle.length >= 6 && wantedTitle.includes(foundTitle)))
  ) score += 3;
  return score;
}

async function fetchDeezer(artist, title, genre, subGenre) {
  const query = 'artist:"' + cleanText(artist) + '" track:"' + cleanText(title) + '"';
  const searchUrl = new URL('/search', 'https://api.deezer.com');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('limit', '5');
  const search = await fetchJson(searchUrl);
  const tracks = search && Array.isArray(search.data) ? search.data : [];
  tracks.sort((a, b) => deezerScore(b, artist, title) - deezerScore(a, artist, title));
  if (!tracks[0] || deezerScore(tracks[0], artist, title) < 4) return null;
  const data = await fetchJson(
    'https://api.deezer.com/track/' + encodeURIComponent(tracks[0].id)
  );
  const bpm = normalizeBpm(data && data.bpm, genre, subGenre);
  return bpm ? { bpm, camelot: null, key_name: null, source: 'deezer' } : null;
}

async function enrichServerTrackMetadata(input) {
  const track = input || {};
  const artist = cleanText(track.artist);
  const title = cleanText(track.title);
  if (!artist || !title) return null;
  let result = {
    bpm: Number(track.bpm) || null,
    camelot: cleanCamelot(track.camelot),
    key_name: track.key_name || track.key || null,
    genre: track.genre || null,
    sub_genre: track.sub_genre || null,
    source: track.source || null,
    sources: track.sources || [],
    bpm_source: track.bpm_source || null,
    key_source: track.key_source || null,
  };
  const deadlineAt = Number(track.deadlineAt) || Date.now() + 12000;
  const hasTime = (reserve) => Date.now() + (reserve || 1000) < deadlineAt;

  if (!metadataComplete(result) && hasTime(5000)) {
    try {
      const beatport = await lookupBeatportMetadata(artist, title, track.label || '');
      if (beatport && beatport.matched !== false) {
        result = combineMetadata(result, {
          bpm: normalizeBpm(beatport.bpm, beatport.genre, beatport.sub_genre),
          camelot: cleanCamelot(beatport.camelot),
          key_name: beatport.key_name || null,
          genre: beatport.genre || null,
          sub_genre: beatport.sub_genre || null,
          beatport_url: beatport.beatport_url || null,
          source: 'beatport',
        });
      }
    } catch (error) {
      console.warn('[catalog-enrich] Beatport:', artist, '—', title, error.message);
    }
  }
  if (!metadataComplete(result) && hasTime(3500)) {
    try {
      result = combineMetadata(
        result,
        await fetchGetSongBpm(artist, title, result.genre || track.genre, result.sub_genre)
      );
    } catch (error) {
      console.warn('[catalog-enrich] GetSongBPM:', artist, '—', title, error.message);
    }
  }
  if (!metadataComplete(result) && hasTime(6000)) {
    try {
      result = combineMetadata(
        result,
        await fetchAcousticBrainz(artist, title, result.genre || track.genre, result.sub_genre)
      );
    } catch (error) {
      console.warn('[catalog-enrich] AcousticBrainz:', artist, '—', title, error.message);
    }
  }
  if (!result.bpm && hasTime(3500)) {
    try {
      result = combineMetadata(
        result,
        await fetchDeezer(artist, title, result.genre || track.genre, result.sub_genre)
      );
    } catch (error) {
      console.warn('[catalog-enrich] Deezer:', artist, '—', title, error.message);
    }
  }
  return result.bpm || result.camelot ? result : null;
}

module.exports = {
  KEY_TO_CAMELOT,
  normalizeBpm,
  normalizeKeyName,
  enrichServerTrackMetadata,
};
