const { getAccessToken } = require('./beatport-auth');

const API_BASE = 'https://api.beatport.com/v4';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const lookupCache = new Map();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 's-maxage=3600, stale-while-revalidate=86400' : 'no-store');
  res.end(JSON.stringify(body));
}

function normalize(value) {
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

function leadArtist(value) {
  return String(value || '').split(/\s*(?:,|&|\+|\bfeat\.?\b|\bft\.?\b|\bwith\b)\s*/i)[0].trim();
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a && !b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 5 && nb.indexOf(na) >= 0) return 0.92;
  if (nb.length >= 5 && na.indexOf(nb) >= 0) return 0.9;
  const max = Math.max(na.length, nb.length);
  return Math.max(0, 1 - levenshtein(na, nb) / max);
}

function titleCore(value) {
  return normalize(value)
    .replace(/\b(original|extended|radio|edit|remix|mix|version|vip|dub|remaster)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function names(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => item && item.name)
    .filter(Boolean)
    .join(', ');
}

function getLabel(track) {
  return track && track.release && track.release.label && track.release.label.name
    || track && track.label && track.label.name
    || '';
}

function getYear(track) {
  const date = track && (track.publish_date || track.new_release_date || track.release_date);
  return date ? String(date).slice(0, 4) : null;
}

function beatportUrl(track) {
  if (!track) return null;
  if (track.url) return /^https?:\/\//.test(track.url) ? track.url : 'https://www.beatport.com' + track.url;
  if (track.slug && track.id) return 'https://www.beatport.com/track/' + track.slug + '/' + track.id;
  return track.id ? 'https://www.beatport.com/track/' + track.id : null;
}

function scoreTrack(track, wanted) {
  const artistScore = similarity(leadArtist(wanted.artist), names(track.artists));
  const titleBits = [track.name, track.mix_name].filter(Boolean).join(' ');
  const wantedTitleCore = titleCore(wanted.title);
  const trackTitleCore = titleCore(track.name);
  const titleScore = Math.max(
    similarity(wanted.title, track.name),
    similarity(wanted.title, titleBits),
    similarity(wantedTitleCore, trackTitleCore)
  );
  let score = artistScore * 0.6 + titleScore * 0.4;
  if (wantedTitleCore && trackTitleCore && (trackTitleCore.indexOf(wantedTitleCore) >= 0 || wantedTitleCore.indexOf(trackTitleCore) >= 0)) {
    score += 0.06;
  }
  const wantedLabel = normalize(wanted.label);
  const trackLabel = normalize(getLabel(track));
  if (wantedLabel && trackLabel && (wantedLabel === trackLabel || trackLabel.indexOf(wantedLabel) >= 0 || wantedLabel.indexOf(trackLabel) >= 0)) {
    score += 0.08;
  }
  return Math.min(1, score);
}

function mapTrack(track, confidence) {
  const key = track && track.key || {};
  const genre = track && track.genre || {};
  const subGenre = track && track.sub_genre || {};
  return {
    matched: true,
    bpm: track && track.bpm ? Math.round(Number(track.bpm)) : null,
    camelot: key.camelot || null,
    key_name: key.name || null,
    genre: genre.name || null,
    sub_genre: subGenre.name || null,
    label: getLabel(track) || null,
    release_year: getYear(track),
    mix_name: track && track.mix_name || null,
    beatport_url: beatportUrl(track),
    confidence: Math.round(confidence * 100) / 100,
    source: 'beatport'
  };
}

function candidate(track, confidence) {
  return {
    artist: names(track.artists),
    title: track.name || '',
    mix_name: track.mix_name || null,
    label: getLabel(track) || null,
    bpm: track.bpm || null,
    camelot: track.key && track.key.camelot || null,
    beatport_url: beatportUrl(track),
    confidence: Math.round(confidence * 100) / 100
  };
}

function cleanQueryPart(value) {
  return String(value || '')
    .replace(/\([^)]*(feat|ft|with)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*(feat|ft|with)[^\]]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQueries(artist, title, label) {
  const a = cleanQueryPart(artist);
  const lead = cleanQueryPart(leadArtist(artist));
  const t = cleanQueryPart(title);
  const core = titleCore(title);
  const l = cleanQueryPart(label);
  const variants = [
    [a, t, l],
    [a, t],
    [lead, t],
    [t, a],
    [lead, core],
    [core, lead],
    [core, l],
    [core, a],
    [t],
    [core]
  ];
  const seen = {};
  return variants
    .map((parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
    .filter((query) => {
      const key = normalize(query);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
}

async function beatportSearchQuery(token, query) {
  const url = new URL(API_BASE + '/catalog/search/');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'tracks');
  url.searchParams.set('per_page', '10');
  url.searchParams.set('page', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json',
      'User-Agent': 'VERTAX-01'
    }
  });
  if (response.status === 429) {
    const err = new Error('Beatport rate limited');
    err.status = 429;
    throw err;
  }
  if (!response.ok) {
    const err = new Error('Beatport search failed: HTTP ' + response.status);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  if (Array.isArray(data.tracks)) return data.tracks;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

async function beatportSearch(token, artist, title, label) {
  const queries = buildQueries(artist, title, label);
  const out = [];
  const seen = {};
  for (const query of queries) {
    const tracks = await beatportSearchQuery(token, query);
    for (const track of tracks) {
      const id = track && track.id || beatportUrl(track) || JSON.stringify(track);
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(track);
    }
    if (out.length >= 12) break;
  }
  return out;
}

module.exports = async function beatportLookup(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, { message: 'Method not allowed' });
    return;
  }

  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();
  const label = String(req.query.label || '').trim();
  if (!artist || !title) {
    send(res, 400, { message: 'artist and title are required' });
    return;
  }

  const cacheKey = normalize(artist) + '|' + normalize(title) + '|' + normalize(label);
  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    send(res, 200, cached.body);
    return;
  }

  try {
    const token = await getAccessToken();
    const tracks = await beatportSearch(token, artist, title, label);
    const scored = tracks
      .map((track) => ({ track, score: scoreTrack(track, { artist, title, label }) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const body = best && best.score >= 0.75
      ? mapTrack(best.track, best.score)
      : { matched: false, candidates: scored.slice(0, 5).map((item) => candidate(item.track, item.score)) };
    lookupCache.set(cacheKey, { createdAt: Date.now(), body });
    send(res, 200, body);
  } catch (error) {
    const status = error && error.status === 429 ? 429 : 500;
    send(res, status, { message: error && error.message ? error.message : 'Beatport lookup failed' });
  }
};
