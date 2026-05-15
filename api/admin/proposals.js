const { setCors, send, requireAdmin } = require('../_lib/http');
const { listProposals } = require('../_lib/curation');

module.exports = async function adminProposals(req, res) {
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
  if (req.method !== 'GET') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const rows = await listProposals({
    limit: req.query.limit,
    cursor: req.query.cursor,
    filter: req.query.filter
  });
  send(res, 200, { proposals: rows, next_cursor: null });
};
