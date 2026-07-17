const {
  upsertDiscogsTrackCache,
  hasManualFields,
  markAdminManualFields,
  stripManualFields,
  submitTrackProposal
} = require('../lib/redis-cache');
const {
  getTelegramUserFromRequest,
  isAdminTelegramUser,
  notifyNewProposal,
  notifyAdminTrackEdit
} = require('../lib/telegram-auth');
const {
  getVkUserFromRequest,
  isAdminVkUser
} = require('../lib/vk-auth');
const {
  savePublicReleaseFromVinyl
} = require('../lib/public-catalog');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Telegram-Init-Data,X-VK-Launch-Params,X-Vertax-Client-Id');
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
      if (raw.length > 4 * 1024 * 1024) {
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

function requestContext(req, body) {
  const auth = getTelegramUserFromRequest(req, body);
  const vkAuth = getVkUserFromRequest(req, body);
  const telegramUser = auth && auth.user ? auth.user : null;
  const vkUser = vkAuth && vkAuth.user ? vkAuth.user : null;
  const clientId = String(
    (req.headers && (
      req.headers['x-vertax-client-id'] ||
      req.headers['X-Vertax-Client-Id']
    )) ||
    body.clientId ||
    ''
  ).trim();
  return {
    isAdmin: isAdminTelegramUser(auth) || isAdminVkUser(vkAuth),
    userContext: {
      telegramUserId: telegramUser && telegramUser.id != null ? String(telegramUser.id) : '',
      telegramUsername: telegramUser && telegramUser.username ? String(telegramUser.username) : '',
      telegramFirstName: telegramUser && telegramUser.first_name ? String(telegramUser.first_name) : '',
      telegramLastName: telegramUser && telegramUser.last_name ? String(telegramUser.last_name) : '',
      vkUserId: vkUser && vkUser.id != null ? String(vkUser.id) : '',
      vkAppId: vkUser && vkUser.app_id != null ? String(vkUser.app_id) : '',
      userId: vkUser && vkUser.id != null ? 'vk:' + String(vkUser.id) : '',
      clientId
    }
  };
}

async function ingestVinyl(vinyl, context) {
  const tracks = Array.isArray(vinyl.tracklist) ? vinyl.tracklist : [];
  let upserted = 0;
  let created = 0;
  let proposed = 0;
  let skipped = 0;
  let telegram_notified = 0;
  let telegram_skipped = 0;
  const errors = [];
  const telegram_errors = [];
  const publicTracks = [];
  let catalogSaved = false;
  let catalogError = null;

  for (const track of tracks.slice(0, 200)) {
    const payload = normalizeTrack(vinyl, track || {});
    if (!payload) {
      skipped += 1;
      continue;
    }
    try {
      const manual = hasManualFields(payload);
      const writePayload = manual && context.isAdmin
        ? markAdminManualFields(payload)
        : (manual ? stripManualFields(payload) : payload);
      const result = await upsertDiscogsTrackCache(writePayload);
      if (result && result.ok) {
        upserted += 1;
        if (result.created) created += 1;
        publicTracks.push(result.record || writePayload);
      } else {
        skipped += 1;
        publicTracks.push(writePayload);
      }
      if (manual && !context.isAdmin) {
        const proposal = await submitTrackProposal(payload, context.userContext);
        if (proposal && proposal.ok && !proposal.skipped) {
          proposed += 1;
          const notice = await notifyNewProposal(proposal.proposal, context.userContext);
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
        }
      } else if (manual && context.isAdmin && result && result.ok) {
        const notice = await notifyAdminTrackEdit(
          payload,
          result.previous,
          result.record,
          context.userContext
        );
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

  try {
    const catalogResult = await savePublicReleaseFromVinyl(vinyl, publicTracks.length
      ? publicTracks
      : tracks, {
      ingested_from: tracks.length ? 'discogs_app' : 'local_collection_sync'
    });
    catalogSaved = Boolean(catalogResult && catalogResult.ok);
    if (!catalogSaved) catalogError = catalogResult && catalogResult.error || 'catalog_save_failed';
  } catch (error) {
    catalogError = error && error.message ? error.message : String(error);
  }

  return {
    ok: true,
    source: 'discogs',
    discogs_release_id: vinyl.discogsId || null,
    admin_write: context.isAdmin,
    track_count: tracks.length,
    upserted,
    created,
    proposed,
    skipped,
    telegram_notified,
    telegram_skipped,
    telegram_errors,
    catalog_saved: catalogSaved,
    catalog_error: catalogError,
    errors
  };
}

function aggregateResults(results, context) {
  const totals = {
    ok: true,
    source: 'discogs',
    mode: 'bulk',
    admin_write: context.isAdmin,
    releases_seen: results.length,
    releases_saved: 0,
    upserted: 0,
    created: 0,
    proposed: 0,
    skipped: 0,
    telegram_notified: 0,
    telegram_skipped: 0,
    errors: [],
    releases: []
  };
  results.forEach((result) => {
    if (result.catalog_saved) totals.releases_saved += 1;
    totals.upserted += result.upserted || 0;
    totals.created += result.created || 0;
    totals.proposed += result.proposed || 0;
    totals.skipped += result.skipped || 0;
    totals.telegram_notified += result.telegram_notified || 0;
    totals.telegram_skipped += result.telegram_skipped || 0;
    if (result.catalog_error && totals.errors.length < 30) {
      totals.errors.push({
        discogs_release_id: result.discogs_release_id,
        error: result.catalog_error
      });
    }
    (result.errors || []).forEach((error) => {
      if (totals.errors.length < 30) totals.errors.push(error);
    });
    totals.releases.push({
      discogs_release_id: result.discogs_release_id,
      catalog_saved: result.catalog_saved,
      track_count: result.track_count,
      upserted: result.upserted,
      proposed: result.proposed
    });
  });
  return totals;
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

  const context = requestContext(req, body);
  const isBulk = Array.isArray(body.vinyls);
  const vinyls = isBulk ? body.vinyls.slice(0, 20) : [body.vinyl || body];
  const validVinyls = vinyls.filter((vinyl) => {
    return vinyl && /^\d+$/.test(String(vinyl.discogsId || vinyl.discogs_id || ''));
  });
  if (!validVinyls.length) {
    send(res, 400, { message: 'discogs release is required' });
    return;
  }

  const results = [];
  for (const vinyl of validVinyls) {
    if (!vinyl.discogsId && vinyl.discogs_id) vinyl.discogsId = vinyl.discogs_id;
    results.push(await ingestVinyl(vinyl, context));
  }

  send(res, 200, isBulk ? aggregateResults(results, context) : results[0]);
};
