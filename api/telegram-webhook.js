const {
  approveTrackProposal,
  rejectTrackProposal
} = require('../lib/redis-cache');
const {
  parseProposalCallback,
  callTelegram,
  escapeHtml
} = require('../lib/telegram-auth');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body || {}));
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

function isWebhookAuthorized(req) {
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (secret) return String(req.headers['x-telegram-bot-api-secret-token'] || '') === secret;
  const token = String(process.env.ADMIN_TOKEN || '').trim();
  return Boolean(token && String(req.query && req.query.token || '') === token);
}

function isAdminCallback(callback) {
  const userId = callback && callback.from && callback.from.id != null ? String(callback.from.id) : '';
  const adminUserId = String(process.env.TELEGRAM_ADMIN_USER_ID || '').trim();
  const adminChatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  return Boolean(userId && ((adminUserId && userId === adminUserId) || (adminChatId && userId === adminChatId)));
}

async function answer(callbackId, text) {
  if (!callbackId) return;
  await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackId,
    text,
    show_alert: false
  });
}

async function editCallbackMessage(callback, text) {
  const msg = callback && callback.message;
  if (!msg) return;
  await callTelegram('editMessageText', {
    chat_id: msg.chat && msg.chat.id,
    message_id: msg.message_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
}

module.exports = async function telegramWebhook(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!isWebhookAuthorized(req)) {
    send(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const body = await readJsonBody(req);
  const callback = body && body.callback_query;
  if (!callback) {
    send(res, 200, { ok: true, skipped: true });
    return;
  }
  if (!isAdminCallback(callback)) {
    await answer(callback.id, 'Нет доступа');
    send(res, 200, { ok: true, rejected: true });
    return;
  }

  const parsed = parseProposalCallback(callback.data);
  if (!parsed || !parsed.action) {
    await answer(callback.id, 'Не понял действие');
    send(res, 200, { ok: true, skipped: true });
    return;
  }

  const result = parsed.action === 'approve'
    ? await approveTrackProposal(parsed)
    : await rejectTrackProposal(parsed);

  const valueText = escapeHtml(parsed.field) + ': ' + escapeHtml(parsed.value);
  if (result.ok) {
    const status = parsed.action === 'approve' ? '✅ Подтверждено' : '❌ Отклонено';
    await answer(callback.id, status);
    await editCallbackMessage(callback, status + '\n\n' + valueText);
  } else {
    await answer(callback.id, result.error || 'Ошибка');
  }

  send(res, 200, { ok: true, action: parsed.action, result });
};
