function htmlEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function candidateLines(proposal) {
  const fields = proposal && proposal.pending_fields || {};
  return Object.keys(fields).map((field) => {
    const candidates = fields[field] && fields[field].candidates || {};
    const top = Object.keys(candidates).sort((a, b) => {
      return (candidates[b].count || 0) - (candidates[a].count || 0);
    })[0];
    if (!top) return '';
    return field.toUpperCase() + ': ' + htmlEscape(top) + ' (от ' + (candidates[top].count || 1) + ' юзера)';
  }).filter(Boolean);
}

async function notifyNewProposal(proposal) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId || !proposal) return;

  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
    : 'https://vertax-one.vercel.app';
  const title = htmlEscape([
    proposal.artist_original,
    proposal.title_original
  ].filter(Boolean).join(' - '));
  const mix = proposal.mix_name ? ' (' + htmlEscape(proposal.mix_name) + ')' : '';
  const newLine = proposal.is_new_track ? '\n<b>НОВЫЙ ТРЕК — не было в базе</b>\n' : '';
  const message = [
    '📝 <b>Новое предложение в Vertax</b>',
    '',
    title + mix,
    newLine,
    candidateLines(proposal).join('\n'),
    '',
    '👉 ' + appUrl + '/admin?track=' + encodeURIComponent(proposal.track_key)
  ].filter((line) => line !== '').join('\n');

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
    console.warn('Telegram notification failed', error && error.message ? error.message : error);
  }
}

module.exports = { notifyNewProposal };
