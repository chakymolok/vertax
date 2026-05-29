const {
  getCollectionIndex,
  trackCompatibility,
  collectionProfile,
  confidence,
  sanitizeUserId,
} = require('./compatibility-analysis');
const { safeRedis } = require('./redis-cache');
const { getReleaseCandidate, genreFamily } = require('./release-candidates');

const INDEX_TTL_DAYS = 30;
const GENRE_INDEX_PREFIX = 'vertax:candidates:by_genre_family:';
const CAMELOT_INDEX_PREFIX = 'vertax:candidates:by_camelot:';
const BPM_INDEX_PREFIX = 'vertax:candidates:by_bpm_bucket:';
const CANDIDATES_ALL_KEY = 'vertax:candidates:all';

function cleanString(value, maxLength) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  return text ? text.slice(0, maxLength || 240) : '';
}

function normalizeText(value) {
  return cleanString(value, 240)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCamelot(value) {
  const text = cleanString(value, 8).toUpperCase();
  return /^(1[0-2]|[1-9])[AB]$/.test(text) ? text : null;
}

function clampLimit(value) {
  return Math.max(1, Math.min(10, Number(value) || 6));
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function parseBpmRange(value) {
  const nums = String(value || '').match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const first = Number(nums[0]);
  const second = nums.length > 1 ? Number(nums[1]) : first;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

function bpmBucketsForRange(value) {
  const range = parseBpmRange(value);
  if (!range) return [];
  const out = [];
  const start = Math.floor(range.min / 5) * 5;
  const end = Math.floor(range.max / 5) * 5;
  for (let n = start; n <= end; n += 5) out.push(n + '-' + (n + 4));
  return unique(out);
}

function bpmInRange(bpm, value) {
  const range = parseBpmRange(value);
  const n = Number(bpm);
  if (!range || !Number.isFinite(n)) return true;
  return n >= range.min && n <= range.max;
}

async function setMembers(key) {
  return (await safeRedis('SMEMBERS', [key], [])) || [];
}

async function unionSetKeys(keys) {
  const out = new Set();
  for (const key of unique(keys)) {
    const ids = await setMembers(key);
    ids.forEach((id) => out.add(String(id)));
  }
  return Array.from(out);
}

function intersectSets(groups) {
  const valid = (groups || []).filter((group) => Array.isArray(group) && group.length);
  if (!valid.length) return [];
  const base = new Set(valid[0].map(String));
  for (let i = 1; i < valid.length; i++) {
    const next = new Set(valid[i].map(String));
    Array.from(base).forEach((id) => {
      if (!next.has(id)) base.delete(id);
    });
  }
  return Array.from(base);
}

async function idsForCamelotGap(gap) {
  const camelot = cleanCamelot(gap.camelot);
  if (!camelot) return { ids: [], match_scope: 'empty' };
  const camelotIds = await setMembers(CAMELOT_INDEX_PREFIX + camelot);
  const bpmIds = await unionSetKeys(
    bpmBucketsForRange(gap.target_bpm_range || gap.bpm_range).map(
      (bucket) => BPM_INDEX_PREFIX + bucket
    )
  );
  const family = cleanString(gap.genre_family, 80);
  const familyIds = family ? await setMembers(GENRE_INDEX_PREFIX + family) : [];

  if (bpmIds.length && familyIds.length) {
    const exact = intersectSets([camelotIds, bpmIds, familyIds]);
    if (exact.length) return { ids: exact, match_scope: 'exact_gap' };
  }
  if (bpmIds.length) {
    const noFamily = intersectSets([camelotIds, bpmIds]);
    if (noFamily.length) return { ids: noFamily, match_scope: 'expanded_without_family' };
  }
  return { ids: camelotIds, match_scope: 'expanded_camelot_only' };
}

async function idsForBpmGap(gap) {
  const bpmIds = await unionSetKeys(
    bpmBucketsForRange(gap.bpm_range || gap.target_bpm_range).map(
      (bucket) => BPM_INDEX_PREFIX + bucket
    )
  );
  if (!bpmIds.length) return { ids: [], match_scope: 'empty' };

  const camelotKeys = unique(gap.nearby_camelots || gap.camelots || [])
    .map(cleanCamelot)
    .filter(Boolean)
    .map((camelot) => CAMELOT_INDEX_PREFIX + camelot);
  const camelotIds = camelotKeys.length ? await unionSetKeys(camelotKeys) : [];
  const family = cleanString(gap.genre_family, 80);
  const familyIds = family ? await setMembers(GENRE_INDEX_PREFIX + family) : [];

  if (camelotIds.length && familyIds.length) {
    const exact = intersectSets([bpmIds, camelotIds, familyIds]);
    if (exact.length) return { ids: exact, match_scope: 'exact_gap' };
  }
  if (camelotIds.length) {
    const noFamily = intersectSets([bpmIds, camelotIds]);
    if (noFamily.length) return { ids: noFamily, match_scope: 'expanded_without_family' };
  }
  return { ids: bpmIds, match_scope: 'expanded_bpm_only' };
}

async function idsForGap(gap) {
  if (!gap || gap.type === 'camelot' || gap.camelot) return await idsForCamelotGap(gap || {});
  if (gap.type === 'bpm' || gap.bpm_range) return await idsForBpmGap(gap || {});
  return { ids: [], match_scope: 'empty' };
}

function publicReleaseTrack(track) {
  return {
    position: track.position || null,
    title: track.title || '',
    artist: track.artist || '',
    bpm: track.bpm || null,
    camelot: track.camelot || null,
    genre: track.genre || null,
  };
}

function publicCollectionTrack(track) {
  return {
    title: track.title || '',
    artist: track.artist || '',
    bpm: track.bpm || null,
    camelot: track.camelot || null,
    genre: track.genre || null,
  };
}

function releaseTrackHitsGap(track, release, gap) {
  if (!track || !track.enriched || !track.bpm || !track.camelot) return false;
  if (gap.type === 'camelot' || gap.camelot) {
    if (cleanCamelot(track.camelot) !== cleanCamelot(gap.camelot)) return false;
    if (
      (gap.target_bpm_range || gap.bpm_range) &&
      !bpmInRange(track.bpm, gap.target_bpm_range || gap.bpm_range)
    )
      return false;
  }
  if (gap.type === 'bpm' || gap.bpm_range) {
    if (!bpmInRange(track.bpm, gap.bpm_range || gap.target_bpm_range)) return false;
    const nearby = unique(gap.nearby_camelots || [])
      .map(cleanCamelot)
      .filter(Boolean);
    if (nearby.length && nearby.indexOf(cleanCamelot(track.camelot)) < 0) return false;
  }
  if (gap.genre_family) {
    const family = genreFamily(track.genre, track.sub_genre, (release && release.styles) || []);
    if (family && family !== gap.genre_family) return false;
  }
  return true;
}

function topNames(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => normalizeText((item && item.name) || item))
    .filter(Boolean);
}

function hasTasteMatch(release, profile, gap) {
  const labels = topNames(profile && profile.top_labels);
  const artists = topNames(profile && profile.top_artists);
  const families = topNames(profile && (profile.genre_families || profile.top_genre_families));
  const releaseLabel = normalizeText(release.label);
  const releaseArtist = normalizeText(release.artist);
  const releaseFamily = normalizeText(release.genre_family);
  const gapFamily = normalizeText(gap && gap.genre_family);
  return Boolean(
    (releaseLabel && labels.indexOf(releaseLabel) >= 0) ||
    (releaseArtist && artists.indexOf(releaseArtist) >= 0) ||
    (releaseFamily && families.indexOf(releaseFamily) >= 0) ||
    (gapFamily && releaseFamily && gapFamily === releaseFamily)
  );
}

function analyzeCandidateRelease(release, index, gap, profileInput) {
  const tracks = Array.isArray(release && release.tracks) ? release.tracks : [];
  const enriched = tracks.filter((track) => track && track.enriched && track.bpm && track.camelot);
  const collectionTracks = Array.isArray(index && index.tracks) ? index.tracks : [];
  const matches = [];
  const densities = [];
  let tracksWithMatch = 0;

  enriched.forEach((track) => {
    const best = collectionTracks
      .map((candidate) => ({
        candidate,
        compatibility: trackCompatibility(
          {
            bpm: track.bpm,
            camelot: track.camelot,
            genre: track.genre || release.genre_family || (release.styles && release.styles[0]),
          },
          candidate
        ),
      }))
      .filter((item) => item.compatibility.score > 0)
      .sort((a, b) => b.compatibility.score - a.compatibility.score)
      .slice(0, 3);
    const bestScore = best.length ? best[0].compatibility.score : 0;
    densities.push(bestScore);
    if (bestScore > 0.5) tracksWithMatch += 1;
    if (best.length) {
      matches.push({
        release_track: publicReleaseTrack(track),
        collection_track: publicCollectionTrack(best[0].candidate),
        compatibility: best[0].compatibility.score,
        reasons: best[0].compatibility.reasons || [],
      });
    }
  });

  const harmonicOverlap = enriched.length ? tracksWithMatch / enriched.length : 0;
  const density = densities.length
    ? densities.reduce((sum, value) => sum + value, 0) / densities.length
    : 0;
  const metadataCoverage = tracks.length
    ? enriched.length / tracks.length
    : Number(release.metadata_coverage) || 0;
  const compatibilityScore = Math.round(100 * (0.65 * harmonicOverlap + 0.35 * density));
  const ratingNorm = release && release.rating ? Number(release.rating) / 5 : null;
  let purchaseScore = Math.round(
    100 * (0.8 * (compatibilityScore / 100) + 0.2 * (ratingNorm == null ? 0.5 : ratingNorm))
  );
  if (compatibilityScore < 55) purchaseScore = Math.min(purchaseScore, 45);
  else if (compatibilityScore < 70) purchaseScore = Math.min(purchaseScore, 59);
  const conf = confidence(
    metadataCoverage,
    index.track_count || collectionTracks.length || 0,
    enriched.length
  );
  const gapHits = enriched
    .filter((track) => releaseTrackHitsGap(track, release, gap || {}))
    .slice(0, 6)
    .map((track) => ({ track: publicReleaseTrack(track), gap }));
  const closesGap = gapHits.length > 0;
  const profile = profileInput || collectionProfile(index);
  const tasteMatch = hasTasteMatch(release, profile, gap || {});
  const partialHit = closesGap || matches.some((item) => item.compatibility >= 0.55);

  let bucket = null;
  if (metadataCoverage >= 0.75 && compatibilityScore >= 70 && closesGap) bucket = 'strong';
  else if (metadataCoverage >= 0.3 && compatibilityScore >= 55 && (tasteMatch || partialHit))
    bucket = 'probable';
  else if ((metadataCoverage < 0.3 || compatibilityScore < 55) && tasteMatch) bucket = 'explore';

  return {
    bucket,
    scores: {
      compatibility_score: compatibilityScore,
      purchase_score: purchaseScore,
      confidence: conf,
    },
    breakdown: {
      metadata_coverage: Math.round(metadataCoverage * 100) / 100,
      harmonic_overlap: Math.round(harmonicOverlap * 100) / 100,
      collection_density: Math.round(density * 100) / 100,
      discogs_rating_norm: ratingNorm == null ? null : Math.round(ratingNorm * 100) / 100,
    },
    closes_gap: closesGap,
    gap_hits: gapHits,
    top_matches: matches.slice(0, 3),
  };
}

function whyForCandidate(release, analysis, gap) {
  const why = [];
  const hit = analysis.gap_hits && analysis.gap_hits[0] && analysis.gap_hits[0].track;
  if (hit) {
    why.push(
      'закрывает ' +
        [hit.camelot, hit.bpm ? Math.round(Number(hit.bpm)) + ' BPM' : null]
          .filter(Boolean)
          .join(' / ')
    );
  } else if (gap && gap.camelot) {
    why.push('попадает в зону ' + gap.camelot);
  }
  why.push(
    'BPM/Key найден для ' +
      (release.enriched_track_count || 0) +
      ' из ' +
      (release.track_count || (release.tracks || []).length || 0) +
      ' треков'
  );
  if (analysis.top_matches && analysis.top_matches.length) {
    why.push('матчится с ' + analysis.top_matches.length + ' треками твоей коллекции');
  }
  if (release.rating) {
    why.push(
      'Discogs ' +
        release.rating +
        '/5' +
        (release.rating_count ? ' (' + release.rating_count + ')' : '')
    );
  }
  return why.slice(0, 4);
}

function publicCandidate(release, analysis, gap, label) {
  return {
    discogs_id: release.discogs_id,
    artist: release.artist || '',
    title: release.title || '',
    label: release.label || '',
    year: release.year || null,
    catalog_number: release.catalog_number || '',
    cover_url: release.cover_url || '',
    discogs_url: release.discogs_url || '',
    fit_label: label,
    scores: analysis.scores,
    breakdown: analysis.breakdown,
    marketplace: release.marketplace || {},
    why: whyForCandidate(release, analysis, gap),
    gap_hits: analysis.gap_hits,
    top_matches: analysis.top_matches.map((item) => ({
      release_track: item.release_track.title,
      release_track_meta: {
        bpm: item.release_track.bpm,
        camelot: item.release_track.camelot,
      },
      collection_track: [item.collection_track.artist, item.collection_track.title]
        .filter(Boolean)
        .join(' - '),
      collection_track_meta: {
        bpm: item.collection_track.bpm,
        camelot: item.collection_track.camelot,
      },
      compatibility: item.compatibility,
      reasons: item.reasons,
    })),
  };
}

function groupSummary(gap, strong, probable, explore) {
  if (strong.length) {
    const target = gap.camelot || gap.bpm_range || gap.target_bpm_range || 'этот gap';
    return 'Нашёл ' + strong.length + ' сильн. кандидата, которые закрывают ' + target + '.';
  }
  if (probable.length)
    return 'Есть ' + probable.length + ' возможн. кандидата, но стоит проверить точнее.';
  if (explore.length) return 'Есть несколько релизов по контексту, но данных мало.';
  return 'Пока не нашли конкретных релизов под этот gap.';
}

async function recommendCandidates(input) {
  const userId = sanitizeUserId(input && input.userId);
  const body = (input && input.body) || {};
  const collectionHash = cleanString(body.collection_hash, 180);
  if (!userId || userId === 'anonymous') {
    const err = new Error('user_id_required');
    err.status = 400;
    throw err;
  }
  if (!collectionHash) {
    const err = new Error('collection_hash_required');
    err.status = 400;
    throw err;
  }

  const index = await getCollectionIndex(userId, collectionHash);
  if (!index) {
    return {
      error: 'collection_index_missing',
      message: 'Collection index not found or expired. Please sync collection first.',
    };
  }

  const rawGaps = Array.isArray(body.gaps) ? body.gaps.slice(0, 8) : [];
  const limit = clampLimit(body.limit_per_gap);
  const excluded = new Set(
    []
      .concat(body.excluded_ids || [])
      .concat(body.owned_ids || [])
      .filter(Boolean)
      .map(String)
  );
  const profile = Object.assign(collectionProfile(index), body.collection_profile || {});
  const groups = [];
  const emptyGroups = [];
  const allIds = (await setMembers(CANDIDATES_ALL_KEY)) || [];

  for (const gap of rawGaps) {
    const lookup = await idsForGap(gap);
    const ids = lookup.ids
      .filter((id) => !excluded.has(String(id)))
      .slice(0, Math.max(limit * 6, 30));
    const buckets = { strong: [], probable: [], explore: [] };
    for (const id of ids) {
      const release = await getReleaseCandidate(id);
      if (!release || !release.discogs_id) continue;
      if (
        release.format &&
        /\b(cd|file|cassette|cdr|dvd)\b/i.test(release.format) &&
        !/vinyl|12|lp|ep/i.test(release.format)
      )
        continue;
      const analysis = analyzeCandidateRelease(release, index, gap, profile);
      if (!analysis.bucket) continue;
      if (analysis.bucket === 'explore' && !body.include_explore) continue;
      buckets[analysis.bucket].push(publicCandidate(release, analysis, gap, analysis.bucket));
    }
    Object.keys(buckets).forEach((key) => {
      buckets[key].sort((a, b) => {
        return (
          (b.scores.compatibility_score || 0) - (a.scores.compatibility_score || 0) ||
          (b.breakdown.metadata_coverage || 0) - (a.breakdown.metadata_coverage || 0)
        );
      });
      buckets[key] = buckets[key].slice(0, limit);
    });
    if (!buckets.strong.length && !buckets.probable.length && !buckets.explore.length) {
      emptyGroups.push({
        gap,
        reason: allIds.length
          ? 'В базе кандидатов пока нет релизов под этот gap.'
          : 'База кандидатов ещё не заполнена.',
      });
      continue;
    }
    groups.push({
      gap,
      summary: groupSummary(gap, buckets.strong, buckets.probable, buckets.explore),
      match_scope: lookup.match_scope,
      strong: buckets.strong,
      probable: buckets.probable,
      explore: buckets.explore,
    });
  }

  return {
    ok: true,
    collection_hash: collectionHash,
    generated_at: new Date().toISOString(),
    expires_in_days: INDEX_TTL_DAYS,
    confidence: index.track_count >= 100 ? 'high' : index.track_count >= 30 ? 'medium' : 'low',
    groups,
    empty_groups: emptyGroups,
  };
}

module.exports = {
  recommendCandidates,
  analyzeCandidateRelease,
  bpmBucketsForRange,
};
