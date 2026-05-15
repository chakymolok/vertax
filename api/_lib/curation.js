const {
  safeRedis,
  normalizeCachePart,
  readableTrackKey,
  makeBeatportCacheIdentity,
  normalizeTrackRecord,
  resolveTrackRecord
} = require('../redis-cache');
const { notifyNewProposal } = require('./telegram');

const FIELDS = ['bpm', 'camelot', 'key_name', 'label', 'genre', 'sub_genre', 'release_year'];
const PROPOSAL_SET_KEY = 'vertax:proposals';

function fieldAllowed(field) {
  return FIELDS.indexOf(field) >= 0;
}

function proposalKey(trackKey) {
  return 'vertax:proposal:' + trackKey;
}

function normalizeMix(mix) {
  return normalizeCachePart(mix || 'original mix');
}

function identityFromParts(artist, title, mix) {
  const id = makeBeatportCacheIdentity(artist, title, '');
  const trackKey = readableTrackKey(artist, title, normalizeMix(mix));
  return Object.assign({}, id, {
    readableKey: trackKey,
    proposalKey: proposalKey(trackKey)
  });
}

function candidateValue(value) {
  return String(value == null ? '' : value).trim();
}

function validateFieldValue(field, value) {
  if (!fieldAllowed(field)) return { ok: false, message: 'field is not allowed' };
  if (field === 'bpm') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 60 || n > 220) return { ok: false, message: 'bpm must be 60-220' };
    return { ok: true, value: Math.round(n) };
  }
  if (field === 'camelot') {
    const text = String(value || '').trim().toUpperCase();
    if (!/^([1-9]|1[0-2])[AB]$/.test(text)) return { ok: false, message: 'camelot is invalid' };
    return { ok: true, value: text };
  }
  if (field === 'release_year') {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return { ok: false, message: 'release_year is invalid' };
    return { ok: true, value: String(year) };
  }
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > 80) return { ok: false, message: field + ' is invalid' };
  if (field === 'key_name' && text.length > 50) return { ok: false, message: 'key_name is too long' };
  return { ok: true, value: text };
}

async function getTrackRecord(identity) {
  const raw = await safeRedis('GET', [identity.trackKey], null);
  if (!raw) return null;
  try {
    const record = normalizeTrackRecord(identity, JSON.parse(raw));
    if (record && record.beatport) await safeRedis('SET', [identity.trackKey, JSON.stringify(record)], null);
    return record;
  } catch (_) {
    return null;
  }
}

async function saveTrackRecord(identity, record) {
  const next = Object.assign({}, record, {
    matched: true,
    track_key: record.track_key || identity.readableKey,
    redis_key: identity.trackKey,
    updated_at: new Date().toISOString()
  });
  if (!next.created_at) next.created_at = next.updated_at;
  await safeRedis('SET', [identity.trackKey, JSON.stringify(next)], null);
  await safeRedis('SADD', ['vertax:beatport:tracks', identity.trackKey], null);
  return next;
}

async function checkRateLimit(uid) {
  const hour = Math.floor(Date.now() / 3600000);
  const key = 'vertax:ratelimit:' + uid + ':' + hour;
  const count = Number(await safeRedis('INCR', [key], 1)) || 0;
  if (count === 1) await safeRedis('EXPIRE', [key, 3600], null);
  return count <= 30;
}

async function loadProposalByKey(trackKey) {
  const raw = await safeRedis('GET', [proposalKey(trackKey)], null);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function saveProposal(proposal) {
  proposal.updated_at = new Date().toISOString();
  await safeRedis('SET', [proposalKey(proposal.track_key), JSON.stringify(proposal)], null);
  await safeRedis('SADD', [PROPOSAL_SET_KEY, proposalKey(proposal.track_key)], null);
  await safeRedis('INCR', ['vertax:stats:total_proposals'], null);
}

async function deleteProposal(trackKey) {
  await safeRedis('DEL', [proposalKey(trackKey)], null);
  await safeRedis('SREM', [PROPOSAL_SET_KEY, proposalKey(trackKey)], null);
}

function activePendingFields(proposal) {
  const out = {};
  const fields = proposal && proposal.pending_fields || {};
  Object.keys(fields).forEach((field) => {
    const candidates = fields[field] && fields[field].candidates || {};
    const active = {};
    Object.keys(candidates).forEach((value) => {
      if (!candidates[value].rejected) active[value] = candidates[value];
    });
    if (Object.keys(active).length) out[field] = { candidates: active };
  });
  return out;
}

async function submitProposal(input, uid) {
  if (!uid || !/^[0-9a-f-]{16,80}$/i.test(uid)) return { status: 400, body: { error: 'X-User-Id is required' } };
  const allowed = await checkRateLimit(uid);
  if (!allowed) return { status: 429, body: { error: 'rate_limited' } };

  const artist = String(input.artist || '').trim();
  const title = String(input.title || '').trim();
  const mix = String(input.mix || input.mix_name || 'Original Mix').trim();
  const field = String(input.field || '').trim();
  const valid = validateFieldValue(field, input.value);
  if (!artist || !title) return { status: 400, body: { error: 'artist and title are required' } };
  if (!valid.ok) return { status: 400, body: { error: valid.message } };

  const identity = identityFromParts(artist, title, mix);
  const record = await getTrackRecord(identity);
  const resolved = record ? resolveTrackRecord(record) : null;
  const currentCurated = record && record.curated && record.curated[field];
  const currentBeatport = record && record.beatport && record.beatport[field];
  if (String(currentCurated == null ? '' : currentCurated) === String(valid.value) ||
      String(currentBeatport == null ? '' : currentBeatport) === String(valid.value)) {
    return { status: 200, body: { skipped: true, reason: 'already_in_base' } };
  }

  let proposal = await loadProposalByKey(identity.readableKey);
  const isNewProposal = !proposal;
  const now = new Date().toISOString();
  if (!proposal) {
    proposal = {
      track_key: identity.readableKey,
      redis_key: identity.trackKey,
      artist_original: artist,
      title_original: title,
      mix_name: mix || 'Original Mix',
      pending_fields: {},
      created_at: now,
      updated_at: now,
      is_new_track: !resolved || resolved.matched === false || (!resolved.beatport && !resolved.curated)
    };
  }

  proposal.pending_fields[field] = proposal.pending_fields[field] || { candidates: {} };
  const valueKey = candidateValue(valid.value);
  const cand = proposal.pending_fields[field].candidates[valueKey] || {
    count: 0,
    first_at: now,
    user_ids: [],
    last_at: now
  };
  if (cand.user_ids.indexOf(uid) < 0) {
    cand.user_ids.push(uid);
    cand.count = cand.user_ids.length;
    cand.last_at = now;
  }
  proposal.pending_fields[field].candidates[valueKey] = cand;
  await saveProposal(proposal);
  if (isNewProposal) await notifyNewProposal(proposal);
  return { status: 200, body: { ok: true, skipped: false, proposal } };
}

async function listProposals(options) {
  const limit = Math.max(1, Math.min(100, Number(options && options.limit) || 50));
  const onlyNew = options && options.filter === 'new_tracks_only';
  const keys = await safeRedis('SMEMBERS', [PROPOSAL_SET_KEY], []) || [];
  const rows = [];
  for (const key of keys) {
    const raw = await safeRedis('GET', [key], null);
    if (!raw) continue;
    try {
      const proposal = JSON.parse(raw);
      proposal.pending_fields = activePendingFields(proposal);
      if (!Object.keys(proposal.pending_fields).length) continue;
      if (onlyNew && !proposal.is_new_track) continue;
      let count = 0;
      Object.keys(proposal.pending_fields).forEach((field) => {
        Object.keys(proposal.pending_fields[field].candidates || {}).forEach((value) => {
          count += proposal.pending_fields[field].candidates[value].count || 0;
        });
      });
      rows.push(Object.assign({}, proposal, { count_of_users: count }));
    } catch (_) {}
  }
  rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return rows.slice(0, limit);
}

async function approve(trackKey, field, value) {
  const valid = validateFieldValue(field, value);
  if (!trackKey || !valid.ok) return { status: 400, body: { error: valid.message || 'invalid request' } };
  const proposal = await loadProposalByKey(trackKey);
  const identity = proposal
    ? { trackKey: proposal.redis_key, readableKey: proposal.track_key }
    : { trackKey: null, readableKey: trackKey };
  if (!identity.trackKey) return { status: 404, body: { error: 'proposal not found' } };
  const record = await getTrackRecord(identity) || { beatport: {}, curated: {}, track_key: trackKey, redis_key: identity.trackKey };
  record.curated = record.curated || {};
  record.curated[field] = valid.value;
  const saved = await saveTrackRecord(identity, record);
  if (proposal && proposal.pending_fields && proposal.pending_fields[field]) {
    delete proposal.pending_fields[field];
    if (!Object.keys(activePendingFields(proposal)).length) await deleteProposal(trackKey);
    else await saveProposal(proposal);
  }
  return { status: 200, body: resolveTrackRecord(saved) };
}

async function reject(trackKey, field, value) {
  const proposal = await loadProposalByKey(trackKey);
  if (!proposal || !proposal.pending_fields || !proposal.pending_fields[field]) {
    return { status: 404, body: { error: 'proposal not found' } };
  }
  const valueKey = candidateValue(value);
  if (proposal.pending_fields[field].candidates && proposal.pending_fields[field].candidates[valueKey]) {
    proposal.pending_fields[field].candidates[valueKey].rejected = true;
    proposal.pending_fields[field].candidates[valueKey].rejected_at = new Date().toISOString();
  }
  if (!Object.keys(activePendingFields(proposal)[field] && activePendingFields(proposal)[field].candidates || {}).length) {
    delete proposal.pending_fields[field];
  }
  if (!Object.keys(activePendingFields(proposal)).length) await deleteProposal(trackKey);
  else await saveProposal(proposal);
  return { status: 200, body: { ok: true } };
}

async function curate(input) {
  const artist = String(input.artist || '').trim();
  const title = String(input.title || '').trim();
  const mix = String(input.mix || input.mix_name || 'Original Mix').trim();
  const field = String(input.field || '').trim();
  const valid = validateFieldValue(field, input.value);
  if (!artist || !title || !valid.ok) return { status: 400, body: { error: valid.message || 'invalid request' } };
  const identity = identityFromParts(artist, title, mix);
  const record = await getTrackRecord(identity) || {
    matched: true,
    track_key: identity.readableKey,
    redis_key: identity.trackKey,
    beatport: {},
    curated: {}
  };
  record.curated = record.curated || {};
  record.curated[field] = valid.value;
  const saved = await saveTrackRecord(identity, record);
  return { status: 200, body: resolveTrackRecord(saved) };
}

module.exports = {
  FIELDS,
  identityFromParts,
  validateFieldValue,
  submitProposal,
  listProposals,
  approve,
  reject,
  curate
};
