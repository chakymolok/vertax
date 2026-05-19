const { rejectTrackProposal } = require('../redis-cache');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isAuthorized(req) {
  const token = process.env.ADMIN_TOKEN || '';
  const header = String(req.headers.authorization || '');
  return Boolean(token && header === 'Bearer ' + token);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); }
    catch (_) { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function adminReject(req, res) {
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
  if (!isAuthorized(req)) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    send(res, 400, { message: 'invalid JSON body' });
    return;
  }
  const result = await rejectTrackProposal(body);
  send(res, result.ok ? 200 : 400, result);
};
