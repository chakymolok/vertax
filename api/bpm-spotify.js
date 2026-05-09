let cachedToken = null;
let tokenExpiresAt = 0;

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const SPOTIFY_KEY_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
];

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
  'G# major': '4B'
};

function setCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function convertSpotifyKey(key, mode) {
  if (key == null || key < 0 || key > 11) return null;
  const note = SPOTIFY_KEY_NAMES[key];
  const scale = mode === 0 ? 'minor' : 'major';
  return `${note} ${scale}`;
}

function getCamelot(key, mode) {
  const normalized = convertSpotifyKey(key, mode);
  return normalized ? KEY_TO_CAMELOT[normalized] || null : null;
}

async function getSpotifyToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const err = new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET env vars');
    err.statusCode = 500;
    throw err;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (response.status === 429) {
    const err = new Error('Spotify rate limit');
    err.statusCode = 429;
    throw err;
  }
  if (!response.ok) {
    const err = new Error('Spotify token request failed');
    err.statusCode = 500;
    throw err;
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000) - 60000;
  return cachedToken;
}

async function spotifyFetch(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (response.status === 429) {
    const err = new Error('Spotify rate limit');
    err.statusCode = 429;
    err.spotifyStatus = response.status;
    err.spotifyBody = data || text;
    throw err;
  }
  if (!response.ok) {
    const err = new Error('Spotify API request failed');
    err.statusCode = response.status === 403 ? 403 : 500;
    err.spotifyStatus = response.status;
    err.spotifyBody = data || text;
    throw err;
  }

  return data;
}

function cleanSearchPart(value) {
  return String(value || '')
    .replace(/\s*[\[(][^\])]+[\])]/g, ' ')
    .replace(/\b(original|remaster(?:ed)?|remix|mix|edit|version|vip)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mainArtist(value) {
  return String(value || '')
    .split(/\s*(?:,|&|\+|\bfeat\.?\b|\bft\.?\b|\bwith\b)\s*/i)[0]
    .trim();
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trackScore(track, artist, title) {
  if (!track) return 0;
  const wantedArtist = normalizeMatchText(mainArtist(artist));
  const wantedTitle = normalizeMatchText(cleanSearchPart(title) || title);
  const trackTitle = normalizeMatchText(track.name);
  const trackArtists = normalizeMatchText((track.artists || []).map((a) => a.name).join(' '));

  let score = 0;
  if (wantedArtist && trackArtists.indexOf(wantedArtist) >= 0) score += 2;
  if (wantedTitle && trackTitle.indexOf(wantedTitle) >= 0) score += 3;
  if (wantedTitle && wantedTitle.indexOf(trackTitle) >= 0) score += 1;
  return score;
}

function buildSpotifyQueries(artist, title) {
  const cleanArtist = cleanSearchPart(artist);
  const cleanTitle = cleanSearchPart(title);
  const leadArtist = mainArtist(cleanArtist || artist);
  const variants = [
    `artist:${artist} track:${title}`,
    `track:${title} artist:${artist}`,
    `${artist} ${title}`,
    `${cleanArtist} ${cleanTitle}`,
    `${leadArtist} ${cleanTitle || title}`
  ];

  return Array.from(new Set(variants.map((q) => q.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

async function findSpotifyTrack(token, artist, title) {
  const queries = buildSpotifyQueries(artist, title);
  let fallback = null;

  for (const query of queries) {
    const searchUrl = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
    const search = await spotifyFetch(searchUrl, token);
    const items = search && search.tracks && search.tracks.items ? search.tracks.items : [];
    if (!items.length) continue;

    if (!fallback) fallback = items[0];
    const ranked = items
      .map((track) => ({ track, score: trackScore(track, artist, title) }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score >= 4) return ranked[0].track;
  }

  return fallback;
}

function serializeSpotifyTrack(track) {
  if (!track) return null;
  return {
    id: track.id || null,
    name: track.name || '',
    artists: (track.artists || []).map((artist) => artist.name).filter(Boolean),
    album: track.album && track.album.name ? track.album.name : '',
    url: track.external_urls && track.external_urls.spotify ? track.external_urls.spotify : ''
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { message: 'Method not allowed' });
    return;
  }

  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();

  if (!artist || !title) {
    sendJson(res, 400, { message: 'artist and title are required' });
    return;
  }

  try {
    const token = await getSpotifyToken();
    const track = await findSpotifyTrack(token, artist, title);

    if (!track || !track.id) {
      sendJson(res, 200, { found: false });
      return;
    }

    const featuresUrl = `${SPOTIFY_API_BASE}/audio-features/${encodeURIComponent(track.id)}`;
    let features = null;
    try {
      features = await spotifyFetch(featuresUrl, token);
    } catch (err) {
      if (err && err.spotifyStatus === 403) {
        sendJson(res, 200, {
          found: false,
          trackFound: true,
          reason: 'audio-features-unavailable',
          message: 'Spotify found the track, but Audio Features are unavailable for this app',
          track: serializeSpotifyTrack(track)
        });
        return;
      }
      throw err;
    }

    if (!features || !features.tempo) {
      sendJson(res, 200, {
        found: false,
        trackFound: true,
        reason: 'audio-features-empty',
        track: serializeSpotifyTrack(track)
      });
      return;
    }

    sendJson(res, 200, {
      found: true,
      bpm: Math.round(features.tempo),
      key: convertSpotifyKey(features.key, features.mode),
      camelot: getCamelot(features.key, features.mode),
      source: 'spotify',
      confidence: features.tempo_confidence ?? null
    });
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : 500;
    sendJson(res, status, {
      message: err && err.message ? err.message : 'Spotify lookup failed'
    });
  }
};
