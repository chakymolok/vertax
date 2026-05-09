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

  if (response.status === 429) {
    const err = new Error('Spotify rate limit');
    err.statusCode = 429;
    throw err;
  }
  if (!response.ok) {
    const err = new Error('Spotify API request failed');
    err.statusCode = 500;
    throw err;
  }

  return response.json();
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
    const query = `artist:${artist} track:${title}`;
    const searchUrl = `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
    const search = await spotifyFetch(searchUrl, token);
    const track = search && search.tracks && search.tracks.items && search.tracks.items[0];

    if (!track || !track.id) {
      sendJson(res, 200, { found: false });
      return;
    }

    const featuresUrl = `${SPOTIFY_API_BASE}/audio-features/${encodeURIComponent(track.id)}`;
    const features = await spotifyFetch(featuresUrl, token);

    if (!features || !features.tempo) {
      sendJson(res, 200, { found: false });
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
