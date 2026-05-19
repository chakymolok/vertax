const {
  upsertDiscogsTrackCache,
  hasManualFields,
  markAdminManualFields,
  stripManualFields,
  submitTrackProposal
} = require('./redis-cache');
const {
  getTelegramUserFromRequest,
  isAdminTelegramUser,
  notifyNewProposal,
  notifyAdminTrackEdit
} = require('./telegram-auth');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Telegram-Init-Data,X-Vertax-Client-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
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
      if (raw.length > 1024 * 1024) {
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

function cleanNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

function cleanString(value, maxLength) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, maxLength || 120);
}

function cleanCamelot(value) {
  const text = cleanString(value, 4);
  if (!text) return null;
  const upper = text.toUpperCase();
  return /^([1-9]|1[0-2])[AB]$/.test(upper) ? upper : null;
}

function normalizeTrack(vinyl, track) {
  const artist = String(track.artist || track.vinylArtist || vinyl.artist || '').trim();
  const title = String(track.title || '').trim();
  if (!artist || !title) return null;
  return {
    artist_original: artist,
    title_original: title,
    label: String(vinyl.label || '').trim() || null,
    release_year: vinyl.year ? String(vinyl.year).slice(0, 4) : null,
    duration: track.duration ? String(track.duration).trim() : null,
    discogs_release_id: vinyl.discogsId ? String(vinyl.discogsId) : null,
    discogs_position: track.position ? String(track.position).trim() : null,
    discogs_catno: vinyl.catno ? String(vinyl.catno).trim() : null,
    discogs_label: vinyl.label ? String(vinyl.label).trim() : null,
    discogs_genres: cleanArray(vinyl.genre || vinyl.genres),
    discogs_styles: cleanArray(vinyl.style || vinyl.styles),
    bpm: cleanNumber(track.bpm, 40, 240),
    key_name: cleanString(track.key || track.key_name, 80),
    camelot: cleanCamelot(track.camelot),
    bpm_source: cleanString(track.bpmSource || track.bpm_source, 40),
    key_source: cleanString(track.keySource || track.key_source, 40),
    confidence: cleanString(track.confidence, 40),
    meta_status: cleanString(track.metaStatus || track.meta_status, 40),
    original_bpm: cleanNumber(track.originalBpm || track.original_bpm, 40, 240),
    halftime_corrected: Boolean(track.halftimeCorrected || track.halftime_corrected),
  };
}

module.exports = async function discogsIngest(req, res) {
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

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    send(res, 400, { message: 'invalid JSON body' });
    return;
  }

  const vinyl = body.vinyl || body;
  const tracks = Array.isArray(vinyl.tracklist) ? vinyl.tracklist : [];
  if (!tracks.length) {
    send(res, 400, { message: 'tracklist is required' });
    return;
  }

  let upserted = 0;
  let created = 0;
  let proposed = 0;
  let skipped = 0;
  let telegram_notified = 0;
  let telegram_skipped = 0;
  const errors = [];
  const telegram_errors = [];
  const auth = getTelegramUserFromRequest(req, body);
  const isAdmin = isAdminTelegramUser(auth);
  const clientId = String((req.headers && (req.headers['x-vertax-client-id'] || req.headers['X-Vertax-Client-Id'])) || body.clientId || '').trim();
  const userContext = {
    telegramUserId: auth && auth.user && auth.user.id != null ? String(auth.user.id) : '',
    clientId
  };

  for (const track of tracks.slice(0, 200)) {
    const payload = normalizeTrack(vinyl, track || {});
    if (!payload) {
      skipped += 1;
      continue;
    }
    try {
      const manual = hasManualFields(payload);
      const writePayload = manual && isAdmin
        ? markAdminManualFields(payload)
        : (manual ? stripManualFields(payload) : payload);
      const result = await upsertDiscogsTrackCache(writePayload);
      if (result && result.ok) {
        upserted += 1;
        if (result.created) created += 1;
      } else {
        skipped += 1;
      }
      if (manual && !isAdmin) {
        const proposal = await submitTrackProposal(payload, userContext);
        if (proposal && proposal.ok && !proposal.skipped) {
          proposed += 1;
          if (proposal.created) {
            const notice = await notifyNewProposal(proposal.proposal);
            if (notice && notice.ok) telegram_notified += 1;
            else {
              telegram_skipped += 1;
              if (telegram_errors.length < 10) {
                telegram_errors.push({
                  title: payload.title_original,
                  reason: notice && (notice.reason || notice.error) || 'telegram_notification_failed'
                });
              }
            }
          } else {
            telegram_skipped += 1;
          }
        }
      } else if (manual && isAdmin && result && result.ok) {
        const notice = await notifyAdminTrackEdit(payload, result.previous, result.record, userContext);
        if (notice && notice.ok) telegram_notified += 1;
        else {
          telegram_skipped += 1;
          if (notice && notice.reason !== 'no_changed_fields' && telegram_errors.length < 10) {
            telegram_errors.push({
              title: payload.title_original,
              reason: notice && (notice.reason || notice.error) || 'telegram_notification_failed'
            });
          }
        }
      }
    } catch (error) {
      if (errors.length < 20) {
        errors.push({
          title: payload.title_original,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
  }

  send(res, 200, {
    ok: true,
    source: 'discogs',
    discogs_release_id: vinyl.discogsId || null,
    admin_write: isAdmin,
    upserted,
    created,
    proposed,
    skipped,
    telegram_notified,
    telegram_skipped,
    telegram_errors,
    errors
  });
};
