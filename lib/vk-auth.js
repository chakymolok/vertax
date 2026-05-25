const crypto = require('crypto');

function parseVkLaunchParams(rawParams) {
  const raw = String(rawParams || '').replace(/^[?#]/, '').trim();
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const sign = params.get('sign');
  const secret = String(process.env.VK_APP_SECRET || '').trim();
  if (!sign || !secret) return null;

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key.indexOf('vk_') === 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + value)
    .join('&');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const a = Buffer.from(sign);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return {
    user: {
      id: params.get('vk_user_id') || null,
      app_id: params.get('vk_app_id') || null,
      platform: params.get('vk_platform') || null,
      language: params.get('vk_language') || null
    },
    raw: Object.fromEntries(params.entries())
  };
}

function getVkUserFromRequest(req, body) {
  const launchParams = (req.headers && (req.headers['x-vk-launch-params'] || req.headers['X-VK-Launch-Params']))
    || (body && body.vkLaunchParams)
    || '';
  return parseVkLaunchParams(launchParams);
}

function isAdminVkUser(auth) {
  const userId = auth && auth.user && auth.user.id != null ? String(auth.user.id) : '';
  if (!userId) return false;
  const adminUserId = String(process.env.VK_ADMIN_USER_ID || '').trim();
  return !!adminUserId && userId === adminUserId;
}

module.exports = {
  parseVkLaunchParams,
  getVkUserFromRequest,
  isAdminVkUser
};
