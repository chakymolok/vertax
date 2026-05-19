const { callTelegram } = require('../telegram-auth');

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
  res.end(JSON.stringify(body || {}));
}

function isAuthorized(req) {
  const token = process.env.ADMIN_TOKEN || '';
  const header = String(req.headers.authorization || '');
  return Boolean(token && header === 'Bearer ' + token);
}

module.exports = async function adminTelegramTest(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }
  if (!isAuthorized(req)) {
    send(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if (!hasToken || !chatId) {
    send(res, 500, {
      ok: false,
      has_bot_token: hasToken,
      has_admin_chat_id: Boolean(chatId),
      error: !hasToken ? 'missing_bot_token' : 'missing_admin_chat_id'
    });
    return;
  }

  const result = await callTelegram('sendMessage', {
    chat_id: chatId,
    text: '✅ Vertax Telegram test: ' + new Date().toISOString(),
    disable_web_page_preview: true
  });

  send(res, result && result.ok ? 200 : 500, {
    ok: Boolean(result && result.ok),
    has_bot_token: hasToken,
    has_admin_chat_id: Boolean(chatId),
    telegram: result
  });
};
