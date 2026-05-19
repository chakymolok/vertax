const {
  markAdminManualFields,
  upsertDiscogsTrackCache
} = require('../../lib/redis-cache');

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
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 20 * 1024 * 1024) {
        raw = '';
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function cleanArray(value) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
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
    halftime_corrected: Boolean(track.halftimeCorrected || track.halftime_corrected)
  });
}

function getBackupVinyls(body) {
  if (Array.isArray(body && body.vinyls)) return body.vinyls;
  if (Array.isArray(body && body.collection)) return body.collection;
  if (body && body.backup && Array.isArray(body.backup.vinyls)) return body.backup.vinyls;
  return [];
}

module.exports = async function adminImportBackup(req, res) {
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

  const vinyls = getBackupVinyls(body);
  if (!vinyls.length) {
    send(res, 400, { message: 'backup has no vinyls' });
    return;
  }

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
            error: error && error.message ? error.message : String(error)
          });
        }
      }
    }
  }

  send(res, 200, {
    ok: true,
    source: 'backup',
    admin_write: true,
    vinyls_seen: vinyls.length,
    tracks_seen,
    updated,
    created,
    skipped,
    errors
  });
};
