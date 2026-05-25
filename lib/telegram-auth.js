const crypto = require('crypto');

function parseInitData(initData) {
  const raw = String(initData || '').trim();
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + value)
    .join('\n');
  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(String(process.env.TELEGRAM_BOT_TOKEN || ''))
    .digest();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch (_) {
    user = null;
  }
  return { user, auth_date: params.get('auth_date') || null };
}

function getTelegramUserFromRequest(req, body) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const initData = (req.headers && (req.headers['x-telegram-init-data'] || req.headers['X-Telegram-Init-Data']))
    || (body && body.telegramInitData)
    || '';
  return parseInitData(initData);
}

function isAdminTelegramUser(auth) {
  const userId = auth && auth.user && auth.user.id != null ? String(auth.user.id) : '';
  if (!userId) return false;
  const adminUserId = String(process.env.TELEGRAM_ADMIN_USER_ID || '').trim();
  const adminChatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  return (!!adminUserId && userId === adminUserId) || (!!adminChatId && userId === adminChatId);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function formatUserLabel(userContext) {
  if (!userContext) return '';
  const username = String(userContext.telegramUsername || '').trim().replace(/^@+/, '');
  const firstName = String(userContext.telegramFirstName || '').trim();
  const lastName = String(userContext.telegramLastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const telegramUserId = String(userContext.telegramUserId || '').trim();
  const vkUserId = String(userContext.vkUserId || '').trim();
  const clientId = String(userContext.clientId || '').trim();
  const parts = [];
  if (username) parts.push('@' + escapeHtml(username));
  if (fullName) parts.push(escapeHtml(fullName));
  if (telegramUserId) parts.push('id <code>' + escapeHtml(telegramUserId) + '</code>');
  if (vkUserId) parts.push('vk <code>' + escapeHtml(vkUserId) + '</code>');
  if (!parts.length && clientId) parts.push('client <code>' + escapeHtml(clientId.slice(0, 12)) + '</code>');
  return parts.length ? 'Пользователь: ' + parts.join(' · ') : '';
}

async function notifyNewProposal(proposal, userContext) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId || !proposal) {
    return { ok: false, skipped: true, reason: !token ? 'missing_bot_token' : !chatId ? 'missing_admin_chat_id' : 'missing_proposal' };
  }
  const hash = String(proposal.proposal_hash || String(proposal.proposal_key || '').replace(/^vertax:proposal:/, ''));
  const rows = [];
  const lines = [];
  Object.entries(proposal.pending_fields || {}).forEach(([field, item]) => {
    const oldValue = item && item.current_value != null && item.current_value !== '' ? item.current_value : 'пусто';
    Object.entries((item && item.candidates) || {}).forEach(([value, candidate]) => {
      const count = Number(candidate && candidate.count || 0);
      lines.push('<b>' + escapeHtml(field) + '</b>: ' + escapeHtml(oldValue) + ' → ' + escapeHtml(value) + ' от ' + count);
      rows.push([
        { text: '✅ ' + field + ': ' + value, callback_data: buildProposalCallback('approve', hash, field, value) },
        { text: '❌', callback_data: buildProposalCallback('reject', hash, field, value) }
      ]);
    });
  });
  const message = [
    '📝 Новое предложение в Vertax',
    '',
    '<b>' + escapeHtml(proposal.artist_original || '') + ' — ' + escapeHtml(proposal.title_original || '') + '</b>',
    proposal.label ? 'Label: ' + escapeHtml(proposal.label) : '',
    '',
    lines.join('\n'),
    '',
    formatUserLabel(userContext),
    'Ключ: <code>' + escapeHtml(proposal.track_key || '') + '</code>'
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: rows.length ? { inline_keyboard: rows } : undefined
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data && data.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: data && (data.description || data.error_code) || 'telegram_send_failed'
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    console.warn('Telegram proposal notification failed', error && error.message ? error.message : error);
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

async function notifyAdminTrackEdit(track, previous, saved, userContext) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId || !track) {
    return { ok: false, skipped: true, reason: !token ? 'missing_bot_token' : !chatId ? 'missing_admin_chat_id' : 'missing_track' };
  }
  const rows = [];
  function addRow(field, oldValue, newValue) {
    if (newValue === null || newValue === undefined || newValue === '') return;
    const oldText = oldValue !== null && oldValue !== undefined && oldValue !== '' ? oldValue : 'пусто';
    if (String(oldText) === String(newValue)) return;
    rows.push('<b>' + escapeHtml(field) + '</b>: ' + escapeHtml(oldText) + ' → ' + escapeHtml(newValue));
  }
  addRow('bpm', previous && previous.bpm, saved && saved.bpm);
  addRow('camelot', previous && previous.camelot, saved && saved.camelot);
  addRow('key_name', previous && previous.key_name, saved && saved.key_name);
  if (!rows.length) return { ok: false, skipped: true, reason: 'no_changed_fields' };
  const user = formatUserLabel(userContext);
  const message = [
    '✅ Правка Vertax применена',
    '',
    '<b>' + escapeHtml(track.artist_original || '') + ' — ' + escapeHtml(track.title_original || '') + '</b>',
    track.label ? 'Label: ' + escapeHtml(track.label) : '',
    '',
    rows.join('\n'),
    '',
    user,
    'Ключ: <code>' + escapeHtml(saved && (saved.track_key || saved.redis_key) || '') + '</code>'
  ].filter(Boolean).join('\n');
  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data && data.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: data && (data.description || data.error_code) || 'telegram_send_failed'
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    console.warn('Telegram admin edit notification failed', error && error.message ? error.message : error);
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function fieldToCode(field) {
  return ({ bpm: 'b', camelot: 'c', key_name: 'k', label: 'l', genre: 'g', sub_genre: 's', release_year: 'y' })[field] || field;
}

function codeToField(code) {
  return ({ b: 'bpm', c: 'camelot', k: 'key_name', l: 'label', g: 'genre', s: 'sub_genre', y: 'release_year' })[code] || code;
}

function buildProposalCallback(action, hash, field, value) {
  const actionCode = action === 'approve' ? 'a' : 'r';
  return ['vtx', actionCode, String(hash || '').slice(0, 40), fieldToCode(field), encodeURIComponent(String(value == null ? '' : value))].join(':').slice(0, 64);
}

function parseProposalCallback(data) {
  const parts = String(data || '').split(':');
  if (parts[0] !== 'vtx' || parts.length < 5) return null;
  return {
    action: parts[1] === 'a' ? 'approve' : parts[1] === 'r' ? 'reject' : null,
    proposal_hash: parts[2],
    field: codeToField(parts[3]),
    value: decodeURIComponent(parts.slice(4).join(':'))
  };
}

async function callTelegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return response.json().catch(() => null);
}

module.exports = {
  getTelegramUserFromRequest,
  isAdminTelegramUser,
  notifyNewProposal,
  notifyAdminTrackEdit,
  parseProposalCallback,
  callTelegram,
  escapeHtml
};
