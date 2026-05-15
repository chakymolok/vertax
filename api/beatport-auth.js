const API_BASE = 'https://api.beatport.com/v4';
const REDIRECT_URI = API_BASE + '/auth/o/post-message/';
const TOKEN_BUFFER_MS = 30 * 1000;

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedRefreshToken = null;
let cachedClientId = null;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function getSetCookie(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const one = headers.get && headers.get('set-cookie');
  return one ? [one] : [];
}

function mergeCookies(existing, headers) {
  const jar = Object.assign({}, existing || {});
  getSetCookie(headers).forEach((raw) => {
    String(raw || '').split(/,(?=[^;,]+=)/).forEach((part) => {
      const first = part.split(';')[0];
      const idx = first.indexOf('=');
      if (idx > 0) jar[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
    });
  });
  return jar;
}

function cookieHeader(jar) {
  return Object.keys(jar || {}).map((key) => key + '=' + jar[key]).join('; ');
}

async function fetchBeatportClientId() {
  if (process.env.BEATPORT_CLIENT_ID) return process.env.BEATPORT_CLIENT_ID;
  if (cachedClientId) return cachedClientId;

  const docs = await fetch(API_BASE + '/docs/', {
    headers: { 'User-Agent': 'VERTAX-01' }
  });
  if (!docs.ok) throw new Error('Could not load Beatport docs');
  const html = await docs.text();
  const scripts = Array.from(html.matchAll(/src=["']([^"']+\.js[^"']*)["']/gi))
    .map((m) => m[1])
    .filter(Boolean);

  for (const src of scripts) {
    const url = src.startsWith('http') ? src : 'https://api.beatport.com' + src;
    try {
      const script = await fetch(url, { headers: { 'User-Agent': 'VERTAX-01' } });
      if (!script.ok) continue;
      const js = await script.text();
      const match = js.match(/API_CLIENT_ID:\s*['"]([^'"]+)['"]/);
      if (match && match[1]) {
        cachedClientId = match[1];
        return cachedClientId;
      }
    } catch (_) {}
  }

  throw new Error('Could not fetch Beatport client_id');
}

async function refreshAccessToken(clientId) {
  if (!cachedRefreshToken) return null;
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', cachedRefreshToken);
  params.set('client_id', clientId);

  const response = await fetch(API_BASE + '/auth/o/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'VERTAX-01'
    },
    body: params
  });
  if (!response.ok) return null;
  return response.json();
}

async function authorizeWithPasswordGrant(clientId) {
  const username = process.env.BEATPORT_USERNAME;
  const password = process.env.BEATPORT_PASSWORD;
  if (!username || !password) {
    throw new Error('Missing BEATPORT_USERNAME or BEATPORT_PASSWORD env vars');
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'password');
  params.set('username', username);
  params.set('password', password);
  params.set('client_id', clientId);

  const response = await fetch(API_BASE + '/auth/o/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'VERTAX-01'
    },
    body: params
  });
  if (!response.ok) return null;
  return response.json();
}

async function authorizeWithPassword(clientId) {
  const username = process.env.BEATPORT_USERNAME;
  const password = process.env.BEATPORT_PASSWORD;
  if (!username || !password) {
    throw new Error('Missing BEATPORT_USERNAME or BEATPORT_PASSWORD env vars');
  }

  let jar = {};
  const login = await fetch(API_BASE + '/auth/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'VERTAX-01'
    },
    body: JSON.stringify({ username, password })
  });
  jar = mergeCookies(jar, login.headers);
  if (!login.ok) throw new Error('Beatport login failed: HTTP ' + login.status);
  const loginData = await login.json().catch(() => ({}));
  if (!loginData || (!loginData.username && !loginData.email)) {
    throw new Error('Beatport login failed');
  }

  const authUrl = new URL(API_BASE + '/auth/o/authorize/');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

  const authorize = await fetch(authUrl.toString(), {
    redirect: 'manual',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/json',
      'Cookie': cookieHeader(jar),
      'User-Agent': 'VERTAX-01'
    }
  });
  jar = mergeCookies(jar, authorize.headers);

  const location = authorize.headers.get('location');
  if (!location) throw new Error('Beatport OAuth redirect missing');
  const nextUrl = new URL(location, API_BASE);
  const code = nextUrl.searchParams.get('code');
  if (!code) throw new Error('Beatport OAuth code missing');

  const params = new URLSearchParams();
  params.set('code', code);
  params.set('grant_type', 'authorization_code');
  params.set('redirect_uri', REDIRECT_URI);
  params.set('client_id', clientId);

  const token = await fetch(API_BASE + '/auth/o/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Cookie': cookieHeader(jar),
      'User-Agent': 'VERTAX-01'
    },
    body: params
  });
  if (!token.ok) throw new Error('Beatport token exchange failed: HTTP ' + token.status);
  return token.json();
}

function storeToken(data) {
  if (!data || !data.access_token) throw new Error('Beatport token response is invalid');
  cachedToken = data.access_token;
  cachedRefreshToken = data.refresh_token || cachedRefreshToken || null;
  tokenExpiresAt = Date.now() + ((Number(data.expires_in) || 3600) * 1000) - TOKEN_BUFFER_MS;
  return cachedToken;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const clientId = await fetchBeatportClientId();
  const refreshed = await refreshAccessToken(clientId);
  if (refreshed && refreshed.access_token) return storeToken(refreshed);
  const passwordGrant = await authorizeWithPasswordGrant(clientId);
  if (passwordGrant && passwordGrant.access_token) return storeToken(passwordGrant);
  return storeToken(await authorizeWithPassword(clientId));
}

async function beatportAuthStatus(req, res) {
  try {
    await getAccessToken();
    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 500, { ok: false, message: error && error.message ? error.message : 'Beatport auth failed' });
  }
}

module.exports = beatportAuthStatus;
module.exports.getAccessToken = getAccessToken;
