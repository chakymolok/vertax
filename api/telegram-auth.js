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

async function notifyNewProposal(proposal) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId || !proposal) return;
  const fields = Object.entries(proposal.pending_fields || {})
    .map(([field, item]) => {
      const candidates = Object.entries((item && item.candidates) || {})
        .map(([value, candidate]) => escapeHtml(value) + ' от ' + Number(candidate.count || 0))
        .join(', ');
      return '<b>' + escapeHtml(field) + '</b>: ' + candidates;
    })
    .join('\n');
  const message = [
    '📝 Новое предложение в Vertax',
    '',
    '<b>' + escapeHtml(proposal.artist_original || '') + ' — ' + escapeHtml(proposal.title_original || '') + '</b>',
    proposal.label ? 'Label: ' + escapeHtml(proposal.label) : '',
    '',
    fields,
    '',
    'Ключ: <code>' + escapeHtml(proposal.track_key || '') + '</code>'
  ].filter(Boolean).join('\n');

  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.warn('Telegram proposal notification failed', error && error.message ? error.message : error);
  }
}

module.exports = {
  getTelegramUserFromRequest,
  isAdminTelegramUser,
  notifyNewProposal
};
