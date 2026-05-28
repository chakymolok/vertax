const { safeRedis } = require('./redis-cache');

const AI_VERDICT_TTL_SECONDS = 30 * 24 * 60 * 60;
const AI_PROMPT_VERSION = 'v2';

function cleanString(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength || 400);
}

function envSecret(name) {
  const value = cleanString(process.env[name] || '', 2000);
  return value && value !== 'undefined' && value !== 'null' ? value : '';
}

function aiError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status || 500;
  return err;
}

function aiVerdictKey(releaseId, collectionHash) {
  return 'ai_verdict:' + AI_PROMPT_VERSION + ':' + cleanString(releaseId, 80).replace(/[^a-z0-9_.:-]/gi, '_') + ':' + cleanString(collectionHash, 160);
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
      country: cleanString(release.country, 80),
      format: cleanString(release.format, 160),
      catalog_number: cleanString(release.catalog_number, 120),
      genres: Array.isArray(release.genres) ? release.genres.slice(0, 6).map((x) => cleanString(x, 80)) : [],
      styles: Array.isArray(release.styles) ? release.styles.slice(0, 8).map((x) => cleanString(x, 80)) : [],
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

function buildPrompt(summary) {
  return [
    'Ты опытный vinyl DJ и digging-помощник. Ты оцениваешь пластинку для конкретной коллекции.',
    'Данные: ' + JSON.stringify(summary),
    'Напиши живой AI DJ-разбор по-русски: 2-3 коротких абзаца, без заголовков.',
    'Что обязательно раскрыть:',
    '- Как пластинка ложится в музыкальный контекст коллекции: BPM, Camelot, совпадения и пробелы.',
    '- Для каких сетов или моментов она могла бы подойти: warm-up, peak-time, переходный мост, deep/rolling section, финал, afterhours и т.п. Выбирай только если это следует из BPM/Key/жанров/совпадений.',
    '- Если есть Discogs-сигналы, аккуратно упомяни ценность: год, лейбл, стиль, рейтинг, цена/количество в продаже. Не называй редкой или исторически важной без данных.',
    '- Если совпадение слабое, скажи это честно, но по-диджейски: где может сработать и где будет риск.',
    'Ограничения:',
    '- Не советуй покупать только из-за рейтинга или цены.',
    '- Если metadata_coverage низкий, обязательно скажи, что вывод предварительный.',
    '- Если совпадений мало, не сглаживай это красивыми словами.',
    '- Не выдумывай жанры, настроение, редкость, историческую значимость, если данных нет. Можно делать осторожные выводы из BPM, Camelot, жанров, лейбла, года, рейтинга и цены.',
    '- Не делай вид, что score точнее, чем он есть.',
    '- Не утверждай, что релиз точно надо брать. Это помощник для digging, не оракул.',
    'Стиль: чуть образнее и живее, но без рекламной воды. Пиши как человек, который реально собирает vinyl-only сет.'
  ].join('\n\n');
}

function isQuotaErrorMessage(message) {
  return /quota|rate.?limit|billing|free_tier|limit:\s*0|exceeded/i.test(String(message || ''));
}

async function callGeminiModel(summary, model) {
  const apiKey = envSecret('GEMINI_API_KEY');
  if (!apiKey) throw aiError('ai_unavailable', 'GEMINI_API_KEY не задан.', 503);
  const prompt = buildPrompt(summary);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.78,
        maxOutputTokens: 680
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = data && data.error && data.error.message || 'gemini_failed';
    if (response.status === 429 || isQuotaErrorMessage(rawMessage)) {
      throw aiError(
        'ai_quota_exceeded',
        'Лимит Gemini исчерпан или free-tier для этого ключа сейчас равен 0. Нужен billing/quota в Google AI Studio или запасной GROQ_API_KEY.',
        429
      );
    }
    if (response.status === 403) throw aiError('ai_forbidden', 'Gemini не принимает этот ключ или проекту запрещён доступ к модели.', 403);
    throw aiError('ai_verdict_failed', rawMessage, response.status);
  }
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
    ? data.candidates[0].content.parts.map((part) => part.text || '').join('\n').trim()
    : '';
  if (!text) {
    throw aiError('ai_empty_response', 'Gemini вернул пустой ответ.', 502);
  }
  return { text: text.slice(0, 1400), provider: 'gemini', model };
}

async function callGemini(summary) {
  const preferred = cleanString(process.env.GEMINI_MODEL || 'gemini-2.0-flash', 80);
  const models = [preferred, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest']
    .filter(Boolean)
    .filter((model, idx, list) => list.indexOf(model) === idx);
  let lastError = null;
  for (const model of models) {
    try {
      return await callGeminiModel(summary, model);
    } catch (error) {
      lastError = error;
      if (error && (error.status === 400 || error.status === 404 || error.status === 503 || error.code === 'ai_quota_exceeded')) continue;
      throw error;
    }
  }
  throw lastError || aiError('ai_verdict_failed', 'Gemini недоступен.', 502);
}

async function callGroq(summary) {
  const apiKey = envSecret('GROQ_API_KEY');
  if (!apiKey) throw aiError('ai_unavailable', 'GROQ_API_KEY не задан.', 503);
  const model = cleanString(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', 120);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(summary) }],
      temperature: 0.78,
      max_tokens: 680
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = data && data.error && data.error.message || 'groq_failed';
    if (response.status === 429 || isQuotaErrorMessage(rawMessage)) {
      throw aiError('ai_quota_exceeded', 'Лимит Groq исчерпан.', 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw aiError('ai_forbidden', 'Groq не принимает GROQ_API_KEY или проекту запрещён доступ к модели.', response.status);
    }
    throw aiError('ai_verdict_failed', rawMessage, response.status);
  }
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    ? String(data.choices[0].message.content).trim()
    : '';
  if (!text) throw aiError('ai_empty_response', 'Groq вернул пустой ответ.', 502);
  return { text: text.slice(0, 1400), provider: 'groq', model };
}

async function callAiProvider(summary) {
  let geminiError = null;
  try {
    return await callGemini(summary);
  } catch (error) {
    geminiError = error;
  }
  try {
    return await callGroq(summary);
  } catch (groqError) {
    if (groqError && groqError.message === 'GROQ_API_KEY не задан.' && geminiError) throw geminiError;
    throw groqError || geminiError;
  }
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
  const generated = await callAiProvider(summary);
  const body = {
    verdict: generated.text,
    provider: generated.provider,
    model: generated.model,
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
