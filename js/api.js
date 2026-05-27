/* VERTAX-01 / RUNT-01 external API helpers and set algorithms. */

/* ============================================================ */ /* API: DISCOGS */ /* ============================================================ */ function isDiscogsVinylResult(
  r
) {
  var f = ((r && r.format) || []).join(' ').toLowerCase();
  return f.indexOf('vinyl') >= 0 && f.indexOf('cd') < 0;
}
function isDiscogsVinylCollectionItem(item) {
  var formats = (item && item.basic_information && item.basic_information.formats) || [];
  var text = formats
    .map(function (f) {
      return [f && f.name, f && f.descriptions && f.descriptions.join(' ')]
        .filter(Boolean)
        .join(' ');
    })
    .join(' ')
    .toLowerCase();
  return text.indexOf('vinyl') >= 0 && text.indexOf('cd') < 0;
}
function vertaxApiUrl(path) {
  return new URL(path, window.location.origin);
}
function shouldUseDiscogsProxy() {
  try {
    var host = window.location.hostname || '';
    return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host);
  } catch (_) {
    return true;
  }
}
var DISCOGS_REQUEST_INTERVAL_MS = 350;
function createRateLimitedQueue(opts) {
  opts = opts || {};
  var intervalMs = opts.intervalMs || 350;
  var queue = [];
  var active = false;
  var lastRun = 0;
  function pump() {
    if (active || !queue.length) return;
    active = true;
    var wait = Math.max(0, intervalMs - (Date.now() - lastRun));
    setTimeout(function () {
      var item = queue.shift();
      lastRun = Date.now();
      Promise.resolve()
        .then(item.fn)
        .then(item.resolve, item.reject)
        .finally(function () {
          active = false;
          pump();
        });
    }, wait);
  }
  return {
    enqueue: function (fn) {
      return new Promise(function (resolve, reject) {
        queue.push({ fn: fn, resolve: resolve, reject: reject });
        pump();
      });
    },
  };
}
var discogsQueue = createRateLimitedQueue({ intervalMs: DISCOGS_REQUEST_INTERVAL_MS });
function runDiscogsRequest(fn) {
  return discogsQueue.enqueue(fn);
}
async function discogsProxyJson(url, failCode, privateCode) {
  var res = await runDiscogsRequest(function () {
    return fetch(url.toString(), { headers: { Accept: 'application/json' } });
  });
  if (res.status === 429) throw new Error('rate-limit');
  if (privateCode && (res.status === 404 || res.status === 403)) throw new Error(privateCode);
  if (res.status === 404) throw new Error('discogs-api-not-deployed');
  if (res.status === 500) {
    try {
      var body = await res.clone().json();
      if (body && body.error === 'discogs_token_missing') throw new Error('discogs-token-missing');
    } catch (err) {
      if (err && err.message === 'discogs-token-missing') throw err;
    }
  }
  if (!res.ok) throw new Error(failCode);
  return await res.json();
}
function shouldFallbackToPublicDiscogs(err) {
  var msg = String((err && err.message) || err || '');
  return (
    msg === 'discogs-api-not-deployed' ||
    msg === 'discogs-token-missing' ||
    /Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)
  );
}
async function discogsDirectJson(url, failCode, privateCode) {
  var res = await runDiscogsRequest(function () {
    return fetch(url.toString(), { headers: { Accept: 'application/json' } });
  });
  if (res.status === 429) throw new Error('rate-limit');
  if (privateCode && (res.status === 404 || res.status === 403)) throw new Error(privateCode);
  if (!res.ok) throw new Error(failCode);
  return await res.json();
}
function discogsDirectSearchUrl(params) {
  var url = new URL('https://api.discogs.com/database/search');
  Object.keys(params || {}).forEach(function (k) {
    if (params[k]) url.searchParams.set(k, params[k]);
  });
  url.searchParams.set('type', 'release');
  if (!url.searchParams.get('format')) url.searchParams.set('format', 'Vinyl');
  url.searchParams.set('per_page', '8');
  return url;
}
async function discogsSearch(params) {
  if (!shouldUseDiscogsProxy()) {
    return (await discogsDirectJson(discogsDirectSearchUrl(params), 'discogs-search-fail')).results.filter(
      isDiscogsVinylResult
    );
  }
  var url = vertaxApiUrl('/api/discogs');
  url.searchParams.set('action', 'search');
  Object.keys(params || {}).forEach(function (k) {
    if (params[k]) url.searchParams.set(k, params[k]);
  });
  url.searchParams.set('type', 'release');
  if (!url.searchParams.get('format')) url.searchParams.set('format', 'Vinyl');
  url.searchParams.set('per_page', '8');
  var data;
  try {
    data = await discogsProxyJson(url, 'discogs-search-fail');
  } catch (err) {
    if (!shouldFallbackToPublicDiscogs(err)) throw err;
    data = await discogsDirectJson(discogsDirectSearchUrl(params), 'discogs-search-fail');
  }
  return (data.results || []).filter(isDiscogsVinylResult);
}
async function discogsRelease(id) {
  if (!shouldUseDiscogsProxy()) {
    return await discogsDirectJson(
      new URL('https://api.discogs.com/releases/' + encodeURIComponent(id)),
      'discogs-release-fail'
    );
  }
  var url = vertaxApiUrl('/api/discogs');
  url.searchParams.set('action', 'release');
  url.searchParams.set('id', String(id));
  try {
    return await discogsProxyJson(url, 'discogs-release-fail');
  } catch (err) {
    if (!shouldFallbackToPublicDiscogs(err)) throw err;
    return await discogsDirectJson(
      new URL('https://api.discogs.com/releases/' + encodeURIComponent(id)),
      'discogs-release-fail'
    );
  }
}
async function discogsCollectionPage(username, page) {
  if (!shouldUseDiscogsProxy()) {
    var directUrl = new URL(
      'https://api.discogs.com/users/' +
        encodeURIComponent(username) +
        '/collection/folders/0/releases'
    );
    directUrl.searchParams.set('per_page', '100');
    directUrl.searchParams.set('page', String(page || 1));
    return await discogsDirectJson(
      directUrl,
      'discogs-collection-fail',
      'discogs-collection-private'
    );
  }
  var url = vertaxApiUrl('/api/discogs');
  url.searchParams.set('action', 'collection');
  url.searchParams.set('username', username);
  url.searchParams.set('per_page', '100');
  url.searchParams.set('page', String(page || 1));
  try {
    return await discogsProxyJson(url, 'discogs-collection-fail', 'discogs-collection-private');
  } catch (err) {
    if (!shouldFallbackToPublicDiscogs(err)) throw err;
    var directUrl = new URL(
      'https://api.discogs.com/users/' +
        encodeURIComponent(username) +
        '/collection/folders/0/releases'
    );
    directUrl.searchParams.set('per_page', '100');
    directUrl.searchParams.set('page', String(page || 1));
    return await discogsDirectJson(directUrl, 'discogs-collection-fail', 'discogs-collection-private');
  }
}
function mapDiscogsCollectionRelease(item) {
  var info = (item && item.basic_information) || {};
  var label = (info.labels && info.labels[0]) || {};
  var artists = (info.artists || [])
    .map(function (a) {
      return (a.name || '').replace(/\s\(\d+\)$/, '');
    })
    .filter(Boolean);
  var id = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : uuid();
  return {
    id: id,
    discogsId: String((item && item.id) || info.id || ''),
    artist: artists.join(', '),
    title: info.title || '',
    label: label.name || '',
    catno: label.catno || '',
    year: info.year || '',
    cover: info.cover_image || '',
    coverUrl: info.cover_image || '',
    genre: info.genres || [],
    style: info.styles || [],
    tracklist: [],
    bpm: null,
    key: null,
    source: 'discogs-import',
    status: 'manual',
    confidence: 'manual',
    addedAt: Date.now(),
  };
}
/* ============================================================ */ /* DISCOGS RELEASE → VINYL OBJECT */ /* ============================================================ */ function mapDiscogsRelease(
  r
) {
  var labels = r.labels || [];
  var formats = r.formats || [];
  var artists = (r.artists || [])
    .map(function (a) {
      return (a.name || '').replace(/\s\(\d+\)$/, '');
    })
    .filter(Boolean);
  var formatStr = formats
    .map(function (f) {
      var parts = [f.name];
      if (f.descriptions) parts = parts.concat(f.descriptions);
      return parts.filter(Boolean).join(' ');
    })
    .join(' / ');
  return {
    discogsId: r.id || null,
    artist: artists.join(' & ') || r.artists_sort || '?',
    title: r.title || '?',
    label: (labels[0] && labels[0].name) || '',
    catno: (labels[0] && labels[0].catno) || '',
    year: r.year || null,
    country: r.country || '',
    format: formatStr,
    coverUrl: r.thumb || (r.images && r.images[0] && r.images[0].uri) || '',
    genre: r.genres || [],
    style: r.styles || [],
    tracklist: (r.tracklist || [])
      .filter(function (t) {
        /* skip headings (no position usually means heading) */ return (
          t.title && (t.position || t.type_ === 'track' || !t.type_)
        );
      })
      .map(function (t) {
        var p = parsePos(t.position);
        return {
          id: uuid(),
          position: p.raw || '',
          side: p.side || 'A',
          title: t.title || '',
          duration: t.duration || '',
          bpm: null,
          key: null,
          camelot: null,
          bpmSource: null,
          keySource: null,
          confidence: 'manual',
          comment: null,
        };
      }),
  };
}

/* ============================================================ */ /* RECOGNITION */ /* ============================================================ */ async function recognizeVinyl(
  vinyl
) {
  vinyl.status = 'awaiting';
  render();
  try {
    var candidates = [];
    if (vinyl.source === 'catalog') {
      var p = { catno: vinyl.catno };
      if (vinyl.artist) p.artist = vinyl.artist;
      candidates = await discogsSearch(p);
    }
    if (candidates.length === 0) {
      vinyl.status = 'not_found';
      vinyl.confidence = 0;
      showToast('Релиз не найден. Можно ввести вручную.', 3000);
      render();
      return;
    }
    /* Fetch release detail for top-3 through the shared Discogs queue. */
    var settled = await Promise.allSettled(
      candidates.slice(0, 3).map(function (candidate) {
        return discogsRelease(candidate.id).then(function (rel) {
          return { search: candidate, mapped: mapDiscogsRelease(rel) };
        });
      })
    );
    var full = settled
      .filter(function (item) {
        return item.status === 'fulfilled' && item.value && item.value.mapped;
      })
      .map(function (item) {
        return item.value;
      });
    if (full.length === 0) {
      vinyl.status = 'not_found';
      showToast('Не удалось получить детали релиза.', 3000);
      render();
      return;
    }
    /* Confidence: catno match → 95%, otherwise 70% */ var byCatno = vinyl.source === 'catalog';
    vinyl.confidence = byCatno ? 95 : 70;
    if (full.length === 1 || vinyl.confidence > 85) {
      var m = full[0].mapped;
      Object.assign(vinyl, m);
      vinyl.status = 'recognized';
      render();
    } else {
      vinyl.status = 'needs_confirmation';
      state.ui.currentVinylId = vinyl.id;
      state.ui.candidates = full.map(function (f) {
        return f.mapped;
      });
      state.view = 'match';
      render();
    }
  } catch (e) {
    console.warn('recognize error:', e);
    var msg = String((e && e.message) || e);
    if (msg === 'rate-limit') showToast('Discogs rate-limit. Подожди минуту.', 5000);
    else if (/Failed to fetch|NetworkError/i.test(msg))
      showToast('Нет интернета или CORS. Открой через https.', 5000);
    else showToast('Ошибка распознавания: ' + msg, 4500);
    vinyl.status = 'not_found';
    render();
  }
}

/* ============================================================ */ /* METADATA FETCH (GetSongBPM → AcousticBrainz cascade) */ /* ============================================================ */ function sleep(
  ms
) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}
function normalizeKeyName(key) {
  if (!key) return null;
  var k = String(key).trim();
  /* Unify glyphs: ♯/♭ → #/b */ k = k.replace(/♯/g, '#').replace(/♭/g, 'b');
  /* Unify scale word */ k = k
    .replace(/[Mm][Aa][Jj][Oo][Rr]/g, 'major')
    .replace(/[Mm][Ii][Nn][Oo][Rr]/g, 'minor');
  k = k.replace(/\bMaj\.?\b/gi, 'major').replace(/\bMin\.?\b/gi, 'minor');
  /* sharp/flat words */ k = k.replace(/[-\s]?sharp/gi, '#').replace(/[-\s]?flat/gi, 'b');
  k = k.replace(/\s+/g, ' ').trim();
  if (KEY_TO_CAMELOT[k]) return k;
  if (KEY_ALIAS[k]) return KEY_ALIAS[k];
  /* Flat → sharp enharmonic */ var flatMap = {
    Ab: 'G#',
    Bb: 'A#',
    Cb: 'B',
    Db: 'C#',
    Eb: 'D#',
    Fb: 'E',
    Gb: 'F#',
  };
  var parts = k.split(' ');
  if (parts.length >= 2) {
    var note = parts[0],
      scale = parts.slice(1).join(' ');
    if (flatMap[note]) {
      var alt = flatMap[note] + ' ' + scale;
      if (KEY_TO_CAMELOT[alt]) return alt;
    }
  }
  /* Single note → assume major */ if (/^[A-G][#b]?$/.test(k)) {
    var single = k + ' major';
    if (KEY_TO_CAMELOT[single]) return single;
    if (parts.length === 1 && flatMap[k]) return flatMap[k] + ' major';
  }
  return null;
}
function applyHalftimeCorrection(meta, vinyl) {
  if (!meta || !meta.bpm) return meta;
  var dnbKw = [
    'drum and bass',
    "drum 'n' bass",
    'drum & bass',
    'drum&bass',
    'dnb',
    'd&b',
    'jungle',
    'neurofunk',
    'liquid funk',
    'techstep',
    'breakcore',
  ];
  var hay = [vinyl.format, vinyl.genre, vinyl.style, vinyl.label, vinyl.title]
    .map(function (x) {
      return String(x || '').toLowerCase();
    })
    .join(' ');
  var isDnB = dnbKw.some(function (kw) {
    return hay.indexOf(kw) >= 0;
  });
  if (isDnB && meta.bpm >= 75 && meta.bpm <= 95) {
    return Object.assign({}, meta, {
      bpm: meta.bpm * 2,
      halftimeCorrected: true,
      originalBpm: meta.bpm,
    });
  }
  return meta;
}
function parseGetSongBPMResponse(data) {
  var song = null;
  if (data && data.search && Array.isArray(data.search) && data.search.length > 0)
    song = data.search[0];
  else if (data && data.song) song = data.song;
  else return null;
  var bpm = null;
  if (song.tempo) bpm = parseInt(song.tempo, 10);
  else if (song.bpm) bpm = parseInt(song.bpm, 10);
  if (isNaN(bpm)) bpm = null;
  var camelot = null,
    key = null;
  var rawKey = song.key_of || song.key || song.camelot;
  if (rawKey != null) {
    var rk = String(rawKey).trim();
    if (/^\d{1,2}[AB]$/i.test(rk)) {
      camelot = rk.toUpperCase();
      key = CAMELOT_TO_KEY[camelot] || null;
    } else {
      var nk = normalizeKeyName(rk);
      if (nk) {
        key = nk;
        camelot = KEY_TO_CAMELOT[nk] || null;
      }
    }
  }
  if (!bpm && !camelot && !key) return null;
  return { bpm: bpm, key: key, camelot: camelot, source: 'getsongbpm', confidence: 'high' };
}
async function fetchFromGetSongBPM(artist, title) {
  if (!artist || !title) return null;
  var cleanArtist = String(artist)
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
  var cleanTitle = String(title)
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
  if (!cleanArtist || !cleanTitle) return null;
  var lookup = 'song:' + cleanTitle + '+artist:' + cleanArtist;
  var url =
    GETSONGBPM_BASE +
    '/search/?api_key=' +
    GETSONGBPM_KEY +
    '&type=both&lookup=' +
    encodeURIComponent(lookup);
  try {
    var res = await fetch(url);
    if (res.status === 429) {
      await sleep(5000);
      res = await fetch(url);
      if (!res.ok) return null;
    }
    if (!res.ok) return null;
    var data = await res.json();
    return parseGetSongBPMResponse(data);
  } catch (e) {
    console.warn('GetSongBPM error', e);
    return null;
  }
}
async function fetchFromAcousticBrainz(artist, title) {
  if (!artist || !title) return null;
  try {
    var safeArtist = String(artist).replace(/"/g, '').trim();
    var safeTitle = String(title).replace(/"/g, '').trim();
    var q = 'artist:"' + safeArtist + '" AND recording:"' + safeTitle + '"';
    var mbUrl =
      MUSICBRAINZ_BASE + '/recording/?query=' + encodeURIComponent(q) + '&fmt=json&limit=1';
    var mbRes = await fetch(mbUrl, { headers: { Accept: 'application/json' } });
    if (mbRes.status === 503) {
      await sleep(2000);
      mbRes = await fetch(mbUrl, { headers: { Accept: 'application/json' } });
    }
    if (!mbRes.ok) return null;
    var mbData = await mbRes.json();
    if (!mbData.recordings || mbData.recordings.length === 0) return null;
    var mbid = mbData.recordings[0].id;
    await sleep(1100);
    /* MusicBrainz polite-rate */ var abUrl = ACOUSTICBRAINZ_BASE + '/' + mbid + '/low-level';
    var abRes = await fetch(abUrl);
    if (!abRes.ok) return null;
    /* 404 = no audio features for this MBID */ var ab = await abRes.json();
    if (!ab || !ab.rhythm || !ab.tonal) return null;
    var bpm = ab.rhythm.bpm ? Math.round(ab.rhythm.bpm) : null;
    var keyKey = ab.tonal.key_key,
      keyScale = ab.tonal.key_scale;
    var key = null,
      camelot = null;
    if (keyKey && keyScale) {
      var nk = normalizeKeyName(keyKey + ' ' + keyScale);
      if (nk) {
        key = nk;
        camelot = KEY_TO_CAMELOT[nk] || null;
      }
    }
    if (!bpm && !camelot && !key) return null;
    return { bpm: bpm, key: key, camelot: camelot, source: 'acousticbrainz', confidence: 'medium' };
  } catch (e) {
    console.warn('AcousticBrainz error', e);
    return null;
  }
}
function getCachedMetadata(cacheKey) {
  return new Promise(function (resolve) {
    if (!dbInstance) return resolve(null);
    try {
      var r = dbInstance
        .transaction('bpm_cache', 'readonly')
        .objectStore('bpm_cache')
        .get(cacheKey);
      r.onsuccess = function () {
        var v = r.result;
        if (!v) return resolve(null);
        if (Date.now() - (v.cachedAt || 0) > BPM_CACHE_TTL_MS) return resolve(null);
        resolve(v);
      };
      r.onerror = function () {
        resolve(null);
      };
    } catch (_) {
      resolve(null);
    }
  });
}
async function setCachedMetadata(cacheKey, meta) {
  if (!dbInstance || !meta) return;
  try {
    var rec = Object.assign({}, meta, { cacheKey: cacheKey, cachedAt: Date.now() });
    await dbPut('bpm_cache', rec);
  } catch (_) {}
}
function normalizeMetadataCachePart(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\b(feat|ft|featuring)\.?\b/g, 'feat')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^\wа-яё0-9\s\-\|]/gi, '')
    .trim();
}
function getTrackCachePosition(track, vinyl) {
  var pos = (track && (track.position || track.displayPosition)) || '';
  if (!pos && typeof displayPosition === 'function' && track && vinyl) pos = displayPosition(track, vinyl);
  return String(pos || '').toUpperCase().trim();
}
function getMetadataCacheKeys(track, vinyl) {
  var keys = [];
  var discogsId = vinyl && (vinyl.discogsId || vinyl.discogsReleaseId);
  var pos = getTrackCachePosition(track, vinyl);
  if (discogsId && pos) keys.push('discogs:' + String(discogsId) + '|' + pos);
  var normalized =
    normalizeMetadataCachePart(vinyl && vinyl.artist) +
    '|' +
    normalizeMetadataCachePart(track && track.title);
  if (normalized !== '|') keys.push('norm:' + normalized);
  var legacy =
    String((vinyl && vinyl.artist) || '')
      .toLowerCase()
      .trim() +
    '|' +
    String((track && track.title) || '')
      .toLowerCase()
      .trim();
  if (legacy !== '|' && keys.indexOf(legacy) < 0) keys.push(legacy);
  return keys;
}
async function fetchTrackMetadata(track, vinyl) {
  var cacheKeys = getMetadataCacheKeys(track, vinyl);
  for (var ck = 0; ck < cacheKeys.length; ck++) {
    var cached = await getCachedMetadata(cacheKeys[ck]);
    if (cached) {
      if (ck > 0 && cacheKeys[0]) await setCachedMetadata(cacheKeys[0], cached);
      return cached;
    }
  }
  var primary = await fetchFromGetSongBPM(vinyl.artist, track.title);
  var secondary = null;
  var primaryEmpty = !primary || (!primary.bpm && !primary.key && !primary.camelot);
  if (primaryEmpty) {
    secondary = await fetchFromAcousticBrainz(vinyl.artist, track.title);
  }
  var result = primary || secondary;
  /* Conflict detection — both sources answered with BPM diverging by ≥3 */ if (
    primary &&
    secondary &&
    primary.bpm &&
    secondary.bpm
  ) {
    var diff = Math.abs(primary.bpm - secondary.bpm);
    if (diff >= 3) {
      result = Object.assign({}, primary, {
        confidence: 'low',
        conflict: {
          getsongbpm: primary.bpm,
          acousticbrainz: secondary.bpm,
          getsongbpmKey: primary.key || null,
          acousticbrainzKey: secondary.key || null,
        },
      });
    }
  }
  if (result && result.bpm) result = applyHalftimeCorrection(result, vinyl);
  if (result) {
    for (var k = 0; k < cacheKeys.length; k++) await setCachedMetadata(cacheKeys[k], result);
  }
  return result;
}

/* ============================================================ */ /* CAMELOT HELPERS + SET GENERATION */ /* ============================================================ */ function camelotNeighbors(
  c
) {
  if (!c) return [];
  var num = parseInt(c, 10);
  var letter = c.slice(-1);
  var nxt = num === 12 ? 1 : num + 1;
  var prv = num === 1 ? 12 : num - 1;
  return [c, nxt + letter, prv + letter, num + (letter === 'A' ? 'B' : 'A')];
}
function normalizeVinylField(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\wа-яё0-9]+/gi, '')
    .trim();
}
function getPhysicalVinylKey(v) {
  if (!v) return '';
  if (v.discogsId) return 'discogs:' + String(v.discogsId);
  if (v.catno) return 'catno:' + normalizeVinylField(v.label) + ':' + normalizeVinylField(v.catno);
  return [
    'manual',
    normalizeVinylField(v.artist),
    normalizeVinylField(v.title),
    normalizeVinylField(v.label),
    normalizeVinylField(v.year),
  ].join(':');
}
function normalizeTrackIdentity(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*remaster[^)]*\)/gi, '')
    .replace(/\[[^\]]*remaster[^\]]*\]/gi, '')
    .replace(/[^\wа-яё0-9]+/gi, '')
    .trim();
}
function runtTrackPhysicalKey(t) {
  if (!t) return '';
  if ((t.recordKey || t.recordId) && (t.displayPosition || t.position))
    return (
      'pos:' +
      (t.recordKey || t.recordId) +
      ':' +
      normalizeTrackIdentity(t.displayPosition || t.position)
    );
  return [
    'title',
    normalizeTrackIdentity(t.vinylArtist),
    normalizeTrackIdentity(t.vinylTitle),
    normalizeTrackIdentity(t.title),
  ].join(':');
}
function isValidNext(prev, cand, mode, opts) {
  if (!cand) return false;
  if (!prev) return true;
  if (
    runtTrackPhysicalKey(prev) &&
    runtTrackPhysicalKey(cand) &&
    runtTrackPhysicalKey(prev) === runtTrackPhysicalKey(cand)
  )
    return false;
  if (prev.id === cand.id) return false;
  if (prev.recordKey && cand.recordKey && prev.recordKey === cand.recordKey) return false;
  if (prev.recordId === cand.recordId) return false;
  var tempo = (opts && opts.tempoRange) || 4;
  if (mode === 'tempo-safe') {
    if (!prev.bpm || !cand.bpm) return false;
    if (Math.abs(prev.bpm - cand.bpm) > tempo) return false;
  } else if (mode === 'camelot-safe') {
    if (!prev.camelot || !cand.camelot) return false;
    if (camelotNeighbors(prev.camelot).indexOf(cand.camelot) < 0) return false;
  } else if (mode === 'best-flow') {
    if (!prev.bpm || !cand.bpm) return false;
    if (Math.abs(prev.bpm - cand.bpm) > tempo) return false;
    if (!prev.camelot || !cand.camelot) return false;
    if (camelotNeighbors(prev.camelot).indexOf(cand.camelot) < 0) return false;
  } else if (mode === 'camelot-filter') {
    var set = (opts && opts.camelotSet) || {};
    if (!cand.camelot || !set[cand.camelot]) return false;
  } else if (mode === 'energy-flow') {
    if (prev.bpm && cand.bpm && Math.abs(prev.bpm - cand.bpm) > 10) return false;
  } else {
    if (prev.bpm && cand.bpm && Math.abs(prev.bpm - cand.bpm) > tempo) return false;
  }
  return true;
}
function scoreCandidate(prev, cand, mode, opts) {
  var score = Math.random() * 0.5;
  if (!prev) {
    if (mode === 'energy-flow' && opts && opts.energyShape === 'cooldown' && cand.bpm)
      score += (200 - cand.bpm) / 20;
    if (mode === 'energy-flow' && opts && opts.energyShape === 'build-up' && cand.bpm)
      score += (cand.bpm - 60) / 30;
    if (opts && opts.targetCamelot && cand.camelot === opts.targetCamelot) score += 5;
    if (mode === 'best-flow' && cand.bpm && cand.camelot) score += 2;
    return score;
  }
  if (prev.bpm && cand.bpm) score += 10 - Math.abs(prev.bpm - cand.bpm);
  if (prev.camelot && cand.camelot) {
    if (prev.camelot === cand.camelot) score += 8;
    else if (camelotNeighbors(prev.camelot).indexOf(cand.camelot) >= 0) score += 4;
  }
  if (mode === 'best-flow') {
    if (prev.bpm && cand.bpm) {
      var d = cand.bpm - prev.bpm;
      if (d >= 0 && d <= 3) score += 3;
    }
  }
  return score;
}
function generateSetAlgo(allTracks, mode, opts, length) {
  length = length || window.SET_LENGTH || SET_LENGTH || 8;
  allTracks = (allTracks || []).filter(Boolean);
  if (!allTracks.length) return [];
  var seenInput = {};
  allTracks = allTracks.filter(function (t) {
    var k = runtTrackPhysicalKey(t) || t.id;
    if (seenInput[k]) return false;
    seenInput[k] = true;
    return true;
  });
  if (allTracks.length <= 1) return allTracks.slice(0, 1);
  var t0 = Date.now();
  var TIMEOUT = 2200;
  var best = [];
  function backtrack(cur, usedIds, usedKeys) {
    if (Date.now() - t0 > TIMEOUT) return;
    if (cur.length > best.length) best = cur.slice();
    if (cur.length >= length) return;
    var last = cur[cur.length - 1];
    var cands = allTracks.filter(function (t) {
      var k = runtTrackPhysicalKey(t) || t.id;
      return !usedIds[t.id] && !usedKeys[k] && isValidNext(last, t, mode, opts);
    });
    cands.sort(function (a, b) {
      return scoreCandidate(last, b, mode, opts) - scoreCandidate(last, a, mode, opts);
    });
    for (var i = 0; i < Math.min(8, cands.length); i++) {
      var c = cands[i];
      var ck = runtTrackPhysicalKey(c) || c.id;
      usedIds[c.id] = true;
      usedKeys[ck] = true;
      cur.push(c);
      backtrack(cur, usedIds, usedKeys);
      if (best.length >= length) return;
      cur.pop();
      usedIds[c.id] = false;
      usedKeys[ck] = false;
    }
  }
  var starts = allTracks.slice().sort(function () {
    return Math.random() - 0.5;
  });
  if (opts && opts.targetCamelot) {
    starts.sort(function (a, b) {
      var as = a.camelot === opts.targetCamelot ? 0 : 1;
      var bs = b.camelot === opts.targetCamelot ? 0 : 1;
      return as - bs;
    });
  }
  for (var s = 0; s < starts.length; s++) {
    if (Date.now() - t0 > TIMEOUT) break;
    if (best.length >= length) break;
    var st = starts[s];
    var sk = runtTrackPhysicalKey(st) || st.id;
    var usedIds = {};
    usedIds[st.id] = true;
    var usedKeys = {};
    usedKeys[sk] = true;
    backtrack([st], usedIds, usedKeys);
  }
  return best;
}
function getAllSessionTracks(opts) {
  opts = opts || {};
  var includeAll = !!opts.includeAll;
  var out = [];
  var seen = {};
  var sources = [].concat(state.vinyls || [], state.collection || []);
  for (var i = 0; i < sources.length; i++) {
    var v = sources[i];
    if (!v || !v.tracklist) continue;
    if (seen[v.id]) continue;
    seen[v.id] = true;
    var vinylExcluded = !!v.excludeFromSets;
    var recordKey = getPhysicalVinylKey(v);
    for (var j = 0; j < v.tracklist.length; j++) {
      var t = v.tracklist[j];
      var trackExcluded = !!t.excludeFromSets;
      if (!includeAll && (vinylExcluded || trackExcluded)) continue;
      out.push({
        id: t.id,
        position: t.position,
        side: t.side,
        title: t.title,
        duration: t.duration,
        bpm: t.bpm,
        key: t.key,
        camelot: t.camelot,
        originalBpm: t.originalBpm || null,
        bpmSource: t.bpmSource || null,
        displayPosition: displayPosition(t, v),
        recordId: v.id,
        recordKey: recordKey,
        vinylTitle: v.title,
        vinylArtist: v.artist,
        vinylCatno: v.catno || '',
        vinylLabel: v.label || '',
        vinylExcluded: vinylExcluded,
        trackExcluded: trackExcluded,
      });
    }
  }
  return out;
}
function dedupeGeneratedSet() {
  if (!state || !state.ui || !Array.isArray(state.ui.generatedSet)) return;
  var seen = {};
  state.ui.generatedSet = state.ui.generatedSet.filter(function (t) {
    var k = runtTrackPhysicalKey(t) || t.id;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
} /* RUNT algorithm extensions. Installed from app.js after boot in the original order. */

function installRuntManualMetaValidation() {
  /* RUNT-01 PATCH 14 — strict BPM / Key / Camelot validation Вставить последним T123-блоком после всех предыдущих патчей.
   */
  (function () {
    function runtToast(msg) {
      if (typeof showToast === 'function') showToast(msg, 3200);
      else alert(msg);
    }
    function runtNormalizeBpm(raw) {
      var s = String(raw == null ? '' : raw)
        .trim()
        .replace(',', '.');
      if (!s) return null;
      if (!/^\d{2,3}(\.\d{1,2})?$/.test(s))
        return { error: 'BPM должен быть числом, например 174 или 86.5' };
      var n = Number(s);
      if (!isFinite(n)) return { error: 'BPM должен быть числом' };
      if (n < 40 || n > 220) return { error: 'BPM должен быть в диапазоне 40–220' };
      return Math.round(n * 10) / 10;
    }
    var NOTE_TO_CANON = {
      A: 'A',
      'A#': 'A#',
      BB: 'A#',
      B: 'B',
      CB: 'B',
      C: 'C',
      'B#': 'C',
      'C#': 'C#',
      DB: 'C#',
      D: 'D',
      'D#': 'D#',
      EB: 'D#',
      E: 'E',
      FB: 'E',
      F: 'F',
      'E#': 'F',
      'F#': 'F#',
      GB: 'F#',
      G: 'G',
      'G#': 'G#',
      AB: 'G#',
    };
    function runtParseKey(raw) {
      var s = String(raw == null ? '' : raw).trim();
      if (!s) return { key: null, camelot: null };
      s = s.replace(/♯/g, '#').replace(/♭/g, 'b');
      /* Camelot: 8A, 08A, 12B */ var cam = s
        .toUpperCase()
        .replace(/\s+/g, '')
        .match(/^(0?[1-9]|1[0-2])([AB])$/);
      if (cam) {
        var camelot = String(parseInt(cam[1], 10)) + cam[2];
        return {
          key: typeof CAMELOT_TO_KEY !== 'undefined' ? CAMELOT_TO_KEY[camelot] || null : null,
          camelot: camelot,
        };
      }
      /* Normalize examples: */ /* Am, A min, A minor, A#m, Bb minor, F# major, Cmaj, Dm */ var t =
        s
          .replace(/\s+/g, ' ')
          .replace(/major/gi, 'maj')
          .replace(/minor/gi, 'min')
          .replace(/мажор/gi, 'maj')
          .replace(/минор/gi, 'min')
          .trim();
      var m = t.match(/^([A-Ga-g])([#bB]?)(?:\s|-)?(maj|major|m|min|minor)?$/i);
      if (!m) {
        return {
          error: 'Тональность должна быть Camelot 8A/7B или ключом вроде Am, F#m, D minor, C major',
        };
      }
      var note = (m[1].toUpperCase() + (m[2] || '').replace('b', 'B')).toUpperCase();
      var canonNote = NOTE_TO_CANON[note];
      if (!canonNote)
        return { error: 'Не понял ноту. Используй A, Bb, C#, F#m, D minor или Camelot 8A' };
      var modeRaw = (m[3] || '').toLowerCase();
      var mode;
      if (!modeRaw || modeRaw === 'maj' || modeRaw === 'major') mode = 'major';
      else if (modeRaw === 'm' || modeRaw === 'min' || modeRaw === 'minor') mode = 'minor';
      else return { error: 'Не понял лад. Используй major/minor или m/maj' };
      var key = canonNote + ' ' + mode;
      if (typeof KEY_TO_CAMELOT === 'undefined' || !KEY_TO_CAMELOT[key]) {
        return { error: 'Эта тональность не мапится в Camelot' };
      }
      return { key: key, camelot: KEY_TO_CAMELOT[key] };
    }
    function runtFindPairByEl(el) {
      var vid = el && el.dataset ? el.dataset.vid : null;
      var tid = el && el.dataset ? el.dataset.tid : null;
      var v = typeof findVinyl === 'function' ? findVinyl(vid) : null;
      var t = v && typeof findTrack === 'function' ? findTrack(v, tid) : null;
      return { v: v, t: t };
    }
    function runtSyncFetchingItem(track, vinyl) {
      try {
        var fp = state && state.ui && state.ui.fetchProgress;
        if (!fp || !fp.items) return;
        fp.items.forEach(function (it) {
          if (it.trackId === track.id) {
            it.status = track.excludeFromSets
              ? 'skipped'
              : track.bpm || track.camelot || track.key
                ? 'ok'
                : 'notfound';
            it.meta =
              track.bpm || track.camelot || track.key
                ? {
                    bpm: track.bpm || null,
                    key: track.key || null,
                    camelot: track.camelot || null,
                    source: 'manual',
                    confidence: 'manual',
                  }
                : null;
          }
        });
      } catch (e) {}
    }
    function runtManualMetaFlow(track, vinyl) {
      var bpmRaw = window.prompt(
        'BPM: число 40–220. Примеры: 174, 86.5. Пусто = очистить BPM.',
        track.bpm || ''
      );
      if (bpmRaw === null) return false;
      var bpmParsed = runtNormalizeBpm(bpmRaw);
      if (bpmParsed && bpmParsed.error) {
        runtToast(bpmParsed.error);
        return false;
      }
      var keyRaw = window.prompt(
        'Тональность: Camelot 8A/7B или ключ Am, F#m, D minor. Пусто = очистить Key.',
        track.camelot || track.key || ''
      );
      if (keyRaw === null) return false;
      var keyParsed = runtParseKey(keyRaw);
      if (keyParsed && keyParsed.error) {
        runtToast(keyParsed.error);
        return false;
      }
      track.bpm = bpmParsed === null ? null : bpmParsed;
      track.bpmSource = track.bpm ? 'manual' : null;
      track.originalBpm = null;
      track.halftimeCorrected = false;
      track.conflict = null;
      track.key = keyParsed.key;
      track.camelot = keyParsed.camelot;
      track.keySource = track.key || track.camelot ? 'manual' : null;
      track.confidence =
        track.bpm && (track.key || track.camelot)
          ? 'medium'
          : track.bpm || track.key || track.camelot
            ? 'medium'
            : 'manual';
      runtSyncFetchingItem(track, vinyl);
      if (typeof persistVinyl === 'function') persistVinyl(vinyl);
      runtToast('BPM/Key сохранены');
      if (typeof render === 'function') render();
      return true;
    }
    /* Override manual input from fetching / tracklist / diagnostics. */ if (
      typeof handlers !== 'undefined'
    ) {
      handlers['track-manual-meta'] = function (_, el) {
        var p = runtFindPairByEl(el);
        if (!p.t || !p.v) return;
        runtManualMetaFlow(p.t, p.v);
      };
      /* Validate edit screen save too. */ var oldTrackSave = handlers['track-save'];
      handlers['track-save'] = function (e, el) {
        var p = typeof getEditTrackPair === 'function' ? getEditTrackPair() : { v: null, t: null };
        if (!p.t || !p.v) {
          if (oldTrackSave) return oldTrackSave(e, el);
          return;
        }
        var bpmEl = document.getElementById('et-bpm');
        if (bpmEl) {
          var bpmParsed = runtNormalizeBpm(bpmEl.value);
          if (bpmParsed && bpmParsed.error) {
            runtToast(bpmParsed.error);
            bpmEl.focus();
            return;
          }
          p.t.bpm = bpmParsed === null ? null : bpmParsed;
          p.t.bpmSource = p.t.bpm ? 'manual' : null;
        }
        var commentEl = document.getElementById('et-comment');
        if (commentEl) p.t.comment = commentEl.value || null;
        p.t.conflict = null;
        p.t.originalBpm = null;
        p.t.halftimeCorrected = false;
        p.t.confidence =
          p.t.bpm && (p.t.key || p.t.camelot)
            ? 'high'
            : p.t.bpm || p.t.key || p.t.camelot
              ? 'medium'
              : 'manual';
        runtSyncFetchingItem(p.t, p.v);
        if (typeof persistVinyl === 'function') persistVinyl(p.v);
        state.view = 'tracklist';
        runtToast('Сохранено');
        if (typeof render === 'function') render();
      }; /* Patch add-track dialog if patch-10 is installed: validate values before creating track. */ /* This only catches the shared manual handler; old add-track implementations stay untouched if unavailable. */
    }
    /* Optional: expose helpers for console/debug. */ window.runtValidateBpm = runtNormalizeBpm;
    window.runtValidateKey = runtParseKey;
  })();
}
