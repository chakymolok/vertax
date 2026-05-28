const { safeRedis } = require('./redis-cache');

const AI_VERDICT_TTL_SECONDS = 30 * 24 * 60 * 60;

function cleanString(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength || 400);
}

function aiVerdictKey(releaseId, collectionHash) {
  return 'ai_verdict:' + cleanString(releaseId, 80).replace(/[^a-z0-9_.:-]/gi, '_') + ':' + cleanString(collectionHash, 160);
}

function compactAnalysisSummary(input) {
  const summary = input && input.analysis_summary || {};
  const release = summary.release || {};
  const scores = summary.scores || {};
  const breakdown = summary.breakdown || {};
  const matches = Array.isArray(summary.matches) ? summary.matches : [];
  const notEnriched = Array.isArray(summary.tracks_not_enriched) ? summary.tracks_not_enriched : [];
  return {
    release: {
      title: cleanString(release.title, 240),
      artist: cleanString(release.artist, 200),
      label: cleanString(release.label, 160),
      year: release.year || null,
      catalog_number: cleanString(release.catalog_number, 120),
      rating: release.rating == null ? null : Number(release.rating),
      rating_count: release.rating_count == null ? null : Number(release.rating_count),
      marketplace: release.marketplace || null
    },
    compatibility_score: scores.compatibility_score == null ? null : Number(scores.compatibility_score),
    purchase_score: scores.purchase_score == null ? null : Number(scores.purchase_score),
    scale_label: cleanString(scores.scale_label, 120),
    confidence: cleanString(scores.confidence, 40),
    recommended: !!scores.recommended,
    metadata_coverage: breakdown.metadata_coverage == null ? null : Number(breakdown.metadata_coverage),
    harmonic_overlap: breakdown.harmonic_overlap == null ? null : Number(breakdown.harmonic_overlap),
    top_matches: matches.slice(0, 5).map((match) => {
      const rt = match.release_track || {};
      const best = match.best_collection_matches && match.best_collection_matches[0] || {};
      return {
        release_track: {
          title: cleanString(rt.title, 160),
          bpm: rt.bpm || null,
          camelot: cleanString(rt.camelot, 12),
          genre: cleanString(rt.genre, 80)
        },
        collection_track: {
          title: cleanString(best.title, 160),
          artist: cleanString(best.artist, 160),
          bpm: best.bpm || null,
          camelot: cleanString(best.camelot, 12),
          compatibility: best.compatibility == null ? null : Number(best.compatibility),
          reasons: Array.isArray(best.reasons) ? best.reasons.slice(0, 3).map((x) => cleanString(x, 160)) : []
        }
      };
    }),
    weak_points: {
      tracks_not_enriched: notEnriched.length,
      unmatched_release_tracks: Array.isArray(summary.unmatched_release_tracks) ? summary.unmatched_release_tracks.length : 0
    }
  };
}

async function callGemini(summary) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    const err = new Error('gemini_api_key_missing');
    err.status = 503;
    throw err;
  }
  const prompt = [
    'Ты помогаешь диджею оценить пластинку для коллекции.',
    'Данные: ' + JSON.stringify(summary),
    'Напиши краткий живой вывод по-русски, 3-4 предложения. Тон: DJ, а не маркетолог.',
    'Ограничения:',
    '- Не советуй покупать только из-за рейтинга или цены.',
    '- Если metadata_coverage низкий, обязательно скажи, что вывод предварительный.',
    '- Если совпадений мало, не сглаживай это красивыми словами.',
    '- Не выдумывай жанры, настроение, редкость, историческую значимость, если данных нет.',
    '- Не делай вид, что score точнее, чем он есть.',
    '- Не утверждай, что релиз точно надо брать. Это помощник для digging, не оракул.'
  ].join('\n\n');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 420
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data && data.error && data.error.message || 'gemini_failed');
    err.status = response.status;
    throw err;
  }
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
    ? data.candidates[0].content.parts.map((part) => part.text || '').join('\n').trim()
    : '';
  if (!text) {
    const err = new Error('gemini_empty_response');
    err.status = 502;
    throw err;
  }
  return text.slice(0, 1400);
}

async function getAiVerdict(payload) {
  const releaseId = payload && payload.release_id;
  const collectionHash = payload && payload.collection_hash;
  if (!releaseId || !collectionHash) {
    const err = new Error('release_id_and_collection_hash_required');
    err.status = 400;
    throw err;
  }
  const key = aiVerdictKey(releaseId, collectionHash);
  const cached = await safeRedis('GET', [key], null);
  if (cached) {
    await safeRedis('EXPIRE', [key, AI_VERDICT_TTL_SECONDS], null);
    try {
      return Object.assign({ cached: true }, JSON.parse(cached));
    } catch (_) {}
  }
  const summary = compactAnalysisSummary(payload);
  const verdict = await callGemini(summary);
  const body = {
    verdict,
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    cached: false,
    created_at: new Date().toISOString()
  };
  await safeRedis('SET', [key, JSON.stringify(body), 'EX', AI_VERDICT_TTL_SECONDS], null);
  return body;
}

module.exports = {
  AI_VERDICT_TTL_SECONDS,
  getAiVerdict
};
