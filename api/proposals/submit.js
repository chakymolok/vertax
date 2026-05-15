const { setCors, send, readJson } = require('../_lib/http');
const { submitProposal } = require('../_lib/curation');

module.exports = async function proposalsSubmit(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const uid = String(req.headers['x-user-id'] || '').trim();
    const body = await readJson(req);
    const result = await submitProposal(body, uid);
    send(res, result.status, result.body);
  } catch (error) {
    send(res, 400, { error: error && error.message ? error.message : 'bad_request' });
  }
};
