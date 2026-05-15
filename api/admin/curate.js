const { setCors, send, readJson, requireAdmin } = require('../_lib/http');
const { curate } = require('../_lib/curation');

module.exports = async function adminCurate(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (!requireAdmin(req)) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }
  try {
    const body = await readJson(req);
    const result = await curate(body);
    send(res, result.status, result.body);
  } catch (error) {
    send(res, 400, { error: error && error.message ? error.message : 'bad_request' });
  }
};
