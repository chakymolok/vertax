/* VERTAX-01 / RUNT-01 handlers and legacy runtime patches. */

(function installDiscogsIngestBridge() {
  if (typeof window === 'undefined' || window.__vertaxDiscogsIngestBridgeInstalled) return;
  window.__vertaxDiscogsIngestBridgeInstalled = true;

  function cleanArray(value) {
    var list = Array.isArray(value) ? value : value ? [value] : [];
    var seen = {};
    return list
      .map(function (item) {
        return String(item || '').trim();
      })
      .filter(function (item) {
        var key = item.toLowerCase();
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .slice(0, 20);
  }

  function compactVinylForIngest(v) {
    if (!v || !v.discogsId || !Array.isArray(v.tracklist) || !v.tracklist.length) return null;
    function cleanNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      var n = Number(value);
      return isFinite(n) ? Math.round(n * 10) / 10 : null;
    }
    return {
      discogsId: v.discogsId,
      artist: v.artist || '',
      title: v.title || '',
      label: v.label || '',
      catno: v.catno || '',
      year: v.year || '',
      genre: cleanArray(v.genre || v.genres),
      style: cleanArray(v.style || v.styles),
      tracklist: v.tracklist
        .slice(0, 200)
        .map(function (t) {
          return {
            position: (t && t.position) || '',
            title: (t && t.title) || '',
            artist: (t && (t.artist || t.vinylArtist)) || '',
            duration: (t && t.duration) || '',
            bpm: t ? cleanNumber(t.bpm) : null,
            key: (t && t.key) || '',
            camelot: (t && t.camelot) || '',
            bpmSource: (t && t.bpmSource) || '',
            keySource: (t && t.keySource) || '',
            confidence: (t && t.confidence) || '',
            metaStatus: (t && t.metaStatus) || '',
            originalBpm: t ? cleanNumber(t.originalBpm) : null,
            halftimeCorrected: !!(t && t.halftimeCorrected),
          };
        })
        .filter(function (t) {
          return t.title;
        }),
    };
  }

  function getVertaxClientId() {
    try {
      var key = 'vertax_uid';
      var value = localStorage.getItem(key);
      if (!value) {
        value =
          window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return '';
    }
  }

  function getTelegramInitData() {
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)
        return window.Telegram.WebApp.initData;
      if (window.WebApp && window.WebApp.initData) return window.WebApp.initData;
    } catch (_) {}
    return '';
  }

  function getVkLaunchParams() {
    try {
      if (typeof window.getVkLaunchParamsString === 'function')
        return window.getVkLaunchParamsString();
    } catch (_) {}
    return '';
  }

  function sendDiscogsIngest(v) {
    var payload = compactVinylForIngest(v);
    if (!payload || !payload.tracklist.length) {
      window.__vertaxLastIngest = {
        ok: false,
        skipped: true,
        reason: 'empty_payload',
        at: new Date().toISOString(),
      };
      return;
    }
    try {
      if (!window.location || !/^https?:$/.test(window.location.protocol)) {
        window.__vertaxLastIngest = {
          ok: false,
          skipped: true,
          reason: 'non_http_origin',
          at: new Date().toISOString(),
        };
        return;
      }
      var headers = { 'Content-Type': 'application/json' };
      var initData = getTelegramInitData();
      var vkLaunchParams = getVkLaunchParams();
      var clientId = getVertaxClientId();
      if (initData) headers['X-Telegram-Init-Data'] = initData;
      if (vkLaunchParams) headers['X-VK-Launch-Params'] = vkLaunchParams;
      if (clientId) headers['X-Vertax-Client-Id'] = clientId;
      var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname || '');
      var apiUrl = (isLocal ? 'https://vertax-one.vercel.app' : '') + '/api/discogs-ingest';
      window.__vertaxLastIngest = {
        ok: null,
        status: 'sending',
        url: apiUrl,
        tracks: payload.tracklist.length,
        at: new Date().toISOString(),
      };
      fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          vinyl: payload,
          clientId: clientId,
          telegramInitData: initData,
          vkLaunchParams: vkLaunchParams,
        }),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              window.__vertaxLastIngest = {
                ok: res.ok,
                httpStatus: res.status,
                body: body,
                url: apiUrl,
                tracks: payload.tracklist.length,
                at: new Date().toISOString(),
              };
            });
        })
        .catch(function (e) {
          window.__vertaxLastIngest = {
            ok: false,
            error: e && e.message ? e.message : String(e),
            url: apiUrl,
            tracks: payload.tracklist.length,
            at: new Date().toISOString(),
          };
          console.warn('Discogs ingest skipped', e);
        });
    } catch (e) {
      window.__vertaxLastIngest = {
        ok: false,
        error: e && e.message ? e.message : String(e),
        at: new Date().toISOString(),
      };
      console.warn('Discogs ingest skipped', e);
    }
  }

  window.sendDiscogsIngest = sendDiscogsIngest;

  function wrapPersist() {
    if (typeof persistVinyl !== 'function') {
      setTimeout(wrapPersist, 100);
      return;
    }
    if (persistVinyl.__vertaxDiscogsIngestWrapped) return;
    var basePersistVinyl = persistVinyl;
    persistVinyl = function (v) {
      var result = basePersistVinyl.apply(this, arguments);
      try {
        sendDiscogsIngest(v);
      } catch (_) {}
      return result;
    };
    persistVinyl.__vertaxDiscogsIngestWrapped = true;
    window.persistVinyl = persistVinyl;
  }

  wrapPersist();
})();

/* ============================================================ */ /* EVENT HANDLERS */ /* ============================================================ */ function on(
  action,
  handler
) {
  handlers[action] = handler;
}
var handlers = {};
on('back', function () {
  var v = state.view;
  if (v === 'edit-track') state.view = 'tracklist';
  else if (v === 'fetching') {
    state.ui.fetchProgress.cancelled = true;
    state.view = 'tracklist';
  } else if (v === 'tracklist') state.view = 'add';
  else if (v === 'match') state.view = 'add';
  else if (v === 'runt26-source') state.view = state.ui.runt26PrevView || 'set';
  else if (v === 'live-set') state.view = 'set';
  else if (v === 'set') state.view = 'home';
  else if (v === 'collection') state.view = 'home';
  else if (v === 'discogs-import') state.view = 'home';
  else if (v === 'fit-check') state.view = 'home';
  else if (v === 'dig') state.view = 'home';
  else if (v === 'about') state.view = 'home';
  else if (v === 'add') state.view = 'home';
  else state.view = 'home';
  render();
});
on('go-add', function () {
  state.view = 'add';
  render();
});
on('go-collection', function () {
  state.view = 'collection';
  render();
});
on('goto-discogs-import', function () {
  state.ui.discogsImportLoaded = false;
  state.ui.discogsImportLoading = false;
  state.ui.discogsImportProgress = 0;
  state.ui.discogsImportVinyls = [];
  state.view = 'discogs-import';
  render();
});
on('goto-fit-check', function () {
  state.view = 'fit-check';
  state.ui.fitCheckError = null;
  render();
});
on('open-dig', function () {
  state.view = 'dig';
  state.ui = state.ui || {};
  state.ui.dig = state.ui.dig || { force_show: false, show_all_briefs: false };
  render();
});
on('dig-force-show', function () {
  state.ui = state.ui || {};
  state.ui.dig = state.ui.dig || {};
  state.ui.dig.force_show = true;
  render();
});
on('dig-show-all-briefs', function () {
  state.ui = state.ui || {};
  state.ui.dig = state.ui.dig || {};
  state.ui.dig.show_all_briefs = true;
  render();
});
on('dig-camelot-cell', function (_, el) {
  var cell = el && el.dataset ? el.dataset.camelot : '';
  if (!cell || !document.querySelector) return;
  var card = document.querySelector('.dig-gap-card[data-camelot="' + cell + '"]');
  if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
function digCandidateStatuses() {
  try {
    return JSON.parse(localStorage.getItem('vertax_candidate_status') || '{}') || {};
  } catch (_) {
    return {};
  }
}
function digSetCandidateStatus(id, status) {
  if (!id) return;
  var map = digCandidateStatuses();
  if (!status || status === 'none') delete map[id];
  else map[id] = { status: status, updated_at: new Date().toISOString() };
  try {
    localStorage.setItem('vertax_candidate_status', JSON.stringify(map));
  } catch (_) {}
}
function digClientGenreFamily(value) {
  var text = String(value || '').toLowerCase();
  if (!text) return null;
  if (
    text.indexOf('drum and bass') >= 0 ||
    text.indexOf('drum n bass') >= 0 ||
    text.indexOf('drum & bass') >= 0 ||
    text.indexOf('dnb') >= 0 ||
    text.indexOf('liquid funk') >= 0
  )
    return 'dnb_jungle';
  if (text.indexOf('jungle') >= 0 || text.indexOf('fast breaks') >= 0) return 'jungle_fast_breaks';
  if (text.indexOf('breakcore') >= 0 || text.indexOf('fast dnb') >= 0) return 'fast_dnb_breakcore';
  if (text.indexOf('hardcore') >= 0 || text.indexOf('gabber') >= 0) return 'hardcore_footwork';
  if (text.indexOf('footwork') >= 0 || text.indexOf('juke') >= 0) return 'footwork_juke';
  if (
    text.indexOf('dubstep') >= 0 ||
    text.indexOf('grime') >= 0 ||
    text.indexOf('140') >= 0 ||
    text.indexOf('uk garage') >= 0 ||
    text.indexOf('ukg') >= 0 ||
    text.indexOf('2-step') >= 0 ||
    text.indexOf('bassline') >= 0
  )
    return 'dubstep_grime_ukg';
  if (text.indexOf('electro') >= 0 || text.indexOf('breakbeat') >= 0 || text.indexOf('breaks') >= 0)
    return 'electro_breaks';
  if (text.indexOf('hip hop') >= 0 || text.indexOf('hip-hop') >= 0 || text.indexOf('trip hop') >= 0)
    return 'hiphop_trip_hop_breaks';
  if (
    text.indexOf('downtempo') >= 0 ||
    text.indexOf('halftime') >= 0 ||
    text.indexOf('ambient') >= 0
  )
    return 'downtempo_halftime';
  if (text.indexOf('disco') >= 0) return 'disco_slow_house';
  if (text.indexOf('house') >= 0 || text.indexOf('techno') >= 0) return 'house_and_techno';
  if (
    text.indexOf('idm') >= 0 ||
    text.indexOf('experimental') >= 0 ||
    text.indexOf('leftfield') >= 0
  )
    return 'leftfield';
  if (text.indexOf('garage') >= 0 || text.indexOf('bass') >= 0) return 'bass';
  return 'other';
}
function digCollectionProfile(collection) {
  var labels = {};
  var artists = {};
  var families = {};
  (collection || []).forEach(function (vinyl) {
    if (vinyl.label) labels[vinyl.label] = (labels[vinyl.label] || 0) + 1;
    if (vinyl.artist) artists[vinyl.artist] = (artists[vinyl.artist] || 0) + 1;
    var family = digClientGenreFamily([vinyl.genre, vinyl.style].filter(Boolean).join(' '));
    if (family) families[family] = (families[family] || 0) + 1;
    (vinyl.tracklist || []).forEach(function (track) {
      var trackFamily = digClientGenreFamily(
        [track.genre, track.style, vinyl.genre, vinyl.style].filter(Boolean).join(' ')
      );
      if (trackFamily) families[trackFamily] = (families[trackFamily] || 0) + 1;
    });
  });
  function top(obj, limit) {
    return Object.keys(obj)
      .map(function (name) {
        return { name: name, count: obj[name] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, limit || 8);
  }
  return {
    top_labels: top(labels, 10),
    top_artists: top(artists, 10),
    genre_families: top(families, 4).map(function (item) {
      return item.name;
    }),
  };
}
function digDominantBpmRange(analysis) {
  var rows = (analysis && analysis.bpm_histogram) || [];
  var best = rows.slice().sort(function (a, b) {
    return (b.count || 0) - (a.count || 0);
  })[0];
  return best && best.count ? best.range : null;
}
function digTopCamelots(analysis) {
  var grid = (analysis && analysis.camelot_grid) || {};
  return Object.keys(grid)
    .map(function (camelot) {
      return {
        camelot: camelot,
        count: grid[camelot] && grid[camelot].count ? grid[camelot].count : 0,
      };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    })
    .slice(0, 3)
    .map(function (item) {
      return item.camelot;
    });
}
function digExpansionTargets(analysis, profile) {
  var family = profile && profile.genre_families && profile.genre_families[0];
  var dominantBpm = digDominantBpmRange(analysis);
  var topCamelots = digTopCamelots(analysis).filter(function (item) {
    return item;
  });
  if (!dominantBpm && !topCamelots.length && !family) return [];
  return [
    {
      type: 'expand',
      target_bpm_range: dominantBpm,
      nearby_camelots: topCamelots,
      genre_family: family || null,
      priority: 'context',
    },
  ];
}
function digBuildCandidateGaps(analysis, profile) {
  var family = profile && profile.genre_families && profile.genre_families[0];
  var dominantBpm = digDominantBpmRange(analysis);
  var camelot = ((analysis && analysis.camelot_gaps) || []).slice(0, 6).map(function (gap) {
    return {
      type: 'camelot',
      camelot: gap.camelot,
      priority: gap.priority,
      level: gap.level,
      target_bpm_range: dominantBpm,
      genre_family: family || null,
    };
  });
  var bpm = ((analysis && analysis.bpm_gaps) || []).slice(0, 2).map(function (gap) {
    return {
      type: 'bpm',
      bpm_range: gap.range,
      nearby_camelots: digTopCamelots(analysis),
      genre_family: digClientGenreFamily(gap.genre) || family || null,
    };
  });
  var gaps = camelot.concat(bpm).slice(0, 8);
  return gaps.length ? gaps : digExpansionTargets(analysis, profile);
}
function digExcludedCandidateIds() {
  var statuses = digCandidateStatuses();
  return Object.keys(statuses).filter(function (id) {
    return statuses[id] && (statuses[id].status === 'hidden' || statuses[id].status === 'owned');
  });
}
function digOwnedCandidateIds() {
  var statuses = digCandidateStatuses();
  return Object.keys(statuses).filter(function (id) {
    return statuses[id] && statuses[id].status === 'owned';
  });
}
function digRemoveCandidateFromResult(id) {
  var result = state.ui.dig && state.ui.dig.candidates_result;
  if (!result || !Array.isArray(result.groups)) return;
  result.groups.forEach(function (group) {
    ['strong', 'probable', 'explore'].forEach(function (bucket) {
      group[bucket] = (group[bucket] || []).filter(function (candidate) {
        return String(candidate.discogs_id) !== String(id);
      });
    });
  });
}
on('dig-load-candidates', async function () {
  state.ui = state.ui || {};
  state.ui.dig = state.ui.dig || {};
  var collection = vertaxFlattenCollectionForAnalysis();
  if (!collection.length) {
    state.ui.dig.candidates_error = 'В коллекции пока нет треков для рекомендаций.';
    render();
    return;
  }
  var analysis = computeDigAnalysis(state.collection || []);
  var profile = digCollectionProfile(state.collection || []);
  var gaps = digBuildCandidateGaps(analysis, profile);
  if (!gaps.length) {
    state.ui.dig.candidates_error = 'В коллекции пока мало BPM/Key-данных для подбора кандидатов.';
    render();
    return;
  }
  state.ui.dig.candidates_loading = true;
  state.ui.dig.candidates_error = null;
  render();
  try {
    var hash = await vertaxCollectionHash(collection);
    state.ui.dig.candidates_hash = hash;
    await vertaxSyncCollectionIndex(collection, hash);
    var payload = {
      collection_hash: hash,
      gaps: gaps,
      excluded_ids: digExcludedCandidateIds(),
      owned_ids: digOwnedCandidateIds(),
      limit_per_gap: 6,
      include_explore: false,
      collection_profile: profile,
    };
    var result;
    try {
      result = await vertaxLoadCandidates(payload);
    } catch (e) {
      if (String((e && e.message) || e) !== 'collection_index_missing') throw e;
      await vertaxSyncCollectionIndex(collection, hash);
      result = await vertaxLoadCandidates(payload);
    }
    state.ui.dig.candidates_result = result;
  } catch (error) {
    state.ui.dig.candidates_error =
      'Не удалось найти кандидатов: ' + String((error && error.message) || error);
  } finally {
    state.ui.dig.candidates_loading = false;
    render();
  }
});
on('candidate-wishlist', function (_, el) {
  var card = el && el.closest ? el.closest('[data-discogs-id]') : null;
  var id = card && card.dataset && card.dataset.discogsId;
  if (!id) return;
  digSetCandidateStatus(id, 'wishlist');
  render();
});
on('candidate-hide', function (_, el) {
  var card = el && el.closest ? el.closest('[data-discogs-id]') : null;
  var id = card && card.dataset && card.dataset.discogsId;
  if (!id) return;
  digSetCandidateStatus(id, 'hidden');
  digRemoveCandidateFromResult(id);
  render();
});
on('candidate-owned', function (_, el) {
  var card = el && el.closest ? el.closest('[data-discogs-id]') : null;
  var id = card && card.dataset && card.dataset.discogsId;
  if (!id) return;
  digSetCandidateStatus(id, 'owned');
  digRemoveCandidateFromResult(id);
  render();
});
on('candidate-analyze', function (_, el) {
  var card = el && el.closest ? el.closest('[data-discogs-id]') : null;
  var id = card && card.dataset && card.dataset.discogsId;
  if (!id) return;
  state.view = 'fit-check';
  state.ui.fitCheckError = null;
  state.ui.fitCheckCandidates = [];
  state.ui.fitCheckResult = null;
  render();
  runFitCheck({ releaseId: id });
});
on('go-set', function () {
  if (getAllSessionTracks().length === 0) {
    showToast('Сначала добавь пластинки и треклисты');
    return;
  }
  state.view = 'set';
  state.ui.generatedSet = [];
  render();
});
on('theme-toggle', function () {
  if (typeof toggleVertaxTheme === 'function') {
    toggleVertaxTheme();
  } else if (typeof applyVertaxTheme === 'function') {
    var cur = typeof getVertaxTheme === 'function' ? getVertaxTheme() : 'light';
    applyVertaxTheme(cur === 'dark' ? 'light' : 'dark');
  }
  render();
});
on('open-about', function () {
  state.modal = 'about';
  render();
});
on('open-donate', function () {
  state.modal = 'donate';
  render();
});
on('preview-play', function (e, el) {
  var url = el && el.dataset && el.dataset.sampleUrl;
  if (!url) return;
  if (typeof vertaxPlayPreview === 'function') vertaxPlayPreview(el, url);
});
on('dismiss-tg-suggest', function () {
  try { localStorage.setItem('vertaxTgSuggestDismissed', '1'); } catch (_) {}
  render();
});
on('open-help', function () {
  state.modal = 'help';
  render();
});
on('close-modal', function () {
  state.modal = null;
  render();
});
on('close-modal-bg', function (e) {
  /* Only close if clicking the backdrop, not modal content */ if (
    e.target.classList &&
    e.target.classList.contains('laiso-modal-bg')
  ) {
    state.modal = null;
    render();
  }
});
on('vertax-modal-confirm', function () {
  if (!state.modal || !state.modal.type) return;
  if (state.modal.type === 'prompt') {
    var input = document.getElementById('vertax-prompt-input');
    vertaxResolveRuntimeModal(input ? input.value : '');
    return;
  }
  vertaxResolveRuntimeModal(true);
});
on('vertax-modal-cancel', function () {
  if (!state.modal || !state.modal.type) return;
  vertaxResolveRuntimeModal(state.modal.type === 'confirm' ? false : null);
});
/* ============================================================ */ /* RUNT-01: free-text Discogs search */ /* ============================================================ */ function runDiscogsSearch() {
  var q = (state.ui.searchQuery || '').trim();
  if (!q) {
    showToast('Введите запрос');
    return;
  }
  if (
    typeof vertaxRequireOnline === 'function' &&
    !vertaxRequireOnline('Поиск Discogs требует интернет')
  )
    return;
  if (state.ui.searchLoading) return;
  state.ui.searchLoading = true;
  state.ui.searchError = null;
  state.ui.searchResults = [];
  render();
  discogsSearch({ q: q })
    .then(function (results) {
      state.ui.searchLoading = false;
      state.ui.searchResults = (results || []).slice(0, 6);
      if (state.ui.searchResults.length === 0) {
        state.ui.searchError = 'Ничего не нашлось. Уточни запрос.';
      }
      render();
    })
    .catch(function (err) {
      state.ui.searchLoading = false;
      state.ui.searchError =
        err && err.message === 'rate-limit'
          ? 'Discogs ограничил запросы. Подожди 30 сек.'
          : 'Discogs не отвечает. Проверь интернет.';
      render();
    });
}
on('discogs-search', function () {
  runDiscogsSearch();
});
/* search-input: registered so input/change listeners don't warn; Enter-key */ /* is dispatched by the dedicated keydown listener below. */ on(
  'search-input',
  function () {
    /* no-op; data-bind covers value sync */
  }
);
on('search-pick', async function (_, el) {
  if (state.vinyls.length >= SESSION_LIMIT) {
    showToast('Лимит сессии');
    return;
  }
  var id = el.dataset.id;
  if (!id) return;
  var picked = (state.ui.searchResults || []).find(function (r) {
    return String(r.id) === String(id);
  });
  var titleStr = (picked && picked.title) || '';
  var dashIdx = titleStr.indexOf(' - ');
  var v = newVinyl({
    source: 'search',
    discogsId: parseInt(id, 10) || null,
    artist: dashIdx > -1 ? titleStr.slice(0, dashIdx) : '',
    title: dashIdx > -1 ? titleStr.slice(dashIdx + 3) : titleStr,
    coverUrl: (picked && picked.thumb) || '',
    status: 'awaiting',
  });
  state.vinyls.push(v);
  /* Clear search UI */ state.ui.searchResults = [];
  state.ui.searchQuery = '';
  state.ui.searchError = null;
  render();
  /* Fetch full release → mapDiscogsRelease → fill vinyl */ discogsRelease(parseInt(id, 10))
    .then(function (rel) {
      var mapped = mapDiscogsRelease(rel);
      Object.assign(v, mapped);
      v.status = 'recognized';
      v.confidence = 1;
      persistVinyl(v);
      render();
    })
    .catch(function (err) {
      v.status = 'not_found';
      showToast(
        err && err.message === 'rate-limit' ? 'Discogs rate-limit' : 'Не удалось получить релиз'
      );
      render();
    });
});
function newVinyl(extra) {
  var base = {
    id: uuid(),
    addedAt: Date.now(),
    source: 'manual',
    discogsId: null,
    artist: '',
    title: '',
    label: '',
    catno: '',
    year: null,
    country: '',
    format: '',
    coverUrl: '',
    status: 'awaiting',
    confidence: 0,
    tracklist: [],
  };
  return Object.assign(base, extra || {});
}
/* --- VINYL ACTIONS (menu) --- */ on('toggle-menu', function (e, el) {
  var menu = el.parentElement;
  var open = menu.classList.contains('open');
  document.querySelectorAll('#laiso-app .laiso-menu.open').forEach(function (m) {
    m.classList.remove('open');
  });
  if (!open) menu.classList.add('open');
  e.stopPropagation();
});
function openVinylTracklist(v) {
  if (!v) return;
  state.ui.currentVinylId = v.id;
  var first = v.tracklist && v.tracklist[0];
  state.ui.activeSide = (first && first.side) || 'A';
  state.view = 'tracklist';
  state.modal = null;
  render();
}
async function loadTracklistFromDiscogsVinyl(v) {
  if (!v || !v.discogsId) {
    showToast('У пластинки нет Discogs ID');
    return;
  }
  v._recognizing = true;
  render();
  try {
    var rel = await discogsRelease(v.discogsId);
    var mapped = mapDiscogsRelease(rel);
    var keepId = v.id;
    Object.assign(v, mapped);
    v.id = keepId;
    v.discogsId = String(v.discogsId || mapped.discogsId || '');
    v.status = 'recognized';
    v.confidence = 95;
    v._recognizing = false;
    if (
      !state.collection.find(function (c) {
        return c.id === v.id;
      })
    )
      state.collection.push(v);
    await persistVinyl(v);
    openVinylTracklist(v);
    showToast('Треклист загружен');
  } catch (e) {
    console.warn('load release tracklist error:', e);
    v._recognizing = false;
    showToast('Не удалось загрузить треклист из Discogs');
    render();
  }
}
on('recognize-all', function () {
  var pending = state.vinyls.filter(function (v) {
    return v.status === 'awaiting' || v.status === 'not_found';
  });
  if (pending.length === 0) return;
  if (
    typeof vertaxRequireOnline === 'function' &&
    !vertaxRequireOnline('Распознавание требует интернет')
  )
    return;
  showToast('Распознаём ' + pending.length + '…', 1500);
  (async function () {
    for (var i = 0; i < pending.length; i++) {
      await recognizeVinyl(pending[i]);
      await persistVinyl(pending[i]);
      await new Promise(function (r) {
        setTimeout(r, 250);
      });
    }
  })();
});
on('recognize-one', function (_, el) {
  var v = findVinyl(el.dataset.id);
  if (!v) return;
  if (
    typeof vertaxRequireOnline === 'function' &&
    !vertaxRequireOnline('Распознавание требует интернет')
  )
    return;
  if (v.discogsId) {
    loadTracklistFromDiscogsVinyl(v);
    return;
  }
  v.status = 'awaiting';
  render();
  recognizeVinyl(v).then(function () {
    persistVinyl(v);
  });
});
on('collection-open-vinyl', function (_, el) {
  var v = findVinyl(el.dataset.id);
  if (!v) return;
  openVinylTracklist(v);
});
on('load-release-tracklist', function (_, el) {
  var v = findVinyl(el.dataset.id);
  if (!v) return;
  loadTracklistFromDiscogsVinyl(v);
});
on('open-tracklist', function (_, el) {
  var v = findVinyl(el.dataset.id);
  if (v) {
    openVinylTracklist(v);
    return;
  }
  state.ui.currentVinylId = el.dataset.id;
  state.ui.activeSide = 'A';
  state.view = 'tracklist';
  render();
});
on('resume-match', function (_, el) {
  state.ui.currentVinylId = el.dataset.id;
  state.view = 'match';
  render();
});
on('manual-edit-vinyl', function (_, el) {
  var v = findVinyl(el.dataset.id);
  if (!v) return;
  state.ui.currentVinylId = v.id;
  state.ui.manualVinyl = {
    artist: v.artist,
    title: v.title,
    label: v.label,
    catno: v.catno,
    year: v.year,
    format: v.format,
  };
  state.modal = 'manual-vinyl';
  render();
});
on('save-manual-vinyl', function () {
  var v = findVinyl(state.ui.currentVinylId);
  if (!v) return;
  ['mv-artist', 'mv-title', 'mv-label', 'mv-catno', 'mv-year', 'mv-format'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var key = id.slice(3);
    v[key] = id === 'mv-year' ? parseInt(el.value, 10) || null : el.value;
  });
  if (v.status === 'not_found' || v.status === 'awaiting') v.status = 'manual';
  persistVinyl(v);
  state.modal = null;
  render();
});
on('delete-vinyl', function (_, el) {
  var id = el.dataset.id;
  state.vinyls = state.vinyls.filter(function (v) {
    return v.id !== id;
  });
  state.collection = state.collection.filter(function (v) {
    return v.id !== id;
  });
  deleteVinylFromDb(id);
  render();
});
on('done-add', function () {
  var hasUsable = state.vinyls.some(function (v) {
    return v.status === 'recognized' || v.status === 'manual';
  });
  if (!hasUsable) {
    showToast('Сначала найди и подтверди хотя бы одну пластинку');
    return;
  }
  /* Save session vinyls into collection (if not already there) */ state.vinyls.forEach(
    function (v) {
      if (v.status === 'recognized' || v.status === 'manual') {
        if (
          !state.collection.find(function (c) {
            return c.id === v.id;
          })
        )
          state.collection.push(v);
        persistVinyl(v);
      }
    }
  );
  /* Pick first usable vinyl for tracklist view */ var first = state.vinyls.find(function (v) {
    return v.tracklist && v.tracklist.length;
  });
  if (first) {
    state.ui.currentVinylId = first.id;
    state.view = 'tracklist';
  } else {
    state.view = 'set';
  }
  render();
});
/* --- MATCH --- */ on('match-pick', function (_, el) {
  var idx = parseInt(el.dataset.idx, 10);
  var c = state.ui.candidates[idx];
  var v = findVinyl(state.ui.currentVinylId);
  if (!v || !c) return;
  Object.assign(v, c);
  v.status = 'recognized';
  persistVinyl(v);
  state.ui.candidates = [];
  state.view = 'tracklist';
  state.ui.activeSide = 'A';
  try {
    if (typeof haptic === 'function') haptic('light');
  } catch (_) {}
  render();
});
on('match-retake', function () {
  state.ui.candidates = [];
  state.view = 'add';
  state.modal = 'add-vinyl';
  render();
});
on('match-skip', function () {
  state.ui.candidates = [];
  state.view = 'add';
  render();
});
on('match-manual', function () {
  var v = findVinyl(state.ui.currentVinylId);
  if (!v) return;
  state.ui.manualVinyl = {
    artist: v.artist,
    title: v.title,
    label: v.label,
    catno: v.catno,
    year: v.year,
    format: v.format,
  };
  state.modal = 'manual-vinyl';
  render();
});
/* --- TRACKLIST --- */ on('side-tab', function (_, el) {
  state.ui.activeSide = el.dataset.side;
  render();
});
on('edit-track', function (_, el) {
  state.ui.currentTrackId = el.dataset.id;
  state.view = 'edit-track';
  render();
});
on('rename-track', async function (_, el) {
  var v = findVinyl(state.ui.currentVinylId);
  var t = v && findTrack(v, el.dataset.id);
  if (!t) return;
  var name = await vertaxPrompt('Название трека:', t.title || '');
  if (name !== null) {
    t.title = name;
    persistVinyl(v);
    render();
  }
});
on('change-side', async function (_, el) {
  var v = findVinyl(state.ui.currentVinylId);
  var t = v && findTrack(v, el.dataset.id);
  if (!t) return;
  var s = await vertaxPrompt('Сторона (A / B / C / D / E / F):', t.side || 'A');
  if (s) {
    s = s.toUpperCase().charAt(0);
    if (/^[A-F]$/.test(s)) {
      t.side = s;
      t.position = s + (t.position || '').replace(/^[A-F]+/i, '');
      persistVinyl(v);
      render();
    }
  }
});
on('delete-track', function (_, el) {
  var v = findVinyl(state.ui.currentVinylId);
  if (!v) return;
  v.tracklist = v.tracklist.filter(function (t) {
    return t.id !== el.dataset.id;
  });
  persistVinyl(v);
  render();
});
function parseManualKeyInput(value) {
  var raw = String(value || '').trim();
  if (!raw) return { key: null, camelot: null };
  if (/^\d{1,2}[AB]$/i.test(raw)) {
    var cam = raw.toUpperCase();
    return {
      key: typeof CAMELOT_TO_KEY !== 'undefined' && CAMELOT_TO_KEY[cam] ? CAMELOT_TO_KEY[cam] : cam,
      camelot: cam,
    };
  }
  var normalized = null;
  if (typeof normalizeKeyName === 'function') normalized = normalizeKeyName(raw);
  if (!normalized && typeof normalizeKey === 'function') normalized = normalizeKey(raw);
  if (normalized) {
    return {
      key: normalized,
      camelot:
        typeof KEY_TO_CAMELOT !== 'undefined' && KEY_TO_CAMELOT[normalized]
          ? KEY_TO_CAMELOT[normalized]
          : null,
    };
  }
  return { key: raw, camelot: null };
}
function nextPositionForSide(vinyl, side) {
  var nums = (vinyl.tracklist || [])
    .filter(function (t) {
      return String(t.side || '').toUpperCase() === side;
    })
    .map(function (t) {
      return parseInt(String(t.position || '').replace(/[^0-9]/g, ''), 10) || 0;
    });
  var next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  return side + next;
}
on('add-track-blank', async function () {
  var v = findVinyl(state.ui.currentVinylId);
  if (!v) return;
  var activeSide = (state.ui.activeSide || 'A').toUpperCase().charAt(0);
  if (!/^[A-F]$/.test(activeSide)) activeSide = 'A';
  var title = await vertaxPrompt('Название трека:', '');
  if (title === null) return;
  title = title.trim();
  if (!title) {
    showToast('Название трека не указано');
    return;
  }
  var posDefault = nextPositionForSide(v, activeSide);
  var pos = await vertaxPrompt('Позиция на пластинке (например A1, B2):', posDefault);
  if (pos === null) return;
  pos = String(pos || posDefault)
    .trim()
    .toUpperCase();
  if (!/^[A-F]\d*$/i.test(pos)) pos = posDefault;
  var parsedPos = parsePos(pos);
  var bpm = null;
  var bpmStr = await vertaxPrompt('BPM (можно оставить пустым):', '');
  if (bpmStr !== null && String(bpmStr).trim() !== '') {
    var n = parseInt(String(bpmStr).trim(), 10);
    if (!isNaN(n) && n >= 50 && n <= 220) bpm = n;
    else showToast('BPM не сохранён: значение должно быть примерно 50–220');
  }
  var key = null;
  var camelot = null;
  var keyStr = await vertaxPrompt('Key или Camelot (например 8A, 7B, D minor; можно пусто):', '');
  if (keyStr !== null && String(keyStr).trim() !== '') {
    var parsedKey = parseManualKeyInput(keyStr);
    key = parsedKey.key;
    camelot = parsedKey.camelot;
  }
  var t = {
    id: uuid(),
    position: parsedPos.raw || posDefault,
    side: parsedPos.side || activeSide,
    title: title,
    duration: '',
    bpm: bpm,
    key: key,
    camelot: camelot,
    bpmSource: bpm ? 'manual' : null,
    keySource: key || camelot ? 'manual' : null,
    confidence: bpm && (key || camelot) ? 'medium' : 'manual',
    comment: null,
    metaStatus: bpm || key || camelot ? 'manual' : null,
  };
  v.tracklist = v.tracklist || [];
  v.tracklist.push(t);
  state.ui.activeSide = t.side;
  state.ui.currentTrackId = t.id;
  if (typeof persistVinyl === 'function') persistVinyl(v);
  showToast('Трек добавлен');
  render();
});
on('confirm-tracklist', function () {
  var v = findVinyl(state.ui.currentVinylId);
  if (!v) return;
  if (
    !state.collection.find(function (c) {
      return c.id === v.id;
    })
  )
    state.collection.push(v);
  persistVinyl(v);
  /* Identify tracks that still need metadata */ var pending = (v.tracklist || []).filter(
    function (t) {
      return (
        !t.excludeFromSets &&
        !t.bpm &&
        !t.camelot &&
        !t.key &&
        t.title &&
        t.metaStatus !== 'not_found'
      );
    }
  );
  if (pending.length === 0) {
    proceedAfterTracklist(v);
    return;
  }
  state.ui.fetchProgress = {
    vinylId: v.id,
    total: pending.length,
    doneCount: 0,
    cancelled: false,
    complete: false,
    items: pending.map(function (t) {
      return { trackId: t.id, title: t.title, artist: v.artist, status: 'pending', meta: null };
    }),
  };
  state.view = 'fetching';
  render();
  runMetadataFetch(v);
});
async function runMetadataFetch(vinyl) {
  var fp = state.ui.fetchProgress;
  for (var i = 0; i < fp.items.length; i++) {
    if (fp.cancelled) break;
    var item = fp.items[i];
    var track = findTrack(vinyl, item.trackId);
    if (!track) {
      item.status = 'skipped';
      fp.doneCount++;
      render();
      continue;
    }
    item.status = 'fetching';
    render();
    try {
      var meta = await fetchTrackMetadata(track, vinyl);
      if (meta && (meta.bpm || meta.camelot || meta.key)) {
        if (meta.bpm) track.bpm = meta.bpm;
        if (meta.key) track.key = meta.key;
        if (meta.camelot) track.camelot = meta.camelot;
        else if (meta.key && KEY_TO_CAMELOT[meta.key]) track.camelot = KEY_TO_CAMELOT[meta.key];
        track.bpmSource = meta.source || 'manual';
        track.keySource = meta.source || 'manual';
        track.confidence = meta.confidence || 'medium';
        track.halftimeCorrected = !!meta.halftimeCorrected;
        track.originalBpm = meta.originalBpm || null;
        track.conflict = meta.conflict || null;
        track.metaStatus = 'found';
        item.status = 'ok';
        item.meta = meta;
      } else {
        track.metaStatus = 'not_found';
        item.status = 'notfound';
      }
    } catch (e) {
      console.warn('fetch meta error', e);
      track.metaStatus = 'not_found';
      item.status = 'error';
    }
    fp.doneCount++;
    try {
      await persistVinyl(vinyl);
    } catch (_) {}
    render();
    if (i < fp.items.length - 1 && !fp.cancelled) await sleep(FETCH_DELAY_MS);
  }
  fp.complete = true;
  render();
}
function proceedAfterTracklist(v) {
  var idx = state.vinyls.findIndex(function (x) {
    return x.id === v.id;
  });
  var next = state.vinyls.slice(idx + 1).find(function (x) {
    return x.tracklist && x.tracklist.length;
  });
  if (next) {
    state.ui.currentVinylId = next.id;
    state.ui.activeSide = 'A';
    state.view = 'tracklist';
    render();
  } else {
    state.view = 'set';
    render();
    showToast('Все треклисты подтверждены');
  }
}
on('skip-remaining', function () {
  state.ui.fetchProgress.cancelled = true;
  var v = findVinyl(state.ui.fetchProgress.vinylId);
  setTimeout(function () {
    if (v) {
      state.ui.currentVinylId = v.id;
      state.view = 'tracklist';
    } else state.view = 'add';
    render();
    showToast('Дальше — ручной ввод BPM/Key', 2400);
  }, 120);
});
on('fetching-done', function () {
  var fp = state.ui.fetchProgress || {};
  var v = findVinyl(fp.vinylId);
  if (v && fp.items) {
    fp.items.forEach(function (it) {
      var t = findTrack(v, it.trackId);
      if (t && (it.status === 'notfound' || it.status === 'error')) t.metaStatus = 'not_found';
    });
    persistVinyl(v);
  }
  if (v) {
    state.ui.currentVinylId = v.id;
    state.view = 'tracklist';
  } else {
    state.view = 'add';
  }
  showToast('Открой меню трека ⋯ или введи BPM/Key вручную');
  render();
});
on('bpm-revert-halftime', function () {
  var p = getEditTrackPair();
  if (!p.t || !p.t.halftimeCorrected || !p.t.originalBpm) return;
  p.t.bpm = p.t.originalBpm;
  p.t.halftimeCorrected = false;
  p.t.originalBpm = null;
  persistVinyl(p.v);
  render();
});
on('use-conflict-bpm', function (_, el) {
  var p = getEditTrackPair();
  if (!p.t || !p.t.conflict) return;
  var src = el.dataset.src;
  p.t.bpm = src === 'getsongbpm' ? p.t.conflict.getsongbpm : p.t.conflict.acousticbrainz;
  var k = src === 'getsongbpm' ? p.t.conflict.getsongbpmKey : p.t.conflict.acousticbrainzKey;
  if (k) {
    p.t.key = k;
    p.t.camelot = KEY_TO_CAMELOT[k] || p.t.camelot;
  }
  p.t.bpmSource = src;
  p.t.keySource = src;
  p.t.confidence = 'high';
  p.t.conflict = null;
  persistVinyl(p.v);
  render();
});
/* --- EDIT TRACK --- */ function getEditTrackPair() {
  var v = findVinyl(state.ui.currentVinylId);
  return { v: v, t: v && findTrack(v, state.ui.currentTrackId) };
}
function clearAutoMeta(t) {
  /* User edited the value — drop halftime memo and conflict; surface as manual */ t.halftimeCorrected = false;
  t.originalBpm = null;
  t.conflict = null;
}
on('bpm-step', function (_, el) {
  var p = getEditTrackPair();
  if (!p.t) return;
  var d = parseInt(el.dataset.d, 10) || 0;
  var v = (p.t.bpm || 120) + d;
  if (v < 40) v = 40;
  if (v > 240) v = 240;
  p.t.bpm = v;
  p.t.bpmSource = 'manual';
  clearAutoMeta(p.t);
  render();
});
on('bpm-input', function (e, el) {
  var p = getEditTrackPair();
  if (!p.t) return;
  var v = parseInt(el.value, 10);
  p.t.bpm = isNaN(v) ? null : Math.max(40, Math.min(240, v));
  p.t.bpmSource = 'manual';
  clearAutoMeta(
    p.t
  ); /* Don't re-render on input change to avoid losing focus; user sees LCD on save/blur */
});
on('bpm-double', function () {
  var p = getEditTrackPair();
  if (!p.t || !p.t.bpm) return;
  p.t.bpm = Math.min(240, p.t.bpm * 2);
  p.t.bpmSource = 'manual';
  clearAutoMeta(p.t);
  render();
});
on('key-change', function (e, el) {
  var p = getEditTrackPair();
  if (!p.t) return;
  var k = el.value;
  p.t.key = k || null;
  p.t.camelot = k ? KEY_TO_CAMELOT[k] : null;
  p.t.keySource = 'manual';
  p.t.bpmSource = 'manual';
  clearAutoMeta(p.t);
  render();
});
on('cam-change', function (e, el) {
  var p = getEditTrackPair();
  if (!p.t) return;
  var c = el.value;
  p.t.camelot = c || null;
  if (c && CAMELOT_TO_KEY[c]) p.t.key = CAMELOT_TO_KEY[c];
  p.t.keySource = 'manual';
  p.t.bpmSource = 'manual';
  clearAutoMeta(p.t);
  render();
});
on('src-toggle', function (_, el) {
  var p = getEditTrackPair();
  if (!p.t) return;
  p.t.bpmSource = el.dataset.src;
  p.t.keySource = el.dataset.src;
  render();
});
on('track-save', function () {
  var p = getEditTrackPair();
  if (!p.t) return;
  var bpmEl = document.getElementById('et-bpm');
  if (bpmEl) {
    var v = parseInt(bpmEl.value, 10);
    if (!isNaN(v)) p.t.bpm = Math.max(40, Math.min(240, v));
    else if (bpmEl.value === '') p.t.bpm = null;
  }
  var commentEl = document.getElementById('et-comment');
  if (commentEl) p.t.comment = commentEl.value || null;
  p.t.confidence = p.t.bpm && p.t.key ? 'high' : p.t.bpm || p.t.key ? 'medium' : 'manual';
  persistVinyl(p.v);
  state.view = 'tracklist';
  showToast('Сохранено');
  render();
});
on('track-cancel', function () {
  state.view = 'tracklist';
  render();
});
on('track-delete', function () {
  var p = getEditTrackPair();
  if (!p.v || !p.t) return;
  p.v.tracklist = p.v.tracklist.filter(function (x) {
    return x.id !== p.t.id;
  });
  persistVinyl(p.v);
  state.view = 'tracklist';
  render();
});
/* --- BPM ×2 / ÷2 (DnB half-time correction, manual) --- */ /* Generic: looks up vinyl + track via data-vid / data-tid */ function findTrackPairByEl(
  el
) {
  var vid = el.dataset.vid,
    tid = el.dataset.tid;
  var v = findVinyl(vid);
  var t = v && findTrack(v, tid);
  return { v: v, t: t };
}
on('bpm-x2', function (_, el) {
  var p = findTrackPairByEl(el);
  if (!p.t || !p.t.bpm) return;
  p.t.originalBpm = p.t.bpm;
  p.t.bpm = p.t.bpm * 2;
  p.t.halftimeCorrected = true;
  p.t.bpmSource = (p.t.bpmSource || 'manual') + '_x2';
  if (p.t.bpmSource.indexOf('manual') < 0) p.t.bpmSource = 'manual_x2';
  persistVinyl(p.v);
  showToast('×2 применено: ' + p.t.originalBpm + ' → ' + p.t.bpm);
  render();
});
on('bpm-divide-2', function (_, el) {
  var p = findTrackPairByEl(el);
  if (!p.t) return;
  if (p.t.originalBpm) {
    /* Restore */ p.t.bpm = p.t.originalBpm;
    p.t.originalBpm = null;
    p.t.halftimeCorrected = false;
    if (p.t.bpmSource) p.t.bpmSource = p.t.bpmSource.replace('_x2', '');
  } else if (p.t.bpm) {
    p.t.originalBpm = p.t.bpm;
    p.t.bpm = Math.round(p.t.bpm / 2);
    p.t.halftimeCorrected = true;
    p.t.bpmSource = 'manual_div2';
  }
  persistVinyl(p.v);
  render();
});
/* --- TRACK / VINYL EXCLUSION FROM SETS --- */ on('track-toggle-exclude', function (_, el) {
  var p = findTrackPairByEl(el);
  if (!p.t) return;
  p.t.excludeFromSets = !p.t.excludeFromSets;
  persistVinyl(p.v);
  showToast(p.t.excludeFromSets ? 'Трек скрыт из сетов' : 'Трек снова в сетах');
  render();
});
on('vinyl-toggle-exclude', function (_, el) {
  var v = findVinyl(el.dataset.vid);
  if (!v) return;
  v.excludeFromSets = !v.excludeFromSets;
  persistVinyl(v);
  showToast(v.excludeFromSets ? 'Пластинка скрыта из сетов' : 'Пластинка снова в сетах');
  render();
});
on('vinyl-remove-session', async function (_, el) {
  var vid = el.dataset.vid;
  if (
    !(await vertaxConfirm(
      'Удалить пластинку из сессии? (Останется в коллекции, если уже сохранена.)'
    ))
  )
    return;
  state.vinyls = state.vinyls.filter(function (v) {
    return v.id !== vid;
  });
  render();
});
/* --- MANUAL BPM/KEY ENTRY (from set-data panel or tracklist) --- */ on(
  'track-manual-meta',
  async function (_, el) {
    var p = findTrackPairByEl(el);
    if (!p.t) return;
    var bpmStr = await vertaxPrompt('BPM (60–200) или пусто:', p.t.bpm || '');
    if (bpmStr !== null && bpmStr !== '') {
      var n = parseInt(bpmStr, 10);
      if (!isNaN(n) && n >= 60 && n <= 200) {
        p.t.bpm = n;
        p.t.bpmSource = 'manual';
        p.t.originalBpm = null;
        p.t.halftimeCorrected = false;
      }
    } else if (bpmStr === '') {
      p.t.bpm = null;
      p.t.bpmSource = null;
    }
    var keyStr = await vertaxPrompt('Key (например 8A, Am, F#m) или пусто:', p.t.key || '');
    if (keyStr !== null) {
      var k = keyStr.trim();
      if (k) {
        var nk = normalizeKey(k);
        p.t.key = nk || k;
        p.t.camelot = nk
          ? KEY_TO_CAMELOT[nk]
          : k.match(/^[0-9]{1,2}[AB]$/i)
            ? k.toUpperCase()
            : null;
        p.t.keySource = 'manual';
      } else {
        p.t.key = null;
        p.t.camelot = null;
        p.t.keySource = null;
      }
    }
    p.t.confidence = p.t.bpm && p.t.key ? 'medium' : p.t.bpm || p.t.key ? 'medium' : 'manual';
    persistVinyl(p.v);
    showToast('Сохранено');
    render();
  }
);

/* --- SET --- */ on('set-mode', function (_, el) {
  state.ui.setMode = el.dataset.mode;
  state.ui.generatedSet = [];
  state.ui.setLastWarning = null;
  render();
});
on('set-tempo', function (_, el) {
  state.ui.setOptions.tempoRange = parseInt(el.dataset.n, 10);
  render();
});
on('set-energy', function (_, el) {
  state.ui.setOptions.energyShape = el.dataset.s;
  render();
});
on('wheel-pick', function (_, el) {
  if (state.ui.setMode === 'camelot-filter') {
    /* Multi-select for camelot-filter mode */ var code = el.dataset.code;
    state.ui.setOptions.camelotSet = state.ui.setOptions.camelotSet || {};
    if (state.ui.setOptions.camelotSet[code]) delete state.ui.setOptions.camelotSet[code];
    else state.ui.setOptions.camelotSet[code] = true;
  } else {
    state.ui.setOptions.targetCamelot =
      state.ui.setOptions.targetCamelot === el.dataset.code ? null : el.dataset.code;
  }
  render();
});
on('camelot-filter-clear', function () {
  state.ui.setOptions.camelotSet = {};
  state.ui.generatedSet = [];
  render();
});
on('camelot-filter-apply', function () {
  /* Trigger generate with camelot-filter mode */ state.ui.setMode = 'camelot-filter';
  handlers['set-generate']();
});
on('toggle-data-panel', function () {
  state.ui.setOpenDataPanel = !state.ui.setOpenDataPanel;
  render();
});
on('set-generate', function () {
  state.ui.setLastWarning = null;
  var allTracks = getAllSessionTracks();
  var mode = state.ui.setMode;
  var tracks = allTracks.filter(function (t) {
    if (mode === 'tempo-safe' || mode === 'best-flow') return !!t.bpm;
    if (mode === 'camelot-safe') return !!t.camelot;
    if (mode === 'camelot-filter') {
      var s = state.ui.setOptions.camelotSet || {};
      return t.camelot && s[t.camelot];
    }
    return true;
  });
  if (allTracks.length === 0) {
    state.ui.setLastWarning = 'no-tracks';
    showToast('Сначала добавь пластинки и треклисты');
    render();
    return;
  }
  if (tracks.length < 2) {
    state.ui.setLastWarning = 'not-enough-data';
    state.ui.setOpenDataPanel = true;
    showToast('Недостаточно данных для этого режима');
    render();
    return;
  }
  var result = generateSetAlgo(tracks, mode, state.ui.setOptions, SET_LENGTH);
  state.ui.generatedSet = result;
  if (result.length < 2) {
    state.ui.setLastWarning = 'no-valid-set';
    showToast('Не удалось собрать сет — попробуй другой режим или ослабь фильтры', 3500);
  } else if (result.length < SET_LENGTH) {
    state.ui.setLastWarning = 'short-set';
    showToast('Собрано ' + result.length + ' трек(ов). Добавь данных для длиннее сета.', 3500);
  }
  render();
});
on('set-export', function () {
  dedupeGeneratedSet();
  var s = state.ui.generatedSet;
  if (!s.length) return;
  var modeNames = {
    'tempo-safe': 'ПО ТЕМПУ',
    'camelot-safe': 'ПО CAMELOT',
    'best-flow': 'BEST FLOW',
    'camelot-filter': 'ФИЛЬТР CAMELOT',
    'energy-flow': 'ENERGY',
    'vinyl-practical': 'VINYL',
  };
  var lines = [
    'RUNT-01 — СЕТ',
    'Режим: ' + (modeNames[state.ui.setMode] || state.ui.setMode),
    new Date().toISOString().slice(0, 19).replace('T', ' '),
    '',
  ];
  s.forEach(function (t, i) {
    var pos = t.displayPosition || t.position || '';
    var posTag = pos ? '[' + pos + '] ' : '';
    var bpmStr = t.bpm ? t.bpm + ' BPM' : '— BPM';
    if (t.originalBpm && t.bpmSource && t.bpmSource.indexOf('x2') >= 0)
      bpmStr += ' (исходно ' + t.originalBpm + ' ×2)';
    var keyStr = t.key || '—';
    var camStr = t.camelot || '—';
    var catno = t.vinylCatno ? ' / ' + t.vinylCatno : '';
    lines.push(
      i +
        1 +
        '. ' +
        posTag +
        (t.title || '—') +
        '\n ' +
        (t.vinylArtist || '') +
        ' — ' +
        (t.vinylTitle || '') +
        catno +
        '\n ' +
        bpmStr +
        ' | Key: ' +
        keyStr +
        ' | Camelot: ' +
        camStr
    );
  });
  var blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'runt01-set-' + Date.now() + '.txt';
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 200);
  showToast('Сет экспортирован');
});
on('set-save', async function () {
  dedupeGeneratedSet();
  var s = state.ui.generatedSet;
  if (!s.length) return;
  var name = await vertaxPrompt(
    'Имя сета:',
    'Сет ' + new Date().toISOString().slice(0, 16).replace('T', ' ')
  );
  if (!name) return;
  var setObj = {
    id: uuid(),
    name: name,
    createdAt: Date.now(),
    mode: state.ui.setMode,
    options: Object.assign({}, state.ui.setOptions),
    tracks: s.map(function (t, i) {
      return {
        trackId: t.id,
        vinylId: t.recordId,
        recordKey: t.recordKey || '',
        position: i + 1,
        snapshot: {
          title: t.title,
          bpm: t.bpm,
          key: t.key,
          camelot: t.camelot,
          originalBpm: t.originalBpm || null,
          bpmSource: t.bpmSource || null,
          vinylTitle: t.vinylTitle,
          vinylArtist: t.vinylArtist,
          vinylPosition: t.position,
          displayPosition: t.displayPosition,
          vinylCatno: t.vinylCatno || '',
          recordKey: t.recordKey || '',
        },
      };
    }),
  };
  state.sets.push(setObj);
  persistSet(setObj);
  showToast('Сет сохранён');
  render();
});
on('set-load', function (_, el) {
  var s = state.sets.find(function (x) {
    return x.id === el.dataset.id;
  });
  if (!s) return;
  state.ui.setMode = s.mode;
  state.ui.setOptions = Object.assign(
    { tempoRange: 4, targetCamelot: null, energyShape: 'smooth', camelotSet: {} },
    s.options || {}
  );
  state.ui.generatedSet = (s.tracks || []).map(function (t) {
    var sn = t.snapshot || {};
    return {
      id: t.trackId,
      recordId: t.vinylId,
      recordKey: sn.recordKey || t.recordKey || t.vinylId,
      position: sn.vinylPosition,
      displayPosition: sn.displayPosition || sn.vinylPosition,
      title: sn.title,
      bpm: sn.bpm,
      key: sn.key,
      camelot: sn.camelot,
      originalBpm: sn.originalBpm || null,
      bpmSource: sn.bpmSource || null,
      vinylTitle: sn.vinylTitle,
      vinylArtist: sn.vinylArtist,
      vinylCatno: sn.vinylCatno || '',
    };
  });
  state.view = 'set';
  render();
});
on('set-delete', async function (_, el) {
  if (!(await vertaxConfirm('Удалить этот сет?'))) return;
  state.sets = state.sets.filter(function (x) {
    return x.id !== el.dataset.id;
  });
  deleteSetFromDb(el.dataset.id);
  render();
});
on('collection-jump-sets', function () {
  var section = document.getElementById('laiso-sets-section');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
});
/* --- COLLECTION SEARCH / SORT / JSON --- */ on('collection-search', function (e, el) {
  state.ui.collectionFilter = el.value;
  /* rerender after small delay to keep input focus */ if (state._searchT)
    clearTimeout(state._searchT);
  state._searchT = setTimeout(function () {
    var pos = el.selectionStart;
    render();
    var newEl = document.querySelector('input[data-action="collection-search"]');
    if (newEl) {
      newEl.focus();
      newEl.setSelectionRange(pos, pos);
    }
  }, 180);
});
on('collection-sort', function (_, el) {
  state.ui.collectionSort = el.dataset.mode || 'recent';
  render();
});
on('export-json', function () {
  var data = { vinyls: state.collection, sets: state.sets, exportedAt: Date.now(), version: 1 };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'laiso-buck-' + Date.now() + '.json';
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 200);
  showToast('Коллекция экспортирована');
});
on('import-json', function () {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = async function () {
      try {
        var data = JSON.parse(fr.result);
        var imported = 0;
        if (data.vinyls && Array.isArray(data.vinyls)) {
          for (var i = 0; i < data.vinyls.length; i++) {
            var v = data.vinyls[i];
            if (!v.id) continue;
            if (
              !state.collection.find(function (c) {
                return c.id === v.id;
              })
            )
              state.collection.push(v);
            await persistVinyl(v);
            imported++;
          }
        }
        if (data.sets && Array.isArray(data.sets)) {
          for (var j = 0; j < data.sets.length; j++) {
            var s = data.sets[j];
            if (!s.id) continue;
            if (
              !state.sets.find(function (x) {
                return x.id === s.id;
              })
            )
              state.sets.push(s);
            await persistSet(s);
          }
        }
        showToast(
          'Импортировано: ' +
            imported +
            ' пластинок + ' +
            (data.sets ? data.sets.length : 0) +
            ' сетов'
        );
        state.view = 'collection';
        render();
      } catch (err) {
        showToast('Файл JSON некорректен');
      }
    };
    fr.readAsText(file);
  };
  input.click();
});
async function loadDiscogsImport() {
  var input = document.getElementById('discogs-import-username');
  var username = ((input && input.value) || state.ui.discogsImportUsername || '').trim();
  if (!username) {
    showToast('Введите Discogs username');
    return;
  }
  if (
    typeof vertaxRequireOnline === 'function' &&
    !vertaxRequireOnline('Импорт Discogs требует интернет')
  )
    return;
  state.ui.discogsImportUsername = username;
  state.ui.discogsImportLoading = true;
  state.ui.discogsImportLoaded = false;
  state.ui.discogsImportProgress = 0;
  state.ui.discogsImportVinyls = [];
  render();
  try {
    var first = await discogsCollectionPage(username, 1);
    var pages = first.pagination && first.pagination.pages ? first.pagination.pages : 1;
    var releases = first.releases || [];
    state.ui.discogsImportProgress = releases.filter(isDiscogsVinylCollectionItem).length;
    render();
    for (var page = 2; page <= pages; page++) {
      var data = await discogsCollectionPage(username, page);
      releases = releases.concat(data.releases || []);
      state.ui.discogsImportProgress = releases.filter(isDiscogsVinylCollectionItem).length;
      render();
    }
    state.ui.discogsImportVinyls = releases
      .filter(isDiscogsVinylCollectionItem)
      .map(mapDiscogsCollectionRelease)
      .filter(function (v) {
        return v.discogsId && v.title;
      });
    state.ui.discogsImportProgress = state.ui.discogsImportVinyls.length;
    state.ui.discogsImportLoaded = true;
  } catch (e) {
    console.warn('discogs import error', e);
    state.ui.discogsImportVinyls = [];
    state.ui.discogsImportLoaded = false;
    showToast(
      'Не удалось загрузить коллекцию. Проверьте username и настройки приватности в Discogs.',
      5000
    );
  }
  state.ui.discogsImportLoading = false;
  render();
}
async function replaceDiscogsImport() {
  var vinyls = state.ui.discogsImportVinyls || [];
  if (!vinyls.length) return;
  await dbClear('vinyls');
  for (var i = 0; i < vinyls.length; i++) await dbPut('vinyls', vinyls[i]);
  state.collection = vinyls.slice();
  state.vinyls = [];
  state.ui.discogsImportLoaded = false;
  state.ui.discogsImportVinyls = [];
  showToast('Импортировано пластинок: ' + vinyls.length);
  var doEnrich = !!state.ui.discogsImportFetchTracks;
  var fetchMeta = !!state.ui.discogsImportFetchMeta;
  if (doEnrich) {
    await enrichImportedVinyls(state.collection.slice(), { fetchMeta: fetchMeta });
  }
  state.view = 'collection';
  render();
}
async function mergeDiscogsImport() {
  var vinyls = state.ui.discogsImportVinyls || [];
  if (!vinyls.length) return;
  var current = await dbGetAll('vinyls');
  var seen = {};
  current.forEach(function (v) {
    if (v && v.discogsId) seen[String(v.discogsId)] = true;
  });
  var added = 0,
    skipped = 0;
  var newVinyls = [];
  for (var i = 0; i < vinyls.length; i++) {
    var v = vinyls[i];
    if (v.discogsId && seen[String(v.discogsId)]) {
      skipped++;
      continue;
    }
    if (v.discogsId) seen[String(v.discogsId)] = true;
    await dbPut('vinyls', v);
    current.push(v);
    newVinyls.push(v);
    added++;
  }
  state.collection = current;
  state.vinyls = [];
  state.ui.discogsImportLoaded = false;
  state.ui.discogsImportVinyls = [];
  showToast('Добавлено: ' + added + ' пластинок. Пропущено дублей: ' + skipped + '.');
  var doEnrich = !!state.ui.discogsImportFetchTracks;
  var fetchMeta = !!state.ui.discogsImportFetchMeta;
  if (doEnrich && newVinyls.length) {
    await enrichImportedVinyls(newVinyls, { fetchMeta: fetchMeta });
  }
  state.view = 'collection';
  render();
}
function cancelDiscogsImport() {
  state.ui.discogsImportLoading = false;
  state.ui.discogsImportLoaded = false;
  state.ui.discogsImportProgress = 0;
  state.ui.discogsImportVinyls = [];
  render();
}
async function enrichImportedVinyls(vinyls, opts) {
  if (!vinyls || !vinyls.length) return;
  opts = opts || {};
  state.ui.discogsImportEnrichStage = 'tracks';
  state.ui.discogsImportEnrichDone = 0;
  state.ui.discogsImportEnrichTotal = vinyls.length;
  state.ui.discogsImportEnrichCancel = false;
  state.view = 'discogs-import';
  render();
  for (var i = 0; i < vinyls.length; i++) {
    if (state.ui.discogsImportEnrichCancel) break;
    var v = vinyls[i];
    if (v.discogsId) {
      try {
        var rel = await discogsRelease(v.discogsId);
        var mapped = mapDiscogsRelease(rel);
        if (mapped) {
          if (mapped.genre) v.genre = mapped.genre;
          if (mapped.style) v.style = mapped.style;
          if (mapped.tracklist && mapped.tracklist.length) {
            v.tracklist = mapped.tracklist;
            v.status = 'recognized';
          }
          await persistVinyl(v);
        }
      } catch (e) {
        console.warn('discogs enrich tracks failed for', v.discogsId, e);
      }
    }
    state.ui.discogsImportEnrichDone++;
    render();
    if (i < vinyls.length - 1) await sleep(700);
  }
  if (opts.fetchMeta && !state.ui.discogsImportEnrichCancel) {
    var pairs = [];
    vinyls.forEach(function (v) {
      if (v.tracklist && v.tracklist.length)
        v.tracklist.forEach(function (t) {
          pairs.push({ track: t, vinyl: v });
        });
    });
    state.ui.discogsImportEnrichStage = 'meta';
    state.ui.discogsImportEnrichDone = 0;
    state.ui.discogsImportEnrichTotal = pairs.length;
    render();
    for (var j = 0; j < pairs.length; j++) {
      if (state.ui.discogsImportEnrichCancel) break;
      var pair = pairs[j];
      try {
        var meta = await fetchTrackMetadata(pair.track, pair.vinyl);
        if (meta) {
          if (meta.bpm && !pair.track.bpm) pair.track.bpm = meta.bpm;
          if (meta.key && !pair.track.key) {
            pair.track.key = meta.key;
            pair.track.camelot = KEY_TO_CAMELOT[meta.key] || pair.track.camelot;
          }
          if (meta.bpmSource) pair.track.bpmSource = meta.bpmSource;
          if (meta.originalBpm) pair.track.originalBpm = meta.originalBpm;
          await persistVinyl(pair.vinyl);
        }
      } catch (e) {
        console.warn('discogs enrich meta failed', e);
      }
      state.ui.discogsImportEnrichDone++;
      if (j % 4 === 0) render();
      if (j < pairs.length - 1) await sleep(FETCH_DELAY_MS);
    }
  }
  var wasCancel = state.ui.discogsImportEnrichCancel;
  state.ui.discogsImportEnrichStage = null;
  state.ui.discogsImportEnrichDone = 0;
  state.ui.discogsImportEnrichTotal = 0;
  state.ui.discogsImportEnrichCancel = false;
  showToast(wasCancel ? 'Прервано' : 'Готово');
  render();
}
on('discogs-import-load', function () {
  loadDiscogsImport();
});
on('discogs-import-replace', function () {
  replaceDiscogsImport();
});
on('discogs-import-merge', function () {
  mergeDiscogsImport();
});
on('discogs-import-cancel', function () {
  cancelDiscogsImport();
});
on('toggle-discogs-fetch-tracks', function (e, el) {
  state.ui.discogsImportFetchTracks = !!(el && el.checked);
  if (!state.ui.discogsImportFetchTracks) state.ui.discogsImportFetchMeta = false;
  render();
});
on('toggle-discogs-fetch-meta', function (e, el) {
  if (!state.ui.discogsImportFetchTracks) return;
  state.ui.discogsImportFetchMeta = !!(el && el.checked);
  render();
});
on('discogs-enrich-cancel', function () {
  state.ui.discogsImportEnrichCancel = true;
});
async function runFitCheck(opts) {
  opts = opts || {};
  var query = String(state.ui.fitCheckQuery || '').trim();
  if (!query && !opts.releaseId) {
    state.ui.fitCheckError = 'Введите название релиза или каталожный номер';
    render();
    return;
  }
  var collection = vertaxFlattenCollectionForAnalysis();
  if (!collection.length) {
    state.ui.fitCheckError = 'В коллекции пока нет треков с данными. Сначала добавь пластинки.';
    render();
    return;
  }
  state.ui.fitCheckLoading = true;
  state.ui.fitCheckError = null;
  state.ui.fitCheckCandidates = [];
  render();
  try {
    var hash = state.ui.fitCheckHash || (await vertaxCollectionHash(collection));
    state.ui.fitCheckHash = hash;
    await vertaxSyncCollectionIndex(collection, hash);
    var payload = { collection_hash: hash };
    if (opts.releaseId) payload.release_id = opts.releaseId;
    else payload.query = query;
    var manual = [];
    var current = (state.ui.fitCheckResult && state.ui.fitCheckResult.tracks_not_enriched) || [];
    current.forEach(function (track, idx) {
      var key = track.position || String(idx);
      var rec = state.ui.fitCheckManual && state.ui.fitCheckManual[key];
      if (rec && (rec.bpm || rec.camelot)) {
        manual.push({
          position: track.position,
          artist: track.artist,
          title: track.title,
          bpm: rec.bpm,
          camelot: rec.camelot,
        });
      }
    });
    if (manual.length) payload.manual_tracks = manual;
    var result = await vertaxAnalyzeRelease(payload);
    if (result.status === 'needs_selection') {
      state.ui.fitCheckCandidates = result.candidates || [];
      state.ui.fitCheckResult = null;
    } else {
      state.ui.fitCheckCandidates = [];
      state.ui.fitCheckResult = result;
      state.ui.fitCheckAiError = null;
      state.ui.fitCheckAiVerdict = null;
    }
  } catch (e) {
    var msg = String((e && e.message) || e);
    if (msg === 'collection_index_missing') {
      try {
        var retryHash = state.ui.fitCheckHash || (await vertaxCollectionHash(collection));
        await vertaxSyncCollectionIndex(collection, retryHash);
        state.ui.fitCheckHash = retryHash;
        return await runFitCheck(opts);
      } catch (retryErr) {
        msg = String((retryErr && retryErr.message) || retryErr);
      }
    }
    state.ui.fitCheckError = 'Не удалось проверить пластинку: ' + msg;
  } finally {
    state.ui.fitCheckLoading = false;
    render();
  }
}
on('fit-check-input', function (e, el) {
  state.ui.fitCheckQuery = el.value || '';
});
on('fit-check-submit', function () {
  state.ui.fitCheckManual = {};
  runFitCheck();
});
on('fit-check-candidate', function (_, el) {
  var id = el && el.dataset && el.dataset.releaseId;
  if (!id) return;
  runFitCheck({ releaseId: id });
});
on('fit-manual-bpm', function (e, el) {
  var key = el && el.dataset && el.dataset.fitKey;
  if (!key) return;
  state.ui.fitCheckManual = state.ui.fitCheckManual || {};
  state.ui.fitCheckManual[key] = state.ui.fitCheckManual[key] || {};
  state.ui.fitCheckManual[key].bpm = el.value || '';
});
on('fit-manual-camelot', function (e, el) {
  var key = el && el.dataset && el.dataset.fitKey;
  if (!key) return;
  state.ui.fitCheckManual = state.ui.fitCheckManual || {};
  state.ui.fitCheckManual[key] = state.ui.fitCheckManual[key] || {};
  state.ui.fitCheckManual[key].camelot = String(el.value || '').toUpperCase();
});
on('fit-check-recalculate', function () {
  var releaseId =
    state.ui.fitCheckResult &&
    state.ui.fitCheckResult.release &&
    state.ui.fitCheckResult.release.discogs_id;
  if (releaseId) runFitCheck({ releaseId: releaseId });
});
on('fit-check-ai-verdict', async function () {
  if (!state.ui.fitCheckResult || state.ui.fitCheckAiLoading) return;
  state.ui.fitCheckAiLoading = true;
  state.ui.fitCheckAiError = null;
  render();
  try {
    var result = await vertaxGetDjVerdict(state.ui.fitCheckResult);
    state.ui.fitCheckAiVerdict = result.verdict || '';
  } catch (e) {
    var msg = String((e && e.message) || e || 'ai_unavailable');
    if (msg === 'ai_unavailable' || msg === 'gemini_api_key_missing') {
      state.ui.fitCheckAiError = 'DJ-разбор временно недоступен.';
    } else if (/quota|billing|free-tier|лимит|GROQ_API_KEY/i.test(msg)) {
      state.ui.fitCheckAiError =
        'DJ-разбор временно недоступен: у Gemini закончилась квота. Можно включить billing в Google AI Studio или добавить GROQ_API_KEY как запасной AI-провайдер.';
    } else {
      state.ui.fitCheckAiError = 'Не удалось получить DJ-разбор: ' + msg;
    }
  } finally {
    state.ui.fitCheckAiLoading = false;
    render();
  }
});
on('confirm-clear', function () {
  state.modal = 'confirm-clear';
  render();
});
on('clear-data-confirm', async function () {
  await dbClear('vinyls');
  await dbClear('sets');
  state.vinyls = [];
  state.collection = [];
  state.sets = [];
  state.modal = null;
  state.view = 'home';
  showToast('Все данные стёрты');
  render();
});

/* RUNT and VERTAX runtime extensions. Installed from app.js after boot in the original order. */

function installRuntBpmX2LiveToggle() {
  (function () {
    if (window.__runtX2LiveTogglePatchInstalled) return;
    window.__runtX2LiveTogglePatchInstalled = true;
    function patchX2LiveToggle() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(patchX2LiveToggle, 120);
        return;
      }
      var state = window.laisoBuck.state;
      var oldRender = window.laisoBuck.render;
      function findVinyl(id) {
        return (
          (state.vinyls || []).find(function (v) {
            return v.id === id;
          }) ||
          (state.collection || []).find(function (v) {
            return v.id === id;
          }) ||
          null
        );
      }
      function findTrack(vinyl, trackId) {
        if (!vinyl || !vinyl.tracklist) return null;
        return (
          vinyl.tracklist.find(function (t) {
            return t.id === trackId;
          }) || null
        );
      }
      function persistVinylSafe(v) {
        try {
          if (typeof persistVinyl === 'function') persistVinyl(v);
        } catch (e) {}
      }
      function showToastSafe(msg) {
        try {
          if (typeof showToast === 'function') showToast(msg);
        } catch (e) {}
      }
      function findPair(el) {
        var vid = el && el.dataset ? el.dataset.vid : null;
        var tid = el && el.dataset ? el.dataset.tid : null;
        var v = findVinyl(vid);
        var t = v && findTrack(v, tid);
        return { v: v, t: t };
      }
      function rememberBaseBpm(t) {
        if (!t) return;
        if (!t.runtBaseBpm && t.bpm) t.runtBaseBpm = t.originalBpm || t.bpm;
      }
      function multiplyBpm(t) {
        if (!t || !t.bpm) return false;
        rememberBaseBpm(t);
        t.originalBpm = t.runtBaseBpm;
        t.bpm = Math.min(240, Math.round(t.bpm * 2));
        t.halftimeCorrected = true;
        t.bpmSource = 'manual_x2';
        t.confidence = t.confidence || 'medium';
        return true;
      }
      function divideBpm(t) {
        if (!t || !t.bpm) return false;
        rememberBaseBpm(t);
        t.bpm = Math.max(40, Math.round(t.bpm / 2));
        t.halftimeCorrected = false;
        t.originalBpm = null;
        t.bpmSource = 'manual_div2';
        t.confidence = t.confidence || 'medium';
        return true;
      }
      function updateSetSnapshot(t) {
        var generated = state.ui && state.ui.generatedSet ? state.ui.generatedSet : [];
        generated.forEach(function (row) {
          if (row.id === t.id) {
            row.bpm = t.bpm;
            row.originalBpm = t.originalBpm || null;
            row.bpmSource = t.bpmSource || 'manual';
          }
        });
      }
      function rerenderSoon() {
        if (typeof oldRender === 'function') oldRender();
        if (typeof window.laisoBuck.render === 'function') window.laisoBuck.render();
      }
      /* Capture click BEFORE old handlers. Prevents old bpm-x2 handler from fighting us. */ document.addEventListener(
        'click',
        function (e) {
          if (!e.target || !e.target.closest) return;
          var el = e.target.closest(
            '[data-action="bpm-x2"],[data-action="bpm-divide-2"],[data-action="bpm-half"]'
          );
          if (!el || !el.closest('#laiso-app')) return;
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          var p = findPair(el);
          if (!p.t || !p.v) return;
          var ok = false;
          if (el.dataset.action === 'bpm-x2') {
            ok = multiplyBpm(p.t);
            if (ok) showToastSafe('BPM ×2: теперь ' + p.t.bpm);
          } else {
            ok = divideBpm(p.t);
            if (ok) showToastSafe('BPM ÷2: теперь ' + p.t.bpm);
          }
          if (ok) {
            updateSetSnapshot(p.t);
            persistVinylSafe(p.v);
            rerenderSoon();
          }
        },
        true
      );
      /* Patch set screen render after every render: replace lonely x2 with ×2 / ÷2 controls where needed. */ function enhanceButtons() {
        var root = document.getElementById('laiso-app');
        if (!root) return;
        root.querySelectorAll('[data-action="bpm-x2"]').forEach(function (btn) {
          if (btn.dataset.runtEnhanced) return;
          btn.dataset.runtEnhanced = '1';
          var vid = btn.dataset.vid;
          var tid = btn.dataset.tid;
          var minus = document.createElement('button');
          minus.className = btn.className || 'laiso-x2-btn';
          minus.setAttribute('data-action', 'bpm-divide-2');
          minus.setAttribute('data-vid', vid || '');
          minus.setAttribute('data-tid', tid || '');
          minus.setAttribute('title', 'уменьшить BPM в 2 раза');
          minus.textContent = '÷2';
          btn.insertAdjacentElement('afterend', minus);
        });
      }
      function registerEnhanceButtons() {
        if (
          typeof window.vertaxRegisterAfterRender === 'function' &&
          !window.__runtX2AfterRenderRegistered
        ) {
          window.vertaxRegisterAfterRender(function () {
            setTimeout(enhanceButtons, 0);
          });
          window.__runtX2AfterRenderRegistered = true;
        }
      }
      registerEnhanceButtons();
      setTimeout(registerEnhanceButtons, 300);
      setTimeout(enhanceButtons, 0);
    }
    patchX2LiveToggle();
  })();
}

function installRuntSetDndAndAddTrackModal() {
  (function () {
    if (!window.laisoBuck || !window.laisoBuck.state) {
      console.warn('RUNT patch 6: app state not found');
    }
    function runtEsc(s) {
      if (typeof esc === 'function') return esc(s);
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function getVinylByTrackRef(trackRef) {
      if (!trackRef) return null;
      return findVinyl(trackRef.recordId || trackRef.vinylId);
    }
    function getRealTrackByRef(trackRef) {
      var v = getVinylByTrackRef(trackRef);
      return v && findTrack(v, trackRef.id || trackRef.trackId);
    }
    function syncGeneratedTrackSnapshot(trackRef) {
      var v = getVinylByTrackRef(trackRef);
      var t = getRealTrackByRef(trackRef);
      if (!v || !t || !trackRef) return trackRef;
      trackRef.title = t.title;
      trackRef.position = t.position;
      trackRef.displayPosition = displayPosition(t, v);
      trackRef.bpm = t.bpm;
      trackRef.key = t.key;
      trackRef.camelot = t.camelot;
      trackRef.originalBpm = t.originalBpm || null;
      trackRef.bpmSource = t.bpmSource || null;
      trackRef.recordId = v.id;
      trackRef.recordKey =
        typeof getPhysicalVinylKey === 'function'
          ? getPhysicalVinylKey(v)
          : trackRef.recordKey || v.id;
      trackRef.vinylTitle = v.title;
      trackRef.vinylArtist = v.artist;
      trackRef.vinylCatno = v.catno || '';
      trackRef.vinylLabel = v.label || '';
      return trackRef;
    }
    function syncGeneratedSet() {
      if (!state.ui.generatedSet) state.ui.generatedSet = [];
      state.ui.generatedSet = state.ui.generatedSet.map(syncGeneratedTrackSnapshot);
    }
    function setCardHtml(tr, idx, arr) {
      tr = syncGeneratedTrackSnapshot(tr);
      var prev = idx > 0 ? arr[idx - 1] : null;
      if (prev) prev = syncGeneratedTrackSnapshot(prev);
      var dBpm = prev && prev.bpm && tr.bpm ? tr.bpm - prev.bpm : null;
      var sameVinyl =
        prev &&
        ((prev.recordKey && tr.recordKey && prev.recordKey === tr.recordKey) ||
          prev.recordId === tr.recordId);
      var pos = tr.displayPosition || tr.position || '—';
      var bpm = tr.bpm || '—';
      var cam = tr.camelot || '—';
      var key = tr.key || '—';
      var catnoStr = tr.vinylCatno ? ' · ' + runtEsc(tr.vinylCatno) : '';
      var dStr = dBpm === null ? '' : ' (' + (dBpm > 0 ? '+' : '') + dBpm + ')';
      var x2 = '';
      if (tr.originalBpm && tr.bpm) {
        x2 =
          '<button class="laiso-x2-btn" data-action="bpm-divide-2" data-vid="' +
          runtEsc(tr.recordId) +
          '" data-tid="' +
          runtEsc(tr.id) +
          '" title="вернуть исходный">÷2</button>';
      } else if (tr.bpm && tr.bpm >= 60 && tr.bpm <= 110) {
        x2 =
          '<button class="laiso-x2-btn" data-action="bpm-x2" data-vid="' +
          runtEsc(tr.recordId) +
          '" data-tid="' +
          runtEsc(tr.id) +
          '" title="удвоить BPM">×2</button>';
      } else if (tr.bpm && tr.bpm > 110) {
        x2 =
          '<button class="laiso-x2-btn" data-action="bpm-divide-2" data-vid="' +
          runtEsc(tr.recordId) +
          '" data-tid="' +
          runtEsc(tr.id) +
          '" title="уменьшить BPM в 2 раза">÷2</button>';
      }
      var warning = sameVinyl
        ? '<div class="laiso-warn-line">⚠ Та же пластинка, что предыдущий трек — переставь вручную</div>'
        : '';
      var original =
        tr.originalBpm && tr.bpm
          ? '<span class="laiso-set-bpm-hint">исх. ' +
            runtEsc(String(tr.originalBpm)) +
            ' ×2</span>'
          : '';
      return (
        warning +
        '<div class="laiso-set-card" draggable="true" data-set-index="' +
        idx +
        '">' +
        '<div style="position:absolute;top:18px;right:20px;font-family:var(--font-mono);font-size:13px;color:var(--runt-faint);">#' +
        (idx + 1) +
        '</div>' +
        '<div class="laiso-set-card-head" style="grid-template-columns:150px 1fr!important;">' +
        '<div>' +
        '<div class="laiso-set-pos" style="width:100%;justify-content:center;font-size:28px;">' +
        runtEsc(String(bpm)) +
        '</div>' +
        '<div class="laiso-set-pos" style="width:100%;justify-content:center;margin-top:10px;background:var(--runt-accent)!important;color:#111!important;box-shadow:none!important;">' +
        runtEsc(cam) +
        '</div>' +
        '<span class="laiso-pill" style="margin-top:10px;">Key: ' +
        runtEsc(key) +
        '</span>' +
        '</div>' +
        '<div style="min-width:0;padding-right:34px;">' +
        '<div class="laiso-set-title">' +
        runtEsc(tr.title || '—') +
        '</div>' +
        '<div class="laiso-set-meta" style="margin:18px 0 14px!important;">' +
        runtEsc(tr.vinylArtist || '') +
        ' — ' +
        runtEsc(tr.vinylTitle || '') +
        catnoStr +
        '</div>' +
        '<div class="laiso-set-pills" style="margin-left:0!important;">' +
        '<span class="laiso-set-vinyl-pos"><em>на пластинке</em> ' +
        runtEsc(pos) +
        '</span>' +
        '<span class="laiso-pill laiso-pill-bpm">' +
        runtEsc(String(bpm)) +
        ' BPM' +
        dStr +
        '</span>' +
        x2 +
        '<button class="laiso-x2-btn" data-action="track-manual-meta" data-vid="' +
        runtEsc(tr.recordId) +
        '" data-tid="' +
        runtEsc(tr.id) +
        '">править</button>' +
        '<span class="laiso-set-drag-hint">↕ перетащить</span>' +
        original +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }
    /* Override viewSet to include the same logic + new buttons + draggable cards */ window.viewSet =
      viewSet = function () {
        syncGeneratedSet();
        var mode = state.ui.setMode;
        var opts = state.ui.setOptions;
        var hasSet = state.ui.generatedSet && state.ui.generatedSet.length > 0;
        var modeTabs =
          '<div class="laiso-tabs laiso-tabs-modes">' +
          [
            ['best-flow', 'BEST FLOW'],
            ['tempo-safe', 'ПО ТЕМПУ'],
            ['camelot-safe', 'ПО CAMELOT'],
            ['camelot-filter', 'ФИЛЬТР CAMELOT'],
          ]
            .map(function (p) {
              return (
                '<button class="laiso-tab ' +
                (mode === p[0] ? 'active' : '') +
                '" data-action="set-mode" data-mode="' +
                p[0] +
                '">' +
                p[1] +
                '</button>'
              );
            })
            .join('') +
          '</div>';
        var modeHints = {
          'best-flow': 'Главный режим: BPM-плавность + гармоничный Camelot + правило винила.',
          'tempo-safe':
            'Только плавный темп. Каждый следующий трек в пределах ± BPM от предыдущего.',
          'camelot-safe': 'Гармоничный микс: соседние Camelot-коды. Темп не больше ±6 BPM.',
          'camelot-filter':
            'Собрать сет только из выбранных Camelot-кодов. Нажми на круг, чтобы добавить/убрать.',
        };
        var controls =
          '<div class="laiso-mod-label">режим</div>' +
          '<div class="laiso-panel laiso-mode-hint">' +
          runtEsc(modeHints[mode] || '') +
          '</div>';
        if (mode === 'tempo-safe' || mode === 'best-flow') {
          controls +=
            '<div class="laiso-panel">' +
            '<label class="laiso-label">Диапазон темпа ± ' +
            opts.tempoRange +
            ' BPM</label>' +
            '<div class="laiso-toggle">' +
            [2, 4, 6, 8]
              .map(function (n) {
                return (
                  '<button class="' +
                  (opts.tempoRange === n ? 'active' : '') +
                  '" data-action="set-tempo" data-n="' +
                  n +
                  '">±' +
                  n +
                  '</button>'
                );
              })
              .join('') +
            '</div>' +
            '</div>';
        } else if (mode === 'camelot-safe') {
          controls +=
            '<div class="laiso-panel"><label class="laiso-label">Стартовый Camelot (опционально)</label>' +
            renderCamelotWheel(opts.targetCamelot) +
            '<div class="laiso-meta" style="text-align:center;margin-top:6px;">' +
            (opts.targetCamelot ? runtEsc(opts.targetCamelot) : 'выбери код или оставь пустым') +
            '</div></div>';
        } else if (mode === 'camelot-filter') {
          var sel = opts.camelotSet || {};
          var selKeys = Object.keys(sel).filter(function (k) {
            return sel[k];
          });
          controls +=
            '<div class="laiso-panel">' +
            '<label class="laiso-label">Выбери коды (' +
            selKeys.length +
            ' выбрано)</label>' +
            renderCamelotWheelMulti(sel) +
            '<div class="laiso-row" style="margin-top:10px;">' +
            '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary laiso-grow" data-action="camelot-filter-clear">Сбросить</button>' +
            '<button class="laiso-btn laiso-btn-sm laiso-grow" data-action="camelot-filter-apply"' +
            (selKeys.length === 0 ? ' disabled' : '') +
            '>Собрать из выбранных</button>' +
            '</div>' +
            '</div>';
        }
        var allTracks = getAllSessionTracks({ includeAll: true });
        var availTracks = getAllSessionTracks();
        var availCount = availTracks.length;
        var withBpm = availTracks.filter(function (t) {
          return t.bpm;
        }).length;
        var withCam = availTracks.filter(function (t) {
          return t.camelot;
        }).length;
        var missingImportant = allTracks.filter(function (t) {
          return !t.trackExcluded && !t.vinylExcluded && (!t.bpm || !t.camelot);
        });
        var missingNotice = '';
        if (missingImportant.length > 0 && !state.ui.setOpenDataPanel) {
          missingNotice =
            '<div class="laiso-panel laiso-data-panel" style="border-color:var(--warning);background:#FFF8F2;">' +
            '<div class="laiso-data-head">' +
            '<strong>Есть треки без BPM / Camelot</strong>' +
            '<span class="laiso-meta">' +
            missingImportant.length +
            ' требуют проверки</span>' +
            '</div>' +
            '<p class="laiso-data-hint">Заполни значения вручную или исключи такие треки из сета.</p>' +
            '<button class="laiso-btn laiso-btn-sm laiso-btn-block" data-action="toggle-data-panel">Показать и исправить</button>' +
            '</div>';
        }
        var dataPanel = '';
        if (
          state.ui.setOpenDataPanel ||
          state.ui.setLastWarning === 'not-enough-data' ||
          state.ui.setLastWarning === 'no-valid-set'
        ) {
          var problemTracks = allTracks.filter(function (t) {
            if (mode === 'tempo-safe') return !t.bpm;
            if (mode === 'camelot-safe' || mode === 'camelot-filter') return !t.camelot;
            if (mode === 'best-flow') return !t.bpm || !t.camelot;
            return !t.bpm || !t.camelot;
          });
          var rowsProblem =
            problemTracks
              .slice(0, 30)
              .map(function (t) {
                var pos = t.displayPosition || '—';
                return (
                  '<div class="laiso-data-row">' +
                  '<div class="laiso-data-row-info">' +
                  '<span class="laiso-set-vinyl-pos"><em>на пластинке</em> ' +
                  runtEsc(pos) +
                  '</span>' +
                  '<span>' +
                  runtEsc(t.title || '—') +
                  '<small> · ' +
                  runtEsc(t.vinylArtist || '') +
                  ' — ' +
                  runtEsc(t.vinylTitle || '') +
                  '</small></span>' +
                  '</div>' +
                  '<div class="laiso-data-row-meta">' +
                  (t.bpm
                    ? '<span class="laiso-pill">' + t.bpm + ' BPM</span>'
                    : '<span class="laiso-pill laiso-pill-warn">нет BPM</span>') +
                  (t.camelot
                    ? '<span class="laiso-pill">' + runtEsc(t.camelot) + '</span>'
                    : '<span class="laiso-pill laiso-pill-warn">нет Camelot</span>') +
                  '</div>' +
                  '<div class="laiso-data-row-actions">' +
                  '<button class="laiso-btn laiso-btn-sm" data-action="track-manual-meta" data-vid="' +
                  runtEsc(t.recordId) +
                  '" data-tid="' +
                  runtEsc(t.id) +
                  '">Ввести BPM/Key</button>' +
                  '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary" data-action="track-toggle-exclude" data-vid="' +
                  runtEsc(t.recordId) +
                  '" data-tid="' +
                  runtEsc(t.id) +
                  '">' +
                  (t.trackExcluded ? 'Вернуть' : 'Не в сете') +
                  '</button>' +
                  '</div>' +
                  '</div>'
                );
              })
              .join('') ||
            '<div class="laiso-empty laiso-empty-sm">В этом режиме все треки укладываются.</div>';
          var warnHeader =
            state.ui.setLastWarning === 'no-valid-set'
              ? 'Не удалось собрать сет в этом режиме'
              : 'Недостаточно данных для сета';
          dataPanel =
            '<div class="laiso-mod-label">диагностика</div>' +
            '<div class="laiso-panel laiso-data-panel">' +
            '<div class="laiso-data-head">' +
            '<strong>' +
            runtEsc(warnHeader) +
            '</strong>' +
            '<span class="laiso-meta">всего: ' +
            availCount +
            ' · с BPM: ' +
            withBpm +
            ' · с Camelot: ' +
            withCam +
            '</span>' +
            '</div>' +
            '<p class="laiso-data-hint">Заполни BPM/Key вручную, исключи трек или пластинку из сетов, или попробуй другой режим.</p>' +
            '<div class="laiso-stack-sm">' +
            rowsProblem +
            '</div>' +
            '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary laiso-btn-block" style="margin-top:10px;" data-action="toggle-data-panel">Скрыть диагностику</button>' +
            '</div>';
        }
        var setHtml = '';
        if (hasSet) {
          setHtml =
            '<div class="laiso-mod-label">сет · ' +
            state.ui.generatedSet.length +
            ' трек.</div>' +
            '<div class="laiso-stack-sm laiso-set-dnd-list">' +
            state.ui.generatedSet.map(setCardHtml).join('') +
            '</div>';
        }
        var openDataLink =
          !state.ui.setOpenDataPanel && availCount >= 2
            ? '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary laiso-btn-block" data-action="toggle-data-panel" style="margin-top:8px;">Показать диагностику данных</button>'
            : '';
        var tools = hasSet
          ? '<div class="laiso-set-tools">' +
            '<button class="laiso-btn laiso-btn-secondary" data-action="open-add-track-to-set">+ Добавить трек из коллекции</button>' +
            '<button class="laiso-btn laiso-btn-secondary" data-action="set-clear-current">Очистить сет</button>' +
            '</div>'
          : '';
        return (
          renderHeader('Сборка сета', {
            right: '<span class="laiso-counter">' + availCount + ' трек.</span>',
          }) +
          modeTabs +
          controls +
          '<div class="laiso-row" style="margin:14px 0;">' +
          '<button class="laiso-btn laiso-grow" data-action="set-generate">' +
          (hasSet ? 'Пересобрать' : 'Сгенерировать') +
          '</button>' +
          '</div>' +
          (availCount < 2
            ? '<div class="laiso-empty">Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.</div>'
            : '') +
          missingNotice +
          dataPanel +
          setHtml +
          tools +
          (hasSet
            ? '<div class="laiso-row" style="margin-top:14px;">' +
              '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="set-export">Экспорт TXT</button>' +
              '<button class="laiso-btn laiso-grow" data-action="set-save">Сохранить сет</button>' +
              '</div>'
            : '') +
          openDataLink
        );
      };
    function renderAddTrackToSetModal() {
      syncGeneratedSet();
      var used = {};
      (state.ui.generatedSet || []).forEach(function (t) {
        used[t.id] = true;
      });
      var tracks = getAllSessionTracks()
        .filter(function (t) {
          return !used[t.id];
        })
        .sort(function (a, b) {
          if ((a.bpm || 999) !== (b.bpm || 999)) return (a.bpm || 999) - (b.bpm || 999);
          return String(a.camelot || '').localeCompare(String(b.camelot || ''));
        });
      var list = tracks.length
        ? tracks
            .map(function (t) {
              var pos = t.displayPosition || t.position || '—';
              return (
                '<div class="laiso-add-track-card">' +
                '<div class="laiso-add-track-pos">' +
                '<strong>' +
                runtEsc(pos) +
                '</strong>' +
                '<span>' +
                runtEsc(t.camelot || '—') +
                '</span>' +
                '</div>' +
                '<div style="min-width:0;">' +
                '<div class="laiso-vinyl-title">' +
                runtEsc(t.title || '—') +
                '</div>' +
                '<div class="laiso-vinyl-meta">' +
                runtEsc(t.vinylArtist || '') +
                ' — ' +
                runtEsc(t.vinylTitle || '') +
                (t.vinylCatno ? ' · ' + runtEsc(t.vinylCatno) : '') +
                '</div>' +
                '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
                '<span class="laiso-pill laiso-pill-bpm">' +
                (t.bpm ? t.bpm + ' BPM' : 'нет BPM') +
                '</span>' +
                '<span class="laiso-pill">' +
                (t.key ? 'Key: ' + runtEsc(t.key) : 'нет Key') +
                '</span>' +
                '</div>' +
                '</div>' +
                '<button class="laiso-btn laiso-btn-sm" data-action="add-track-to-current-set" data-vid="' +
                runtEsc(t.recordId) +
                '" data-tid="' +
                runtEsc(t.id) +
                '">Добавить</button>' +
                '</div>'
              );
            })
            .join('')
        : '<div class="laiso-empty">Все доступные треки уже в сете или исключены.</div>';
      return (
        '<div class="laiso-modal-bg" data-action="close-modal-bg">' +
        '<div class="laiso-modal" data-stop>' +
        '<div class="laiso-row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h2 class="laiso-modal-title">Добавить трек в сет</h2>' +
        '<button class="laiso-back" data-action="close-modal">Закрыть</button>' +
        '</div>' +
        '<div class="laiso-set-add-list laiso-stack-sm">' +
        list +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }
    /* Extend renderModal without deleting existing modal logic */ var prevRenderModal =
      renderModal;
    window.renderModal = renderModal = function () {
      if (state.modal === 'add-track-to-set') return renderAddTrackToSetModal();
      return prevRenderModal ? prevRenderModal() : '';
    };
    on('open-add-track-to-set', function () {
      state.modal = 'add-track-to-set';
      render();
    });
    on('add-track-to-current-set', function (_, el) {
      var v = findVinyl(el.dataset.vid);
      var t = v && findTrack(v, el.dataset.tid);
      if (!v || !t) return;
      var item = {
        id: t.id,
        position: t.position,
        displayPosition: displayPosition(t, v),
        side: t.side,
        title: t.title,
        duration: t.duration,
        bpm: t.bpm,
        key: t.key,
        camelot: t.camelot,
        originalBpm: t.originalBpm || null,
        bpmSource: t.bpmSource || null,
        recordId: v.id,
        recordKey: typeof getPhysicalVinylKey === 'function' ? getPhysicalVinylKey(v) : v.id,
        vinylTitle: v.title,
        vinylArtist: v.artist,
        vinylCatno: v.catno || '',
        vinylLabel: v.label || '',
      };
      var last = (state.ui.generatedSet || [])[state.ui.generatedSet.length - 1];
      if (
        last &&
        ((last.recordKey && item.recordKey && last.recordKey === item.recordKey) ||
          last.recordId === item.recordId)
      ) {
        showToast('Нельзя добавить сразу после трека с этой же пластинки');
        return;
      }
      state.ui.generatedSet = state.ui.generatedSet || [];
      state.ui.generatedSet.push(item);
      state.modal = null;
      showToast('Трек добавлен в сет');
      render();
    });
    on('set-clear-current', async function () {
      if (!(await vertaxConfirm('Очистить текущий сет?'))) return;
      state.ui.generatedSet = [];
      render();
    });
    /* DnD reorder for current set */ if (!window.__runtSetDndPatchInstalled) {
      window.__runtSetDndPatchInstalled = true;
      window.__runtDragSetIndex = null;
      document.addEventListener('dragstart', function (e) {
        var card =
          e.target.closest && e.target.closest('#laiso-app .laiso-set-card[data-set-index]');
        if (!card) return;
        window.__runtDragSetIndex = parseInt(card.dataset.setIndex, 10);
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(window.__runtDragSetIndex));
        }
      });
      document.addEventListener('dragend', function (e) {
        document
          .querySelectorAll(
            '#laiso-app .laiso-set-card.is-dragging,#laiso-app .laiso-set-card.is-drag-over'
          )
          .forEach(function (el) {
            el.classList.remove('is-dragging', 'is-drag-over');
          });
        window.__runtDragSetIndex = null;
      });
      document.addEventListener('dragover', function (e) {
        var card =
          e.target.closest && e.target.closest('#laiso-app .laiso-set-card[data-set-index]');
        if (!card) return;
        e.preventDefault();
        document.querySelectorAll('#laiso-app .laiso-set-card.is-drag-over').forEach(function (el) {
          if (el !== card) el.classList.remove('is-drag-over');
        });
        card.classList.add('is-drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      document.addEventListener('drop', function (e) {
        var card =
          e.target.closest && e.target.closest('#laiso-app .laiso-set-card[data-set-index]');
        if (!card) return;
        e.preventDefault();
        var from = window.__runtDragSetIndex;
        if (from == null && e.dataTransfer)
          from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        var to = parseInt(card.dataset.setIndex, 10);
        document
          .querySelectorAll(
            '#laiso-app .laiso-set-card.is-dragging,#laiso-app .laiso-set-card.is-drag-over'
          )
          .forEach(function (el) {
            el.classList.remove('is-dragging', 'is-drag-over');
          });
        if (isNaN(from) || isNaN(to) || from === to) return;
        var arr = state.ui.generatedSet || [];
        if (!arr[from] || !arr[to]) return;
        var moved = arr.splice(from, 1)[0];
        arr.splice(to, 0, moved);
        state.ui.generatedSet = arr;
        haptic('light');
        showToast('Порядок изменён');
        render();
      });
      /* Touch DnD for mobile (HTML5 dnd doesn't fire on touchscreens) */ window.__runtTouchDrag =
        null;
      function runtTouchClearMarks() {
        document
          .querySelectorAll(
            '#laiso-app .laiso-set-card.is-dragging,#laiso-app .laiso-set-card.is-drag-over'
          )
          .forEach(function (el) {
            el.classList.remove('is-dragging', 'is-drag-over');
          });
      }
      document.addEventListener(
        'touchstart',
        function (e) {
          if (e.touches && e.touches.length !== 1) return;
          var card =
            e.target.closest && e.target.closest('#laiso-app .laiso-set-card[data-set-index]');
          if (!card) return;
          var idx = parseInt(card.dataset.setIndex, 10);
          if (isNaN(idx)) return;
          var t0 = e.touches[0];
          var sx = t0.clientX,
            sy = t0.clientY;
          var pressTimer = setTimeout(function () {
            window.__runtTouchDrag = { from: idx, card: card, lastTo: idx };
            card.classList.add('is-dragging');
            haptic('medium');
          }, 280);
          function clear() {
            clearTimeout(pressTimer);
            document.removeEventListener('touchend', clear);
            document.removeEventListener('touchcancel', clear);
            document.removeEventListener('touchmove', moveMaybeCancel);
          }
          function moveMaybeCancel(ev) {
            if (window.__runtTouchDrag) return;
            var tt = ev.touches && ev.touches[0];
            if (!tt) return;
            if (Math.abs(tt.clientX - sx) > 8 || Math.abs(tt.clientY - sy) > 8) clear();
          }
          document.addEventListener('touchend', clear, { once: true });
          document.addEventListener('touchcancel', clear, { once: true });
          document.addEventListener('touchmove', moveMaybeCancel, { passive: true });
        },
        { passive: true }
      );
      document.addEventListener(
        'touchmove',
        function (e) {
          if (!window.__runtTouchDrag) return;
          if (e.cancelable) e.preventDefault();
          var t = e.touches && e.touches[0];
          if (!t) return;
          var underEl = document.elementFromPoint(t.clientX, t.clientY);
          var target =
            underEl &&
            underEl.closest &&
            underEl.closest('#laiso-app .laiso-set-card[data-set-index]');
          document
            .querySelectorAll('#laiso-app .laiso-set-card.is-drag-over')
            .forEach(function (el) {
              if (el !== target) el.classList.remove('is-drag-over');
            });
          if (target && target !== window.__runtTouchDrag.card) {
            target.classList.add('is-drag-over');
            var ti = parseInt(target.dataset.setIndex, 10);
            if (!isNaN(ti)) window.__runtTouchDrag.lastTo = ti;
          }
        },
        { passive: false }
      );
      document.addEventListener('touchend', function () {
        var d = window.__runtTouchDrag;
        if (!d) return;
        var from = d.from,
          to = d.lastTo;
        runtTouchClearMarks();
        window.__runtTouchDrag = null;
        if (isNaN(from) || isNaN(to) || from === to) return;
        var arr = state.ui.generatedSet || [];
        if (!arr[from] || !arr[to]) return;
        var moved = arr.splice(from, 1)[0];
        arr.splice(to, 0, moved);
        state.ui.generatedSet = arr;
        haptic('light');
        showToast('Порядок изменён');
        render();
      });
      document.addEventListener('touchcancel', function () {
        runtTouchClearMarks();
        window.__runtTouchDrag = null;
      });
    }
    /* Patch x2/div2 to sync generated set instantly */ var prevBpmX2 = handlers['bpm-x2'];
    on('bpm-x2', function (e, el) {
      if (prevBpmX2) prevBpmX2(e, el);
      syncGeneratedSet();
      render();
    });
    var prevBpmDiv2 = handlers['bpm-divide-2'];
    on('bpm-divide-2', function (e, el) {
      if (prevBpmDiv2) prevBpmDiv2(e, el);
      syncGeneratedSet();
      render();
    });
    var prevManualMeta = handlers['track-manual-meta'];
    on('track-manual-meta', function (e, el) {
      if (prevManualMeta) prevManualMeta(e, el);
      syncGeneratedSet();
      render();
    });
    render();
  })();
}

function installRuntManualMetadataHandlers() {
  (function () {
    if (
      typeof on !== 'function' ||
      typeof findVinyl !== 'function' ||
      typeof findTrack !== 'function'
    ) {
      console.warn('RUNT-01 patch 8: base app not ready');
      return;
    }
    function parseManualKeyOrCamelot(input) {
      var raw = String(input || '').trim();
      if (!raw) return { key: null, camelot: null };
      /* 8A / 12B / 08A */ var cam = raw.toUpperCase().replace(/^0+/, '');
      if (/^(1[0-2]|[1-9])[AB]$/.test(cam)) {
        return {
          key:
            typeof CAMELOT_TO_KEY !== 'undefined' && CAMELOT_TO_KEY[cam]
              ? CAMELOT_TO_KEY[cam]
              : raw,
          camelot: cam,
        };
      }
      /* Short musical notation: Am, F#m, Dbm, C, F# */ var m = raw.match(
        /^([A-Ga-g])([#b♯♭]?)(m|min|minor|maj|major)?$/
      );
      if (m) {
        var note = m[1].toUpperCase() + (m[2] || '').replace('♯', '#').replace('♭', 'b');
        var mode = (m[3] || 'major').toLowerCase();
        var scale = mode === 'm' || mode === 'min' || mode === 'minor' ? 'minor' : 'major';
        var normalized = note + ' ' + scale;
        if (typeof normalizeKeyName === 'function')
          normalized = normalizeKeyName(normalized) || normalized;
        return {
          key: normalized,
          camelot:
            typeof KEY_TO_CAMELOT !== 'undefined' && KEY_TO_CAMELOT[normalized]
              ? KEY_TO_CAMELOT[normalized]
              : null,
        };
      }
      /* Full notation: F major, D minor, etc. */ var normalizedFull =
        typeof normalizeKeyName === 'function' ? normalizeKeyName(raw) : null;
      if (normalizedFull) {
        return {
          key: normalizedFull,
          camelot:
            typeof KEY_TO_CAMELOT !== 'undefined' && KEY_TO_CAMELOT[normalizedFull]
              ? KEY_TO_CAMELOT[normalizedFull]
              : null,
        };
      }
      return { key: raw, camelot: null };
    }
    function syncFetchingItem(track, vinyl) {
      if (!state || !state.ui || !state.ui.fetchProgress || !state.ui.fetchProgress.items) return;
      var fp = state.ui.fetchProgress;
      var item = fp.items.find(function (x) {
        return x.trackId === track.id;
      });
      if (!item) return;
      if (track.bpm || track.camelot || track.key) {
        item.status = 'ok';
        item.meta = {
          bpm: track.bpm || null,
          key: track.key || null,
          camelot: track.camelot || null,
          source: 'manual',
          confidence: 'manual',
        };
        item.artist = (vinyl && vinyl.artist) || item.artist;
        item.title = track.title || item.title;
        item.manualUpdated = true;
      } else {
        item.status = 'notfound';
        item.meta = null;
        item.manualUpdated = false;
      }
    }
    function syncGeneratedSetTrack(track, vinyl) {
      if (!state || !state.ui || !Array.isArray(state.ui.generatedSet)) return;
      state.ui.generatedSet.forEach(function (st) {
        if (st.id === track.id && (!vinyl || st.recordId === vinyl.id)) {
          st.bpm = track.bpm || null;
          st.key = track.key || null;
          st.camelot = track.camelot || null;
          st.originalBpm = track.originalBpm || null;
          st.bpmSource = track.bpmSource || 'manual';
        }
      });
    }
    async function setManualMeta(vinyl, track) {
      var currentBpm = track.bpm || '';
      var bpmStr = await vertaxPrompt(
        'BPM для трека «' + (track.title || 'трек') + '»:',
        currentBpm
      );
      if (bpmStr === null) return false;
      bpmStr = String(bpmStr).trim();
      if (bpmStr) {
        var n = parseInt(bpmStr, 10);
        if (isNaN(n) || n < 40 || n > 220) {
          if (typeof showToast === 'function') showToast('BPM должен быть числом примерно 40–220');
          return false;
        }
        track.bpm = n;
        track.bpmSource = 'manual';
        track.originalBpm = null;
        track.halftimeCorrected = false;
      } else {
        track.bpm = null;
        track.bpmSource = null;
        track.originalBpm = null;
        track.halftimeCorrected = false;
      }
      var currentTone = track.camelot || track.key || '';
      var toneStr = await vertaxPrompt(
        'Camelot или тональность. Например: 8A, 7B, F major, Dm:',
        currentTone
      );
      if (toneStr !== null) {
        var parsed = parseManualKeyOrCamelot(toneStr);
        track.key = parsed.key;
        track.camelot = parsed.camelot;
        track.keySource = toneStr.trim() ? 'manual' : null;
      }
      track.confidence =
        track.bpm && (track.camelot || track.key)
          ? 'high'
          : track.bpm || track.camelot || track.key
            ? 'medium'
            : 'manual';
      track.metaStatus = track.bpm || track.camelot || track.key ? 'manual_ok' : 'manual_empty';
      syncFetchingItem(track, vinyl);
      syncGeneratedSetTrack(track, vinyl);
      try {
        if (typeof persistVinyl === 'function') persistVinyl(vinyl);
      } catch (e) {}
      if (typeof showToast === 'function') {
        var parts = [];
        if (track.bpm) parts.push(track.bpm + ' BPM');
        if (track.camelot) parts.push(track.camelot);
        else if (track.key) parts.push(track.key);
        showToast(parts.length ? 'Внесено: ' + parts.join(' · ') : 'Значения очищены');
      }
      if (typeof render === 'function') render();
      return true;
    }
    /* Replace manual meta handler so fetching rows immediately change from "НЕ НАЙДЕНО" to entered values. */ on(
      'track-manual-meta',
      function (_, el) {
        var vid = el.dataset.vid,
          tid = el.dataset.tid;
        var vinyl = findVinyl(vid);
        var track = vinyl && findTrack(vinyl, tid);
        if (!track) return;
        setManualMeta(vinyl, track).catch(function (err) {
          console.warn('manual meta failed', err);
        });
      }
    );
    /* Also make “Не в сете” visually update on the fetching screen. */ on(
      'track-toggle-exclude',
      function (_, el) {
        var vid = el.dataset.vid,
          tid = el.dataset.tid;
        var vinyl = findVinyl(vid);
        var track = vinyl && findTrack(vinyl, tid);
        if (!track) return;
        track.excludeFromSets = !track.excludeFromSets;
        if (state && state.ui && state.ui.fetchProgress && state.ui.fetchProgress.items) {
          var item = state.ui.fetchProgress.items.find(function (x) {
            return x.trackId === track.id;
          });
          if (item && track.excludeFromSets) {
            item.status = 'skipped';
            item.meta = null;
          } else if (item && !track.excludeFromSets && (track.bpm || track.camelot || track.key)) {
            item.status = 'ok';
            item.meta = {
              bpm: track.bpm || null,
              key: track.key || null,
              camelot: track.camelot || null,
              source: 'manual',
            };
          } else if (item) {
            item.status = 'notfound';
            item.meta = null;
          }
        }
        try {
          if (typeof persistVinyl === 'function') persistVinyl(vinyl);
        } catch (e) {}
        if (typeof showToast === 'function')
          showToast(
            track.excludeFromSets ? 'Трек исключён из сета' : 'Трек снова участвует в сетах'
          );
        if (typeof render === 'function') render();
      }
    );
  })();
}

function installRuntCollectionQuickActions() {
  (function () {
    'use strict';
    function safeRender() {
      if (typeof render === 'function') render();
    }
    function makeCollectionQuickActions() {
      return (
        '' +
        '<div class="laiso-mod-label">быстрые действия</div>' +
        '<div class="laiso-row" style="margin:0 0 14px;gap:10px;">' +
        '<button class="laiso-btn laiso-grow" data-action="collection-add-vinyl">+ Добавить пластинку</button>' +
        '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="collection-create-set">+ Собрать сет</button>' +
        '</div>'
      );
    }
    function removeJsonSettings(html) {
      /* Patch #12 - Hide/remove JSON import/export buttons from settings; keep clear/about/help. */ return String(
        html || ''
      )
        .replace(/<button[^>]*data-action="export-json"[\s\S]*?<\/button>/g, '')
        .replace(/<button[^>]*data-action="import-json"[\s\S]*?<\/button>/g, '');
    }
    if (typeof window.viewCollection === 'function') {
      var oldViewCollection = window.viewCollection;
      window.viewCollection = function () {
        var html = oldViewCollection();
        html = removeJsonSettings(html);
        /* Put actions right after tabs if possible. */ var tabsEnd = html.indexOf(
          '</div>',
          html.indexOf('laiso-tabs')
        );
        if (tabsEnd !== -1) {
          html =
            html.slice(0, tabsEnd + 6) + makeCollectionQuickActions() + html.slice(tabsEnd + 6);
        } else {
          html = makeCollectionQuickActions() + html;
        }
        /* Rename settings label if it still exists; JSON is no longer visible. */ html =
          html.replace(
            /<div class="laiso-meta" style="margin-bottom:12px;">Настройки<\/div>/g,
            '<div class="laiso-meta" style="margin-bottom:12px;">Сервис</div>'
          );
        return html;
      };
    }
    if (typeof on === 'function') {
      on('collection-add-vinyl', function () {
        state.view = 'add';
        state.ui.searchQuery = '';
        state.ui.searchResults = [];
        state.ui.searchError = null;
        state.ui.searchLoading = false;
        safeRender();
      });
      on('collection-create-set', function () {
        if (typeof getAllSessionTracks === 'function' && getAllSessionTracks().length === 0) {
          if (typeof showToast === 'function') showToast('Сначала добавь пластинки и треклисты');
          return;
        }
        state.view = 'set';
        state.ui.generatedSet = [];
        state.ui.setLastWarning = null;
        safeRender();
      });
    }
    /* Safety: keep JSON functions available internally, but hide buttons even if collection rerenders differently. */ var style =
      document.createElement('style');
    style.textContent =
      '\n#laiso-app button[data-action="export-json"],\n#laiso-app button[data-action="import-json"]{display:none!important;}\n';
    document.head.appendChild(style);
    safeRender();
  })();
}

function installRuntDiscogsDuplicatePicker() {
  (function () {
    if (typeof window === 'undefined') return;
    function safeEsc(s) {
      if (typeof esc === 'function') return esc(s);
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function norm(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9а-яё\s\-\/\.]/gi, '')
        .trim();
    }
    function splitDiscogsTitle(titleStr) {
      titleStr = String(titleStr || '');
      var dashIdx = titleStr.indexOf(' - ');
      return {
        artist: dashIdx > -1 ? titleStr.slice(0, dashIdx).trim() : '',
        title: dashIdx > -1 ? titleStr.slice(dashIdx + 3).trim() : titleStr.trim(),
      };
    }
    function allVinylsUnique() {
      var arr = [].concat((state && state.vinyls) || [], (state && state.collection) || []);
      var seen = {};
      return arr.filter(function (v) {
        if (!v || !v.id) return false;
        if (seen[v.id]) return false;
        seen[v.id] = true;
        return true;
      });
    }
    function findDuplicateVinyl(discogsId, picked) {
      var parts = splitDiscogsTitle(picked && picked.title);
      var pickedArtist = norm(parts.artist);
      var pickedTitle = norm(parts.title);
      var pickedCatno = norm(picked && picked.catno);
      var pickedLabel = norm(picked && picked.label && picked.label[0]);
      var dId = discogsId ? String(discogsId) : '';
      var all = allVinylsUnique();
      for (var i = 0; i < all.length; i++) {
        var v = all[i];
        if (dId && v.discogsId && String(v.discogsId) === dId) return v;
        var vCatno = norm(v.catno);
        var vLabel = norm(v.label);
        if (pickedCatno && vCatno && pickedCatno === vCatno) {
          if (!pickedLabel || !vLabel || pickedLabel === vLabel) return v;
        }
        var vArtist = norm(v.artist);
        var vTitle = norm(v.title);
        if (pickedArtist && pickedTitle && vArtist === pickedArtist && vTitle === pickedTitle)
          return v;
      }
      return null;
    }
    function isInSession(v) {
      return !!(state.vinyls || []).find(function (x) {
        return x && v && x.id === v.id;
      });
    }
    function useExistingVinyl(v) {
      if (!v) return;
      if (!isInSession(v)) state.vinyls.push(v);
      state.ui.currentVinylId = v.id;
      state.ui.searchResults = [];
      state.ui.searchQuery = '';
      state.ui.searchError = null;
      if (typeof persistVinyl === 'function') persistVinyl(v);
      if (v.tracklist && v.tracklist.length) {
        state.view = 'tracklist';
        state.ui.activeSide = 'A';
        if (typeof showToast === 'function') showToast('Взял пластинку из коллекции');
      } else {
        state.view = 'add';
        if (typeof showToast === 'function') showToast('Пластинка уже была в коллекции');
      }
      if (typeof render === 'function') render();
    }
    function addPickedAsNew(id, picked) {
      if ((state.vinyls || []).length >= SESSION_LIMIT) {
        if (typeof showToast === 'function') showToast('Лимит сессии');
        return;
      }
      var parts = splitDiscogsTitle(picked && picked.title);
      var v = newVinyl({
        source: 'search',
        discogsId: parseInt(id, 10) || null,
        artist: parts.artist,
        title: parts.title,
        coverUrl: (picked && picked.thumb) || '',
        status: 'awaiting',
      });
      state.vinyls.push(v);
      state.ui.searchResults = [];
      state.ui.searchQuery = '';
      state.ui.searchError = null;
      if (typeof render === 'function') render();
      discogsRelease(parseInt(id, 10))
        .then(function (rel) {
          var mapped = mapDiscogsRelease(rel);
          Object.assign(v, mapped);
          v.status = 'recognized';
          v.confidence = 1;
          if (typeof persistVinyl === 'function') persistVinyl(v);
          if (typeof render === 'function') render();
        })
        .catch(function (err) {
          v.status = 'not_found';
          if (typeof showToast === 'function')
            showToast(
              err && err.message === 'rate-limit'
                ? 'Discogs rate-limit'
                : 'Не удалось получить релиз'
            );
          if (typeof render === 'function') render();
        });
    }
    if (typeof on === 'function') {
      on('search-pick', async function (_, el) {
        if ((state.vinyls || []).length >= SESSION_LIMIT) {
          if (typeof showToast === 'function') showToast('Лимит сессии');
          return;
        }
        var id = el && el.dataset && el.dataset.id;
        if (!id) return;
        var picked = (state.ui.searchResults || []).find(function (r) {
          return String(r.id) === String(id);
        });
        var duplicate = findDuplicateVinyl(id, picked);
        if (duplicate) {
          if (isInSession(duplicate)) {
            var openIt = await vertaxConfirm(
              'Эта пластинка уже добавлена в текущую сессию. Открыть её треклист?'
            );
            if (openIt) useExistingVinyl(duplicate);
            else if (typeof showToast === 'function') showToast('Не добавляю дубль');
            return;
          }
          var useOld = await vertaxConfirm(
            'Эта пластинка уже есть в коллекции.\n\n' +
              'OK — взять существующую из коллекции.\n' +
              'Отмена — добавить как отдельный дубль.'
          );
          if (useOld) {
            useExistingVinyl(duplicate);
            return;
          }
        }
        addPickedAsNew(id, picked);
      });
    }
  })();
}

function installRuntAddTrackFromCollection() {
  /* ============================================================ RUNT-01 PATCH 15 — Fix: Add track from collection Put this block LAST, after all previous patches. ============================================================ */
  (function () {
    if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
      console.warn('RUNT patch-15: laisoBuck is not ready');
      return;
    }
    var state = window.laisoBuck.state;
    var oldRender = window.laisoBuck.render;
    var oldRenderModal = typeof renderModal === 'function' ? renderModal : null;
    var oldViewSet = typeof viewSet === 'function' ? viewSet : null;
    function safeEsc(s) {
      if (typeof esc === 'function') return esc(s);
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function getTrackIdentity(t) {
      if (!t) return '';
      var parts = [
        t.recordId || t.vinylId || '',
        t.id || t.trackId || '',
        (t.title || '').toLowerCase().trim(),
        (t.vinylArtist || '').toLowerCase().trim(),
        (t.vinylTitle || '').toLowerCase().trim(),
        (t.position || t.displayPosition || '').toLowerCase().trim(),
      ];
      return parts.join('|');
    }
    function isSameTrack(a, b) {
      if (!a || !b) return false;
      if (a.id && b.id && String(a.id) === String(b.id)) return true;
      if (a.trackId && b.id && String(a.trackId) === String(b.id)) return true;
      if (a.id && b.trackId && String(a.id) === String(b.trackId)) return true;
      var sameRecord =
        String(a.recordId || a.vinylId || '') === String(b.recordId || b.vinylId || '');
      var samePos =
        String(a.position || a.displayPosition || '')
          .toLowerCase()
          .trim() ===
        String(b.position || b.displayPosition || '')
          .toLowerCase()
          .trim();
      var sameTitle =
        String(a.title || '')
          .toLowerCase()
          .trim() ===
        String(b.title || '')
          .toLowerCase()
          .trim();
      return !!(sameRecord && (samePos || sameTitle));
    }
    function setContainsTrack(track) {
      var set = state.ui.generatedSet || [];
      return set.some(function (x) {
        return isSameTrack(x, track);
      });
    }
    function getCollectionTracks() {
      var out = [];
      var seen = {};
      var collection = state.collection || [];
      collection.forEach(function (v) {
        if (!v || v.excludeFromSets || !Array.isArray(v.tracklist)) return;
        v.tracklist.forEach(function (t) {
          if (!t || t.excludeFromSets) return;
          var pos =
            typeof displayPosition === 'function' ? displayPosition(t, v) : t.position || '—';
          var item = {
            id: t.id,
            position: t.position || pos,
            displayPosition: pos,
            side: t.side || (pos ? String(pos).charAt(0) : ''),
            title: t.title || '—',
            duration: t.duration || '',
            bpm: t.bpm || null,
            key: t.key || null,
            camelot: t.camelot || null,
            originalBpm: t.originalBpm || null,
            bpmSource: t.bpmSource || null,
            recordId: v.id,
            vinylTitle: v.title || '',
            vinylArtist: v.artist || '',
            vinylCatno: v.catno || '',
            vinylLabel: v.label || '',
          };
          var ident = getTrackIdentity(item);
          if (!seen[ident]) {
            seen[ident] = true;
            out.push(item);
          }
        });
      });
      var q = String(state.ui.addTrackSearch || '')
        .toLowerCase()
        .trim();
      if (q) {
        out = out.filter(function (t) {
          return [
            t.title,
            t.vinylArtist,
            t.vinylTitle,
            t.vinylCatno,
            t.vinylLabel,
            t.bpm,
            t.key,
            t.camelot,
            t.displayPosition,
          ].some(function (x) {
            return (
              String(x || '')
                .toLowerCase()
                .indexOf(q) >= 0
            );
          });
        });
      }
      var sort = state.ui.addTrackSort || 'smart';
      out.sort(function (a, b) {
        if (sort === 'bpm') {
          if (!a.bpm && !b.bpm) return 0;
          if (!a.bpm) return 1;
          if (!b.bpm) return -1;
          return a.bpm - b.bpm;
        }
        if (sort === 'camelot') {
          if (!a.camelot && !b.camelot) return 0;
          if (!a.camelot) return 1;
          if (!b.camelot) return -1;
          var na = parseInt(a.camelot, 10),
            nb = parseInt(b.camelot, 10);
          if (na !== nb) return na - nb;
          return String(a.camelot).slice(-1).localeCompare(String(b.camelot).slice(-1));
        }
        if (sort === 'title') return String(a.title).localeCompare(String(b.title));
        /* smart: if set already exists, show compatible tracks first */ var set =
          state.ui.generatedSet || [];
        var last = set[set.length - 1];
        if (last) {
          var as = compatibilityScore(last, a);
          var bs = compatibilityScore(last, b);
          if (bs !== as) return bs - as;
        }
        return String(a.vinylArtist + ' ' + a.title).localeCompare(
          String(b.vinylArtist + ' ' + b.title)
        );
      });
      return out;
    }
    function compatibilityScore(prev, cand) {
      var score = 0;
      if (!prev || !cand) return score;
      if (prev.recordId && cand.recordId && prev.recordId !== cand.recordId) score += 4;
      if (prev.bpm && cand.bpm) {
        var diff = Math.abs(cand.bpm - prev.bpm);
        if (diff <= 2) score += 5;
        else if (diff <= 4) score += 3;
        else if (diff <= 6) score += 1;
      }
      if (prev.camelot && cand.camelot && typeof camelotNeighbors === 'function') {
        if (prev.camelot === cand.camelot) score += 4;
        else if (camelotNeighbors(prev.camelot).indexOf(cand.camelot) >= 0) score += 3;
      }
      return score;
    }
    function renderAddTrackModal() {
      var tracks = getCollectionTracks();
      var set = state.ui.generatedSet || [];
      var last = set[set.length - 1] || null;
      var rows = tracks.length
        ? tracks
            .map(function (t, idx) {
              var duplicate = setContainsTrack(t);
              var sameVinylAsLast =
                last && last.recordId && t.recordId && String(last.recordId) === String(t.recordId);
              var warn = duplicate ? 'УЖЕ В СЕТЕ' : sameVinylAsLast ? 'ТА ЖЕ ПЛАСТИНКА' : '';
              var disabled = duplicate ? ' disabled' : '';
              var cls = duplicate ? ' style="opacity:.48;"' : '';
              return (
                '' +
                '<div class="laiso-addtrack-row"' +
                cls +
                '>' +
                '<div class="laiso-addtrack-main">' +
                '<div class="laiso-addtrack-title">' +
                safeEsc(t.title) +
                '</div>' +
                '<div class="laiso-addtrack-meta">' +
                safeEsc(t.vinylArtist || '') +
                ' — ' +
                safeEsc(t.vinylTitle || '') +
                (t.vinylCatno ? ' · ' + safeEsc(t.vinylCatno) : '') +
                '</div>' +
                '<div class="laiso-addtrack-pills">' +
                '<span>' +
                safeEsc(t.displayPosition || t.position || '—') +
                '</span>' +
                '<span>' +
                (t.bpm ? safeEsc(t.bpm + ' BPM') : 'BPM —') +
                '</span>' +
                '<span>' +
                (t.camelot ? safeEsc(t.camelot) : 'CAM —') +
                '</span>' +
                (warn ? '<span class="warn">' + warn + '</span>' : '') +
                '</div>' +
                '</div>' +
                '<button class="laiso-btn laiso-btn-sm" data-action="set-add-track-pick" data-track-idx="' +
                idx +
                '"' +
                disabled +
                '>Добавить</button>' +
                '</div>'
              );
            })
            .join('')
        : '<div class="laiso-empty">Подходящих треков не найдено.<br>Проверь коллекцию или очисти поиск.</div>';
      return (
        '' +
        '<div class="laiso-modal-bg" data-action="close-modal-bg">' +
        '<div class="laiso-modal laiso-addtrack-modal" data-stop>' +
        '<div class="laiso-row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h2 class="laiso-modal-title">Добавить трек из коллекции</h2>' +
        '<button class="laiso-back" data-action="close-modal">Закрыть</button>' +
        '</div>' +
        '<input class="laiso-input" type="search" placeholder="Поиск: трек / артист / пластинка / BPM / Camelot" value="' +
        safeEsc(state.ui.addTrackSearch || '') +
        '" data-action="add-track-search">' +
        '<div class="laiso-row" style="gap:6px;margin:10px 0 12px;">' +
        ['smart', 'bpm', 'camelot', 'title']
          .map(function (s) {
            var label = { smart: 'Умно', bpm: 'BPM', camelot: 'Camelot', title: 'A–Z' }[s];
            return (
              '<button class="laiso-chip ' +
              ((state.ui.addTrackSort || 'smart') === s ? 'active' : '') +
              '" data-action="add-track-sort" data-sort="' +
              s +
              '">' +
              label +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="laiso-addtrack-list">' +
        rows +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }
    function patchButtonIntoSet(html) {
      if (!html || html.indexOf('data-action="open-add-track-modal"') >= 0) return html;
      /* Replace old broken button if it exists. */ html = html.replace(
        /data-action="add-track-from-collection"/g,
        'data-action="open-add-track-modal"'
      );
      /* If button already appears visually with different action, action replacement above is enough. */ if (
        html.indexOf('Добавить трек из коллекции') >= 0
      )
        return html;
      /* Insert button before export/save row when a set exists. */ var insert =
        '<button class="laiso-btn laiso-btn-secondary laiso-btn-block" data-action="open-add-track-modal" style="margin-top:14px;">+ Добавить трек из коллекции</button>';
      var marker =
        '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="set-export"';
      var pos = html.indexOf(marker);
      if (pos >= 0) return html.slice(0, pos) + insert + html.slice(pos);
      /* Fallback: add at bottom of set constructor. */ return html + insert;
    }
    if (oldViewSet) {
      window.viewSet = viewSet = function () {
        return patchButtonIntoSet(oldViewSet.apply(this, arguments));
      };
    }
    window.renderModal = renderModal = function () {
      if (state.modal === 'add-track-from-collection') return renderAddTrackModal();
      return oldRenderModal ? oldRenderModal.apply(this, arguments) : '';
    };
    function rerender() {
      if (typeof render === 'function') render();
      else if (window.laisoBuck && window.laisoBuck.render) window.laisoBuck.render();
    }
    if (typeof on === 'function') {
      on('open-add-track-modal', function () {
        state.modal = 'add-track-from-collection';
        state.ui.addTrackSearch = state.ui.addTrackSearch || '';
        state.ui.addTrackSort = state.ui.addTrackSort || 'smart';
        rerender();
      });
      /* Support old action name too. */ on('add-track-from-collection', function () {
        state.modal = 'add-track-from-collection';
        state.ui.addTrackSearch = state.ui.addTrackSearch || '';
        state.ui.addTrackSort = state.ui.addTrackSort || 'smart';
        rerender();
      });
      on('add-track-search', function (e, el) {
        state.ui.addTrackSearch = el.value || '';
        rerender();
        setTimeout(function () {
          var input = document.querySelector('#laiso-app input[data-action="add-track-search"]');
          if (input) {
            input.focus();
            try {
              input.setSelectionRange(input.value.length, input.value.length);
            } catch (_) {}
          }
        }, 0);
      });
      on('add-track-sort', function (_, el) {
        state.ui.addTrackSort = el.dataset.sort || 'smart';
        rerender();
      });
      on('set-add-track-pick', async function (_, el) {
        var tracks = getCollectionTracks();
        var idx = parseInt(el.dataset.trackIdx, 10);
        var track = tracks[idx];
        if (!track) {
          if (typeof showToast === 'function') showToast('Трек не найден');
          return;
        }
        state.ui.generatedSet = state.ui.generatedSet || [];
        if (setContainsTrack(track)) {
          if (typeof showToast === 'function') showToast('Этот трек уже есть в сете');
          return;
        }
        var last = state.ui.generatedSet[state.ui.generatedSet.length - 1];
        if (
          last &&
          last.recordId &&
          track.recordId &&
          String(last.recordId) === String(track.recordId)
        ) {
          var ok = await vertaxConfirm(
            'Этот трек с той же пластинки, что и предыдущий. Добавить всё равно? Лучше переставить порядок после добавления.'
          );
          if (!ok) return;
        }
        state.ui.generatedSet.push(Object.assign({}, track));
        state.modal = null;
        state.ui.addTrackSearch = '';
        if (typeof showToast === 'function') showToast('Трек добавлен в сет');
        rerender();
      });
    }
    /* Extra CSS for modal/list. */ var css = document.createElement('style');
    css.textContent =
      '\ #laiso-app .laiso-addtrack-modal{max-width:720px!important;}\ #laiso-app .laiso-addtrack-list{display:flex;flex-direction:column;gap:8px;max-height:58vh;overflow:auto;padding-right:2px;}\ #laiso-app .laiso-addtrack-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--border, #E2D9CD);border-radius:16px;background:#fff;}\ #laiso-app .laiso-addtrack-title{font-weight:700;font-size:15px;line-height:1.15;color:var(--text-primary,#111);}\ #laiso-app .laiso-addtrack-meta{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--text-tertiary,#8A847B);margin-top:4px;}\ #laiso-app .laiso-addtrack-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}\ #laiso-app .laiso-addtrack-pills span{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#F0ECE3;font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#111;}\ #laiso-app .laiso-addtrack-pills span.warn{background:#FFF0E8;color:var(--warning,#E66A2C);}\ @media(max-width:520px){#laiso-app .laiso-addtrack-row{grid-template-columns:1fr;gap:10px;}#laiso-app .laiso-addtrack-row .laiso-btn{width:100%;}}\ ';
    document.head.appendChild(css);
    /* Force redraw so button appears immediately if user is already on set screen. */ rerender();
  })();
}

function installRuntScopeAndFetchingControls() {
  /* ============================================================ RUNT-01 PATCH 16 Fixes: 1) BPM x2 / ÷2 never disappears; repeated ÷2 is blocked safely. 2) Manual BPM/Key entry on fetching screen continues through next unresolved tracks. 3) Set constructor gets source scope: session only / whole collection. 4) Generated sets use selected scope, not always whole collection. 5) No duplicate tracks by title+artist+vinyl and no same vinyl back-to-back. Put this patch AFTER all previous patches. ============================================================ */
  (function () {
    'use strict';
    if (!window.laisoBuck || !window.laisoBuck.state) {
      console.warn('RUNT-01 patch-16: laisoBuck state not found');
      return;
    }
    var state = window.laisoBuck.state;
    var oldRender = window.laisoBuck.render;
    /* ---------- helpers ---------- */ function esc(s) {
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function toast(msg) {
      if (typeof showToast === 'function') showToast(msg);
      else alert(msg);
    }
    function norm(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    }
    function trackUniqKey(t) {
      return [
        norm(t.vinylArtist),
        norm(t.vinylTitle),
        norm(t.title),
        norm(t.displayPosition || t.position),
      ].join('|');
    }
    function findVinylSafe(id) {
      if (typeof findVinyl === 'function') return findVinyl(id);
      var all = [].concat(state.vinyls || [], state.collection || []);
      return (
        all.find(function (v) {
          return v && v.id === id;
        }) || null
      );
    }
    function findTrackSafe(v, tid) {
      if (!v || !v.tracklist) return null;
      return (
        v.tracklist.find(function (t) {
          return t && t.id === tid;
        }) || null
      );
    }
    function persist(v) {
      if (typeof persistVinyl === 'function') persistVinyl(v);
    }
    function parseBpmValue(raw) {
      if (raw == null) return null;
      var s = String(raw).replace(',', '.').trim();
      if (!s) return null;
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return false;
      var n = parseFloat(s);
      if (!isFinite(n) || n < 40 || n > 220) return false;
      return Math.round(n * 10) / 10;
    }
    function parseKeyValue(raw) {
      if (raw == null) return { empty: true };
      var s = String(raw).trim();
      if (!s) return { empty: true };
      var camel = s.toUpperCase().replace(/\s+/g, '');
      if (/^(1[0-2]|[1-9])[AB]$/.test(camel)) {
        var keyFromCamelot =
          typeof CAMELOT_TO_KEY !== 'undefined' && CAMELOT_TO_KEY[camel]
            ? CAMELOT_TO_KEY[camel]
            : camel;
        return { key: keyFromCamelot, camelot: camel };
      }
      if (typeof normalizeKeyName === 'function') {
        var nk = normalizeKeyName(s);
        if (nk && typeof KEY_TO_CAMELOT !== 'undefined' && KEY_TO_CAMELOT[nk])
          return { key: nk, camelot: KEY_TO_CAMELOT[nk] };
      }
      if (typeof normalizeKey === 'function') {
        var nk2 = normalizeKey(s);
        if (nk2 && typeof KEY_TO_CAMELOT !== 'undefined' && KEY_TO_CAMELOT[nk2])
          return { key: nk2, camelot: KEY_TO_CAMELOT[nk2] };
      }
      return false;
    }
    state.ui = state.ui || {};
    if (!state.ui.setScope) state.ui.setScope = 'session';
    /* session | collection */ if (!state.ui.fetchManualFlow)
      state.ui.fetchManualFlow = { active: false };
    /* ---------- scope-aware track list ---------- */ window.runtGetTracksByScope = function (
      scope,
      opts
    ) {
      opts = opts || {};
      var includeAll = !!opts.includeAll;
      var source = scope === 'collection' ? state.collection || [] : state.vinyls || [];
      var out = [];
      var seenVinyl = {};
      source.forEach(function (v) {
        if (!v || !v.id || !v.tracklist || seenVinyl[v.id]) return;
        seenVinyl[v.id] = true;
        if (!includeAll && v.excludeFromSets) return;
        v.tracklist.forEach(function (t) {
          if (!t) return;
          if (!includeAll && t.excludeFromSets) return;
          var pos = t.position || '';
          if (typeof displayPosition === 'function') {
            try {
              pos = displayPosition(t, v);
            } catch (_e) {}
          }
          out.push({
            id: t.id,
            position: t.position,
            displayPosition: pos,
            side: t.side,
            title: t.title,
            duration: t.duration,
            bpm: t.bpm,
            key: t.key,
            camelot: t.camelot,
            originalBpm: t.originalBpm || null,
            bpmSource: t.bpmSource || null,
            recordId: v.id,
            vinylTitle: v.title,
            vinylArtist: v.artist,
            vinylCatno: v.catno || '',
            vinylLabel: v.label || '',
            vinylExcluded: !!v.excludeFromSets,
            trackExcluded: !!t.excludeFromSets,
          });
        });
      });
      return out;
    };
    /* Override global getAllSessionTracks gently so old code also respects selected scope on set screen. */ window.getAllSessionTracks =
      function (opts) {
        var scope =
          state.view === 'set' && state.ui && state.ui.setScope ? state.ui.setScope : 'session';
        return window.runtGetTracksByScope(scope, opts || {});
      };
    /* ---------- BPM x2 / ÷2 robust handlers ---------- */ function getPair(el) {
      var v = findVinylSafe(el.dataset.vid);
      var t = v && findTrackSafe(v, el.dataset.tid);
      return { v: v, t: t };
    }
    window.runtApplyX2 = function (v, t) {
      if (!v || !t || !t.bpm) return;
      if (!t.originalBpm) t.originalBpm = t.bpm;
      t.bpm = Math.round(Number(t.bpm) * 2 * 10) / 10;
      if (t.bpm > 220) {
        t.bpm = Math.round((Number(t.originalBpm) || Number(t.bpm) / 2) * 10) / 10;
        toast('BPM выше 220 не сохраняю');
        return;
      }
      t.halftimeCorrected = true;
      t.bpmSource = 'manual_x2';
      persist(v);
    };
    window.runtApplyDivide2 = function (v, t) {
      if (!v || !t || !t.bpm) return;
      /* If we already have originalBpm, ÷2 means "revert once". Second click should not keep halving into nonsense. */ if (
        t.originalBpm
      ) {
        t.bpm = t.originalBpm;
        t.originalBpm = null;
        t.halftimeCorrected = false;
        t.bpmSource = 'manual';
        persist(v);
        return;
      }
      var next = Math.round((Number(t.bpm) / 2) * 10) / 10;
      if (next < 40) {
        toast('Ниже 40 BPM не делю');
        return;
      }
      t.originalBpm = t.bpm;
      t.bpm = next;
      t.halftimeCorrected = true;
      t.bpmSource = 'manual_div2';
      persist(v);
    };
    if (typeof on === 'function') {
      on('bpm-x2', function (_e, el) {
        var p = getPair(el);
        window.runtApplyX2(p.v, p.t);
        toast('BPM обновлён');
        if (typeof render === 'function') render();
      });
      on('bpm-divide-2', function (_e, el) {
        var p = getPair(el);
        window.runtApplyDivide2(p.v, p.t);
        toast('BPM обновлён');
        if (typeof render === 'function') render();
      });
    }
    /* ---------- manual metadata flow through unresolved tracks ---------- */ function getFetchingVinyl() {
      var fp = state.ui.fetchProgress || {};
      return findVinylSafe(fp.vinylId);
    }
    function getUnresolvedFetchItems() {
      var v = getFetchingVinyl();
      var fp = state.ui.fetchProgress || {};
      var items = fp.items || [];
      if (!v) return [];
      return items.filter(function (it) {
        var t = findTrackSafe(v, it.trackId);
        return t && !t.excludeFromSets && (!t.bpm || !t.camelot);
      });
    }
    async function openManualMetaForItem(item) {
      if (!item) return;
      var v = getFetchingVinyl();
      var t = v && findTrackSafe(v, item.trackId);
      if (!t) return;
      var bpmRaw = await vertaxPrompt(
        'BPM для «' + (t.title || 'трек') + '» (40–220):',
        t.bpm || ''
      );
      if (bpmRaw === null) return false;
      var bpm = parseBpmValue(bpmRaw);
      if (bpm === false) {
        toast('BPM должен быть числом 40–220');
        return openManualMetaForItem(item);
      }
      var keyRaw = await vertaxPrompt(
        'Camelot / Key для «' + (t.title || 'трек') + '» (например 8A, D minor, Am):',
        t.camelot || t.key || ''
      );
      if (keyRaw === null) return false;
      var key = parseKeyValue(keyRaw);
      if (key === false) {
        toast('Тональность не распознана. Пример: 8A, 7B, D minor, Am');
        return openManualMetaForItem(item);
      }
      if (bpm !== null) {
        t.bpm = bpm;
        t.bpmSource = 'manual';
      } else {
        t.bpm = null;
        t.bpmSource = null;
      }
      if (!key.empty) {
        t.key = key.key;
        t.camelot = key.camelot;
        t.keySource = 'manual';
      } else {
        t.key = null;
        t.camelot = null;
        t.keySource = null;
      }
      t.originalBpm = null;
      t.halftimeCorrected = false;
      t.conflict = null;
      t.confidence = t.bpm && t.camelot ? 'medium' : 'manual';
      item.status = t.bpm || t.camelot ? 'ok' : 'notfound';
      item.meta = {
        bpm: t.bpm,
        key: t.key,
        camelot: t.camelot,
        source: 'manual',
        confidence: t.confidence,
      };
      persist(v);
      return true;
    }
    window.runtManualMetaFlow = async function (startTrackId) {
      var items = getUnresolvedFetchItems();
      if (startTrackId) {
        items.sort(function (a, b) {
          return (a.trackId === startTrackId ? -1 : 0) + (b.trackId === startTrackId ? 1 : 0);
        });
      }
      if (!items.length) {
        toast('Все значения заполнены');
        if (typeof render === 'function') render();
        return;
      }
      for (var i = 0; i < items.length; i++) {
        var ok = await openManualMetaForItem(items[i]);
        if (ok === false) break;
        var left = getUnresolvedFetchItems().length;
        if (left > 0) {
          var go = await vertaxConfirm(
            'Заполнить следующий нераспознанный трек? Осталось: ' + left
          );
          if (!go) break;
        }
      }
      if (typeof render === 'function') render();
    };
    if (typeof on === 'function') {
      on('fetch-manual-next', function () {
        window.runtManualMetaFlow();
      });
      on('fetch-edit-this', function (_e, el) {
        window.runtManualMetaFlow(el.dataset.tid);
      });
      on('track-manual-meta', async function (_e, el) {
        var v = findVinylSafe(el.dataset.vid);
        var t = v && findTrackSafe(v, el.dataset.tid);
        if (!t) return;
        var bpmRaw = await vertaxPrompt('BPM (40–220) или пусто:', t.bpm || '');
        if (bpmRaw === null) return;
        var bpm = parseBpmValue(bpmRaw);
        if (bpm === false) {
          toast('BPM должен быть числом 40–220');
          return;
        }
        var keyRaw = await vertaxPrompt('Camelot / Key или пусто:', t.camelot || t.key || '');
        if (keyRaw === null) return;
        var key = parseKeyValue(keyRaw);
        if (key === false) {
          toast('Тональность не распознана');
          return;
        }
        if (bpm !== null) {
          t.bpm = bpm;
          t.bpmSource = 'manual';
        } else {
          t.bpm = null;
          t.bpmSource = null;
        }
        if (!key.empty) {
          t.key = key.key;
          t.camelot = key.camelot;
          t.keySource = 'manual';
        } else {
          t.key = null;
          t.camelot = null;
          t.keySource = null;
        }
        t.originalBpm = null;
        t.halftimeCorrected = false;
        t.conflict = null;
        t.confidence = t.bpm && t.camelot ? 'medium' : 'manual';
        var fp = state.ui.fetchProgress || {};
        (fp.items || []).forEach(function (item) {
          if (item && item.trackId === t.id) {
            item.status = t.bpm || t.camelot ? 'ok' : 'notfound';
            item.meta = {
              bpm: t.bpm || null,
              key: t.key || null,
              camelot: t.camelot || null,
              source: 'manual',
              confidence: t.confidence,
            };
          }
        });
        persist(v);
        toast('Сохранено');
        if (typeof render === 'function') render();
      });
    }
    /* ---------- duplicate-track-free generation ---------- */ window.runtGenerateSet = function (
      mode,
      opts,
      length
    ) {
      length = length || (typeof SET_LENGTH !== 'undefined' ? SET_LENGTH : 8);
      opts = opts || state.ui.setOptions || {};
      var scope = state.ui.setScope || 'session';
      var all = window.runtGetTracksByScope(scope);
      var filtered = all.filter(function (t) {
        if (mode === 'tempo-safe' || mode === 'best-flow') return !!t.bpm;
        if (mode === 'camelot-safe') return !!t.camelot;
        if (mode === 'camelot-filter') {
          var s = opts.camelotSet || {};
          return t.camelot && s[t.camelot];
        }
        return true;
      });
      /* Deduplicate identical track identity before algorithm. */ var seen = {};
      filtered = filtered.filter(function (t) {
        var k = trackUniqKey(t);
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      if (filtered.length < 2) return [];
      var result = [];
      if (typeof generateSetAlgo === 'function') {
        result = generateSetAlgo(filtered, mode, opts, length) || [];
      }
      /* Final safety pass: no duplicate track identity, no same vinyl back-to-back. */ var clean =
        [];
      var used = {};
      result.forEach(function (t) {
        var k = trackUniqKey(t);
        var prev = clean[clean.length - 1];
        if (used[k]) return;
        if (prev && prev.recordId === t.recordId) return;
        used[k] = true;
        clean.push(t);
      });
      return clean;
    };
    if (typeof on === 'function') {
      on('set-scope', function (_e, el) {
        state.ui.setScope = el.dataset.scope || 'session';
        state.ui.generatedSet = [];
        state.ui.setLastWarning = null;
        if (typeof render === 'function') render();
      });
      on('set-generate', function () {
        state.ui.setLastWarning = null;
        var mode = state.ui.setMode || 'best-flow';
        if (mode === 'custom') {
          state.ui.generatedSet = state.ui.generatedSet || [];
          toast('Добавляй треки вручную из коллекции');
          if (typeof render === 'function') render();
          return;
        }
        var tracksAll = window.runtGetTracksByScope(state.ui.setScope || 'session');
        if (!tracksAll.length) {
          state.ui.setLastWarning = 'no-tracks';
          toast(
            state.ui.setScope === 'collection'
              ? 'В коллекции нет треков'
              : 'В текущей сессии нет треков'
          );
          if (typeof render === 'function') render();
          return;
        }
        var result = window.runtGenerateSet(
          mode,
          state.ui.setOptions || {},
          typeof SET_LENGTH !== 'undefined' ? SET_LENGTH : 8
        );
        state.ui.generatedSet = result;
        if (result.length < 2) {
          state.ui.setLastWarning = 'not-enough-data';
          state.ui.setOpenDataPanel = true;
          toast('Не удалось собрать сет. Проверь BPM/Camelot или смени источник.');
        } else if (result.length < (typeof SET_LENGTH !== 'undefined' ? SET_LENGTH : 8)) {
          state.ui.setLastWarning = 'short-set';
          toast('Собрано ' + result.length + ' треков. Без дублей и без одной пластинки подряд.');
        }
        if (typeof render === 'function') render();
      });
    }
    /* ---------- render overrides ---------- */ var oldViewSet =
      typeof viewSet === 'function' ? viewSet : null;
    if (oldViewSet) {
      window.viewSet = viewSet = function () {
        var html = oldViewSet();
        var scope = state.ui.setScope || 'session';
        var sessionCount = window.runtGetTracksByScope('session').length;
        var collectionCount = window.runtGetTracksByScope('collection').length;
        var scopePanel =
          '' +
          '<div class="laiso-mod-label">источник треков</div>' +
          '<div class="laiso-tabs" style="margin-bottom:12px;">' +
          '<button class="laiso-tab ' +
          (scope === 'session' ? 'active' : '') +
          '" data-action="set-scope" data-scope="session">Добавленные · ' +
          sessionCount +
          '</button>' +
          '<button class="laiso-tab ' +
          (scope === 'collection' ? 'active' : '') +
          '" data-action="set-scope" data-scope="collection">Вся коллекция · ' +
          collectionCount +
          '</button>' +
          '</div>' +
          '<div class="laiso-hint" style="margin:-4px 2px 12px;">По умолчанию сет собирается только из пластинок, добавленных в текущую сессию. Можно переключиться на всю коллекцию.</div>';
        /* Insert after header/title and before mode tabs. If exact marker not found, insert before first tabs. */ if (
          html.indexOf('<div class="laiso-tabs laiso-tabs-modes"') >= 0
        ) {
          html = html.replace(
            '<div class="laiso-tabs laiso-tabs-modes"',
            scopePanel + '<div class="laiso-tabs laiso-tabs-modes"'
          );
        } else if (html.indexOf('<div class="laiso-tabs"') >= 0) {
          html = html.replace('<div class="laiso-tabs"', scopePanel + '<div class="laiso-tabs"');
        }
        return html;
      };
    }
    var oldViewFetching = typeof viewFetching === 'function' ? viewFetching : null;
    if (oldViewFetching) {
      window.viewFetching = viewFetching = function () {
        var html = oldViewFetching();
        var unresolved = getUnresolvedFetchItems().length;
        if (unresolved > 0) {
          var panel =
            '' +
            '<div class="laiso-panel laiso-data-panel" style="margin-top:12px;">' +
            '<div class="laiso-data-head"><strong>Остались треки без BPM / Camelot</strong><span class="laiso-meta">' +
            unresolved +
            ' шт.</span></div>' +
            '<p class="laiso-data-hint">Можно быстро пройти их по очереди: ввёл один, приложение спросит следующий.</p>' +
            '<button class="laiso-btn laiso-btn-block" data-action="fetch-manual-next">Ввести значения по очереди</button>' +
            '</div>';
          /* Put before the Continue button if possible. */ html = html.replace(
            /(<button class="laiso-btn laiso-btn-block" data-action="fetching-done">[^<]*<\/button>)/,
            panel + '$1'
          );
        }
        return html;
      };
    }
    /* Patch set-card buttons so both x2 and divide2 are always visible when BPM exists. */ var oldViewSet2 =
      window.viewSet;
    if (oldViewSet2) {
      window.viewSet = viewSet = function () {
        var html = oldViewSet2();
        /* If older render only has one button, leave this mostly to CSS/handlers. We cannot safely parse every row here. */ return html;
      };
    }
    /* Update render exposure. */ window.laisoBuck.render = function () {
      if (typeof render === 'function') return render();
      return oldRender && oldRender();
    };
    if (typeof render === 'function') render();
  })();
}

function installRuntGeneratedSetCache() {
  /* ============================================================ RUNT-01 PATCH 16.1 Add-on for patch-16, kept in the same replacement file: remember generated set per mode + source scope during session. ============================================================ */
  (function () {
    'use strict';
    if (!window.laisoBuck || !window.laisoBuck.state) return;
    var state = window.laisoBuck.state;
    state.ui = state.ui || {};
    state.ui.generatedSetsByMode = state.ui.generatedSetsByMode || {};
    function cacheKey(mode, scope) {
      return (
        (scope || state.ui.setScope || 'session') + '::' + (mode || state.ui.setMode || 'best-flow')
      );
    }
    function saveGenerated() {
      state.ui.generatedSetsByMode[cacheKey()] = (state.ui.generatedSet || []).slice();
    }
    function restoreGenerated() {
      state.ui.generatedSet = (state.ui.generatedSetsByMode[cacheKey()] || []).slice();
    }
    if (typeof on === 'function') {
      on('set-mode', function (_e, el) {
        saveGenerated();
        state.ui.setMode = el.dataset.mode || 'best-flow';
        state.ui.setLastWarning = null;
        restoreGenerated();
        if (typeof render === 'function') render();
      });
      on('set-scope', function (_e, el) {
        saveGenerated();
        state.ui.setScope = el.dataset.scope || 'session';
        state.ui.setLastWarning = null;
        restoreGenerated();
        if (typeof render === 'function') render();
      });
      var oldSetGenerate =
        typeof handlers !== 'undefined' && handlers['set-generate']
          ? handlers['set-generate']
          : null;
      on('set-generate', function (e, el) {
        if (oldSetGenerate) oldSetGenerate(e, el);
        state.ui.generatedSetsByMode[cacheKey()] = (state.ui.generatedSet || []).slice();
        if ((state.ui.generatedSet || []).length >= 2 && !state.ui.setLastWarning) {
          try {
            if (typeof haptic === 'function') haptic('success');
          } catch (_) {}
        }
      });
    }
  })();
}

function installRuntCollectionPickModal() {
  (function () {
    'use strict';
    function hasBase() {
      return (
        window.laisoBuck && window.laisoBuck.state && typeof window.laisoBuck.render === 'function'
      );
    }
    if (!hasBase()) {
      console.warn('RUNT-01 PATCH-17: base app not found');
      return;
    }
    var state = window.laisoBuck.state;
    var oldRender = window.laisoBuck.render;
    var handlersRef = null;
    function esc17(s) {
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function toast17(msg) {
      state.toast = msg;
      window.laisoBuck.render();
      if (state._patch17ToastT) clearTimeout(state._patch17ToastT);
      state._patch17ToastT = setTimeout(function () {
        state.toast = null;
        window.laisoBuck.render();
      }, 2600);
    }
    function sessionTracks17() {
      if (typeof window.getAllSessionTracks === 'function') return window.getAllSessionTracks();
      if (typeof getAllSessionTracks === 'function') return getAllSessionTracks();
      var out = [];
      (state.vinyls || []).forEach(function (v) {
        if (v && !v.excludeFromSets && Array.isArray(v.tracklist)) {
          v.tracklist.forEach(function (t) {
            if (!t.excludeFromSets) out.push(t);
          });
        }
      });
      return out;
    }
    function collectionTracks17() {
      var out = [];
      (state.collection || []).forEach(function (v) {
        if (v && !v.excludeFromSets && Array.isArray(v.tracklist)) {
          v.tracklist.forEach(function (t) {
            if (!t.excludeFromSets) out.push(t);
          });
        }
      });
      return out;
    }
    function usableCollectionVinyls17() {
      return (state.collection || []).filter(function (v) {
        return v && Array.isArray(v.tracklist) && v.tracklist.length > 0 && !v.excludeFromSets;
      });
    }
    function ensurePatch17State() {
      state.ui = state.ui || {};
      state.ui.patch17Pick = state.ui.patch17Pick || { query: '', selected: {}, mode: 'vinyls' };
      if (!state.ui.setOptions) state.ui.setOptions = {};
      if (!state.ui.setScope) state.ui.setScope = state.ui.setOptions.setScope || 'session';
    }
    ensurePatch17State();
    function goSetWithScope17(scope) {
      ensurePatch17State();
      state.ui.setScope = scope;
      state.ui.setOptions.setScope = scope;
      state.view = 'set';
      if (!state.ui.generatedSet) state.ui.generatedSet = [];
      window.laisoBuck.render();
    }
    function openPickModal17() {
      ensurePatch17State();
      state.modal = 'patch17-pick-vinyls';
      window.laisoBuck.render();
    }
    function addSelectedToSession17() {
      ensurePatch17State();
      var selected = state.ui.patch17Pick.selected || {};
      var ids = Object.keys(selected).filter(function (id) {
        return selected[id];
      });
      if (!ids.length) {
        toast17('Выбери хотя бы одну пластинку');
        return;
      }
      var added = 0;
      ids.forEach(function (id) {
        var v = (state.collection || []).find(function (x) {
          return String(x.id) === String(id);
        });
        if (!v) return;
        if (
          !(state.vinyls || []).some(function (x) {
            return String(x.id) === String(v.id);
          })
        ) {
          state.vinyls.push(v);
          added++;
        }
      });
      state.modal = null;
      state.ui.setScope = 'session';
      state.ui.setOptions.setScope = 'session';
      state.view = 'set';
      toast17(added ? 'Добавлено в сессию: ' + added : 'Эти пластинки уже в сессии');
      window.laisoBuck.render();
    }
    function renderPatch17PickModal() {
      ensurePatch17State();
      var pick = state.ui.patch17Pick;
      var q = String(pick.query || '')
        .toLowerCase()
        .trim();
      var vinyls = usableCollectionVinyls17();
      var filtered = q
        ? vinyls.filter(function (v) {
            return [v.title, v.artist, v.label, v.catno, v.year, v.format].some(function (x) {
              return (
                String(x || '')
                  .toLowerCase()
                  .indexOf(q) >= 0
              );
            });
          })
        : vinyls;
      var selectedCount = Object.keys(pick.selected || {}).filter(function (id) {
        return pick.selected[id];
      }).length;
      var rows = filtered.length
        ? filtered
            .slice(0, 80)
            .map(function (v) {
              var checked = pick.selected && pick.selected[v.id] ? 'checked' : '';
              var cover = v.coverUrl ? '<img src="' + esc17(v.coverUrl) + '" alt="">' : '';
              var meta = [v.label, v.catno, v.year, v.format].filter(Boolean).join(' · ');
              var trackCount = (v.tracklist || []).length;
              return (
                '' +
                '<label class="runt17-pick-row">' +
                '<input type="checkbox" data-action="patch17-toggle-pick" data-vid="' +
                esc17(v.id) +
                '" ' +
                checked +
                '>' +
                '<span class="runt17-pick-cover">' +
                cover +
                '</span>' +
                '<span class="runt17-pick-info">' +
                '<strong>' +
                esc17(v.title || '—') +
                '</strong>' +
                '<em>' +
                esc17(v.artist || '—') +
                '</em>' +
                '<small>' +
                esc17(meta || '') +
                '</small>' +
                '</span>' +
                '<span class="runt17-pick-count">' +
                trackCount +
                ' тр.</span>' +
                '</label>'
              );
            })
            .join('')
        : '<div class="runt17-empty">В коллекции нет подходящих пластинок с треклистами</div>';
      return (
        '' +
        '<div class="laiso-modal-bg" data-action="patch17-close-pick-bg">' +
        '<div class="laiso-modal runt17-modal" data-stop>' +
        '<div class="runt17-modal-head">' +
        '<div>' +
        '<h2 class="laiso-modal-title">Собрать сет из коллекции</h2>' +
        '<p>Выбери пластинки для текущей сессии или собери сет сразу из всей коллекции.</p>' +
        '</div>' +
        '<button class="laiso-back" data-action="patch17-close-pick">Закрыть</button>' +
        '</div>' +
        '<div class="runt17-actions">' +
        '<button class="laiso-btn laiso-grow" data-action="patch17-use-all-collection">Собрать из всей коллекции</button>' +
        '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="patch17-go-add">Добавить новую пластинку</button>' +
        '</div>' +
        '<div class="laiso-mod-label">выбрать пластинки в сессию</div>' +
        '<input class="laiso-input" data-action="patch17-pick-search" value="' +
        esc17(pick.query || '') +
        '" placeholder="Поиск по коллекции…">' +
        '<div class="runt17-pick-toolbar">' +
        '<span>' +
        selectedCount +
        ' выбрано · ' +
        filtered.length +
        ' показано</span>' +
        '<button data-action="patch17-select-visible">Выбрать видимые</button>' +
        '<button data-action="patch17-clear-visible">Снять видимые</button>' +
        '</div>' +
        '<div class="runt17-pick-list">' +
        rows +
        '</div>' +
        '<div class="runt17-actions bottom">' +
        '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="patch17-close-pick">Отмена</button>' +
        '<button class="laiso-btn laiso-grow" data-action="patch17-add-selected">Добавить выбранные и собрать</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }
    function patchModalRender17() {
      var html = '';
      if (state.modal === 'patch17-pick-vinyls') html = renderPatch17PickModal();
      if (!html) return;
      setTimeout(function () {
        var root = document.getElementById('laiso-root');
        if (root && !document.querySelector('.runt17-modal')) {
          root.insertAdjacentHTML('beforeend', html);
        }
      }, 0);
    }
    function injectStyle17() {
      if (document.getElementById('runt17-style')) return;
      var css = document.createElement('style');
      css.id = 'runt17-style';
      css.textContent = ` #laiso-app .runt17-modal{max-width:760px!important;width:min(760px,96vw)!important;padding:22px!important;} #laiso-app .runt17-modal-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px;} #laiso-app .runt17-modal-head p{margin:6px 0 0;color:var(--text-secondary);font-size:14px;} #laiso-app .runt17-actions{display:flex;gap:10px;margin:14px 0;} #laiso-app .runt17-actions.bottom{position:sticky;bottom:0;background:#fff;padding-top:12px;border-top:1px solid var(--border);} #laiso-app .runt17-pick-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px 0;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-tertiary);} #laiso-app .runt17-pick-toolbar button{border:1px solid var(--border);background:#fff;border-radius:999px;padding:6px 10px;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;} #laiso-app .runt17-pick-list{display:grid;gap:8px;max-height:52vh;overflow:auto;padding-right:4px;} #laiso-app .runt17-pick-row{display:grid;grid-template-columns:24px 54px 1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:16px;padding:10px;cursor:pointer;} #laiso-app .runt17-pick-row input{width:18px;height:18px;accent-color:var(--accent-lime);} #laiso-app .runt17-pick-cover{width:54px;height:54px;background:#111;border-radius:12px;overflow:hidden;display:block;} #laiso-app .runt17-pick-cover img{width:100%;height:100%;object-fit:cover;display:block;} #laiso-app .runt17-pick-info{min-width:0;display:block;} #laiso-app .runt17-pick-info strong{display:block;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} #laiso-app .runt17-pick-info em{display:block;font-style:normal;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} #laiso-app .runt17-pick-info small{display:block;font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} #laiso-app .runt17-pick-count{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);white-space:nowrap;} #laiso-app .runt17-empty{padding:28px 16px;text-align:center;border:1px dashed var(--border);border-radius:16px;color:var(--text-secondary);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em;font-size:10px;} #laiso-app .runt17-set-scope-note{margin-top:8px;font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-tertiary);} @media(max-width:560px){ #laiso-app .runt17-actions{flex-direction:column;} #laiso-app .runt17-pick-row{grid-template-columns:24px 44px 1fr;} #laiso-app .runt17-pick-cover{width:44px;height:44px;} #laiso-app .runt17-pick-count{grid-column:3;} } `;
      document.head.appendChild(css);
    }
    injectStyle17();
    var originalRender17 = window.laisoBuck.render;
    window.laisoBuck.render = function () {
      originalRender17();
      patchModalRender17();
    };
    function currentFilteredIds17() {
      ensurePatch17State();
      var q = String(state.ui.patch17Pick.query || '')
        .toLowerCase()
        .trim();
      return usableCollectionVinyls17()
        .filter(function (v) {
          if (!q) return true;
          return [v.title, v.artist, v.label, v.catno, v.year, v.format].some(function (x) {
            return (
              String(x || '')
                .toLowerCase()
                .indexOf(q) >= 0
            );
          });
        })
        .map(function (v) {
          return v.id;
        });
    }
    function handlePatch17Action(e, t) {
      var a = t.dataset.action;
      if (a === 'go-set' || a === 'collection-build-set' || a === 'patch17-build-set') {
        var sessionCount = sessionTracks17().length;
        var colCount = collectionTracks17().length;
        if (a === 'collection-build-set') {
          if (colCount < 2) {
            toast17('В коллекции мало треков для сета');
            return true;
          }
          goSetWithScope17('collection');
          return true;
        }
        if (sessionCount >= 2) {
          goSetWithScope17('session');
          return true;
        }
        if (colCount >= 2) {
          openPickModal17();
          return true;
        }
        state.view = 'add';
        toast17('Сначала добавь пластинку в коллекцию');
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-use-all-collection') {
        if (collectionTracks17().length < 2) {
          toast17('В коллекции мало треков для сета');
          return true;
        }
        state.modal = null;
        goSetWithScope17('collection');
        return true;
      }
      if (a === 'patch17-go-add') {
        state.modal = null;
        state.view = 'add';
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-close-pick' || a === 'patch17-close-pick-bg') {
        if (
          a === 'patch17-close-pick-bg' &&
          !(e.target.classList && e.target.classList.contains('laiso-modal-bg'))
        )
          return true;
        state.modal = null;
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-pick-search') {
        ensurePatch17State();
        state.ui.patch17Pick.query = t.value || '';
        window.laisoBuck.render();
        var input = document.querySelector('[data-action="patch17-pick-search"]');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
        return true;
      }
      if (a === 'patch17-toggle-pick') {
        ensurePatch17State();
        var id = t.dataset.vid;
        state.ui.patch17Pick.selected[id] = !!t.checked;
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-select-visible') {
        ensurePatch17State();
        currentFilteredIds17().forEach(function (id) {
          state.ui.patch17Pick.selected[id] = true;
        });
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-clear-visible') {
        ensurePatch17State();
        currentFilteredIds17().forEach(function (id) {
          delete state.ui.patch17Pick.selected[id];
        });
        window.laisoBuck.render();
        return true;
      }
      if (a === 'patch17-add-selected') {
        addSelectedToSession17();
        return true;
      }
      return false;
    }
    /* Capture phase: перехватываем старые handlers до того, как они покажут тупиковый toast. */ document.addEventListener(
      'click',
      function (e) {
        if (!e.target.closest || !e.target.closest('#laiso-app')) return;
        var n = e.target;
        while (n && n !== document.body) {
          if (n.dataset && n.dataset.action) break;
          n = n.parentNode;
        }
        if (!n || !n.dataset || !n.dataset.action) return;
        if (handlePatch17Action(e, n)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
      },
      true
    );
    document.addEventListener(
      'input',
      function (e) {
        if (!e.target.closest || !e.target.closest('#laiso-app')) return;
        if (e.target.dataset && e.target.dataset.action === 'patch17-pick-search') {
          ensurePatch17State();
          state.ui.patch17Pick.query = e.target.value || '';
        }
      },
      true
    );
    console.log('RUNT-01 PATCH-17 loaded: collection set entry + pick vinyls');
  })();
}

function installRuntCollectionBpmPanel() {
  (function () {
    'use strict';
    if (!window.laisoBuck || !window.laisoBuck.state) {
      console.warn('RUNT-01 PATCH-18C: laisoBuck state not found');
      return;
    }
    var state = window.laisoBuck.state;
    function safeRender18c() {
      try {
        if (typeof window.laisoBuck.render === 'function') window.laisoBuck.render();
        else if (typeof window.render === 'function') window.render();
      } catch (e) {
        console.warn('PATCH-18C render error', e);
      }
    }
    function esc18c(s) {
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function toast18c(msg) {
      if (typeof showToast === 'function') showToast(msg);
      else {
        alert(msg);
      }
    }
    function getCollection18c() {
      return (state.collection || []).filter(function (v) {
        return v && !v.excludeFromSets && v.tracklist && v.tracklist.length;
      });
    }
    function numBpm18c(v) {
      var n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    }
    function getBpmRange18c(tracks) {
      tracks = tracks || [];
      var bpms = [];
      var missing = 0;
      tracks.forEach(function (t) {
        var n = numBpm18c(t && t.bpm);
        if (n === null) missing++;
        else bpms.push(n);
      });
      if (!bpms.length) {
        return {
          hasData: false,
          min: null,
          max: null,
          count: 0,
          total: tracks.length,
          missing: missing,
        };
      }
      return {
        hasData: true,
        min: Math.min.apply(null, bpms),
        max: Math.max.apply(null, bpms),
        count: bpms.length,
        total: tracks.length,
        missing: missing,
      };
    }
    function bpmLine18c(label, tracks) {
      var r = getBpmRange18c(tracks);
      if (!r.total) {
        return (
          '<div class="runt18c-bpm-line"><span>' +
          label +
          '</span><strong>нет треков</strong></div>'
        );
      }
      if (!r.hasData) {
        return (
          '<div class="runt18c-bpm-line"><span>' +
          label +
          '</span><strong>BPM: недостаточно данных</strong><em>' +
          r.total +
          ' трек. · без BPM: ' +
          r.missing +
          '</em></div>'
        );
      }
      return (
        '<div class="runt18c-bpm-line"><span>' +
        label +
        '</span><strong>BPM: ' +
        r.min +
        '–' +
        r.max +
        '</strong><em>' +
        r.total +
        ' трек. · с BPM: ' +
        r.count +
        (r.missing ? ' · без BPM: ' + r.missing : '') +
        '</em></div>'
      );
    }
    function getPoolTracks18c() {
      if (typeof getSetSourceTracks === 'function') {
        try {
          return getSetSourceTracks({ includeAll: true }) || [];
        } catch (_) {}
      }
      if (typeof getAllSessionTracks === 'function') {
        try {
          return getAllSessionTracks({ includeAll: true }) || [];
        } catch (e) {
          try {
            return getAllSessionTracks() || [];
          } catch (_) {}
        }
      }
      return [];
    }
    function injectBpmPanel18c() {
      if (state.view !== 'set') return;
      var root = document.getElementById('laiso-root');
      if (!root) return;
      var old = root.querySelector('.runt18c-bpm-panel');
      if (old) old.remove();
      var pool = getPoolTracks18c();
      var set = state.ui && state.ui.generatedSet ? state.ui.generatedSet : [];
      var html =
        '<div class="runt18c-bpm-panel">' +
        bpmLine18c('пул', pool) +
        (set.length ? bpmLine18c('сет', set) : '') +
        '</div>';
      var after =
        root.querySelector('.laiso-set-source') ||
        root.querySelector('.laiso-tabs-modes') ||
        root.querySelector('.laiso-tabs') ||
        root.querySelector('.laiso-header');
      if (after) after.insertAdjacentHTML('afterend', html);
    }
    /* Не трогаем render. Просто наблюдаем за обновлениями DOM. */ var rootObsTarget =
      document.getElementById('laiso-root');
    if (rootObsTarget && window.MutationObserver) {
      var obs = new MutationObserver(function () {
        clearTimeout(window.__runt18cBpmTimer);
        window.__runt18cBpmTimer = setTimeout(injectBpmPanel18c, 30);
      });
      obs.observe(rootObsTarget, { childList: true, subtree: false });
    }
    setInterval(function () {
      if (state.view === 'set') injectBpmPanel18c();
    }, 1200);
    function setSessionFromCollection18c(vinyls) {
      var picked = (vinyls || []).slice();
      var seen = {};
      picked = picked.filter(function (v) {
        if (!v || !v.id || seen[v.id]) return false;
        seen[v.id] = true;
        return true;
      });
      state.vinyls = picked;
      state.ui = state.ui || {};
      state.ui.setSource = 'collection';
      state.ui.generatedSet = [];
      state.ui.setGeneratedCache = state.ui.setGeneratedCache || {};
      state.ui.setLastWarning = null;
      state.ui.setOpenDataPanel = false;
      state.view = 'set';
      safeRender18c();
      setTimeout(injectBpmPanel18c, 80);
    }
    function openCollectionSetModal18c() {
      var col = getCollection18c();
      if (!col.length) {
        toast18c('В коллекции нет пластинок с треклистами');
        return;
      }
      state.ui = state.ui || {};
      state.ui.runt18cCollectionSetModal = true;
      state.ui.runt18cCollectionSetQuery = '';
      state.ui.runt18cCollectionSetSelected = {};
      renderModal18c();
    }
    function closeModal18c() {
      state.ui.runt18cCollectionSetModal = false;
      var old = document.querySelector('#laiso-app .runt18c-set-bg');
      if (old) old.remove();
    }
    function renderModal18c() {
      var app = document.getElementById('laiso-app');
      if (!app) return;
      var old = app.querySelector('.runt18c-set-bg');
      if (old) old.remove();
      if (!state.ui || !state.ui.runt18cCollectionSetModal) return;
      var col = getCollection18c();
      var q = (state.ui.runt18cCollectionSetQuery || '').toLowerCase().trim();
      var selected = state.ui.runt18cCollectionSetSelected || {};
      var filtered = q
        ? col.filter(function (v) {
            return [v.artist, v.title, v.label, v.catno, v.year, v.format].some(function (x) {
              return (
                String(x || '')
                  .toLowerCase()
                  .indexOf(q) >= 0
              );
            });
          })
        : col;
      var selectedIds = Object.keys(selected).filter(function (id) {
        return selected[id];
      });
      var selectedCount = selectedIds.length;
      function card(v) {
        var on = !!selected[v.id];
        var cover = v.coverUrl
          ? '<img src="' + esc18c(v.coverUrl) + '" alt="">'
          : v.userPhoto
            ? '<img src="' + esc18c(v.userPhoto) + '" alt="">'
            : '';
        return (
          '<button type="button" class="runt18c-pick-card ' +
          (on ? 'is-selected' : '') +
          '" data-runt18c-action="toggle" data-id="' +
          esc18c(v.id) +
          '">' +
          '<span class="runt18c-pick-cover">' +
          cover +
          '</span>' +
          '<span class="runt18c-pick-info">' +
          '<strong>' +
          esc18c(v.title || '—') +
          '</strong>' +
          '<em>' +
          esc18c(v.artist || '—') +
          '</em>' +
          '<small>' +
          esc18c(v.label || '') +
          (v.catno ? ' · ' + esc18c(v.catno) : '') +
          '</small>' +
          '</span>' +
          '<span class="runt18c-pick-check">' +
          (on ? '✓' : '+') +
          '</span>' +
          '</button>'
        );
      }
      var html =
        '' +
        '<div class="laiso-modal-bg runt18c-set-bg">' +
        '<div class="laiso-modal runt18c-set-modal" data-stop>' +
        '<div class="laiso-row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<h2 class="laiso-modal-title">Собрать сет</h2>' +
        '<button class="laiso-back" type="button" data-runt18c-action="close">Закрыть</button>' +
        '</div>' +
        '<div class="laiso-panel" style="margin-bottom:12px;">' +
        '<div class="laiso-h2">Источник треков</div>' +
        '<p style="margin:6px 0 12px;color:var(--text-secondary);">Можно собрать сет из всей коллекции или выбрать конкретные пластинки.</p>' +
        '<div class="laiso-row">' +
        '<button class="laiso-btn laiso-grow" type="button" data-runt18c-action="all">Вся коллекция</button>' +
        '<button class="laiso-btn laiso-btn-secondary laiso-grow" type="button" data-runt18c-action="manual">Выбрать вручную</button>' +
        '</div>' +
        '</div>' +
        '<div class="laiso-panel">' +
        '<label class="laiso-label">Выбрать пластинки</label>' +
        '<input class="laiso-input" type="search" data-runt18c-action="search" placeholder="Поиск по коллекции…" value="' +
        esc18c(state.ui.runt18cCollectionSetQuery || '') +
        '">' +
        '<div class="laiso-row" style="margin:10px 0;">' +
        '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary" type="button" data-runt18c-action="select-visible">Выбрать видимые</button>' +
        '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary" type="button" data-runt18c-action="clear">Сбросить</button>' +
        '<span class="laiso-meta" style="align-self:center;margin-left:auto;">Выбрано: ' +
        selectedCount +
        '</span>' +
        '</div>' +
        '<div class="runt18c-pick-list">' +
        (filtered.length
          ? filtered.slice(0, 60).map(card).join('')
          : '<div class="laiso-empty">Ничего не найдено</div>') +
        '</div>' +
        '<button class="laiso-btn laiso-btn-block" type="button" style="margin-top:12px;" data-runt18c-action="start-selected"' +
        (selectedCount < 1 ? ' disabled' : '') +
        '>Собрать из выбранных</button>' +
        '</div>' +
        '<button class="laiso-btn laiso-btn-secondary laiso-btn-block" type="button" style="margin-top:12px;" data-runt18c-action="add-new">+ Добавить новую пластинку</button>' +
        '</div>' +
        '</div>';
      app.insertAdjacentHTML('beforeend', html);
    }
    /* Только наши data-runt18c-action. Не цепляем глобальные data-action. */ document.addEventListener(
      'click',
      function (e) {
        var el = e.target.closest && e.target.closest('[data-runt18c-action]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        var action = el.getAttribute('data-runt18c-action');
        if (action === 'close') {
          closeModal18c();
          return;
        }
        if (action === 'all') {
          closeModal18c();
          setSessionFromCollection18c(getCollection18c());
          return;
        }
        if (action === 'manual') {
          renderModal18c();
          return;
        }
        if (action === 'toggle') {
          var id = el.dataset.id;
          state.ui.runt18cCollectionSetSelected = state.ui.runt18cCollectionSetSelected || {};
          state.ui.runt18cCollectionSetSelected[id] = !state.ui.runt18cCollectionSetSelected[id];
          renderModal18c();
          return;
        }
        if (action === 'select-visible') {
          var q = (state.ui.runt18cCollectionSetQuery || '').toLowerCase().trim();
          var col = getCollection18c();
          var filtered = q
            ? col.filter(function (v) {
                return [v.artist, v.title, v.label, v.catno, v.year, v.format].some(function (x) {
                  return (
                    String(x || '')
                      .toLowerCase()
                      .indexOf(q) >= 0
                  );
                });
              })
            : col;
          state.ui.runt18cCollectionSetSelected = state.ui.runt18cCollectionSetSelected || {};
          filtered.slice(0, 60).forEach(function (v) {
            state.ui.runt18cCollectionSetSelected[v.id] = true;
          });
          renderModal18c();
          return;
        }
        if (action === 'clear') {
          state.ui.runt18cCollectionSetSelected = {};
          renderModal18c();
          return;
        }
        if (action === 'start-selected') {
          var selected = state.ui.runt18cCollectionSetSelected || {};
          var picked = getCollection18c().filter(function (v) {
            return selected[v.id];
          });
          if (!picked.length) {
            toast18c('Выбери хотя бы одну пластинку');
            return;
          }
          closeModal18c();
          setSessionFromCollection18c(picked);
          return;
        }
        if (action === 'add-new') {
          closeModal18c();
          state.view = 'add';
          safeRender18c();
          return;
        }
      }
    );
    document.addEventListener('input', function (e) {
      var el = e.target.closest && e.target.closest('[data-runt18c-action="search"]');
      if (!el) return;
      state.ui.runt18cCollectionSetQuery = el.value || '';
      clearTimeout(window.__runt18cSearchTimer);
      window.__runt18cSearchTimer = setTimeout(function () {
        renderModal18c();
        var input = document.querySelector('#laiso-app [data-runt18c-action="search"]');
        if (input) {
          input.focus();
          try {
            input.setSelectionRange(input.value.length, input.value.length);
          } catch (_) {}
        }
      }, 100);
    });
    /* Без stopImmediatePropagation. Просто добавляем отдельную кнопку, если старая не работает. */ function injectCollectionSafeButton18c() {
      return;
      /* disabled: collection already has + собрать сет entry */ if (state.view !== 'collection')
        return;
      var root = document.getElementById('laiso-root');
      if (!root) return;
      if (root.querySelector('.runt18c-safe-build')) return;
      var target = root.querySelector('.laiso-tabs') || root.querySelector('.laiso-header');
      if (!target) return;
      target.insertAdjacentHTML(
        'afterend',
        '<div class="laiso-panel runt18c-safe-build" style="margin:10px 0 14px;">' +
          '<div class="laiso-h2" style="margin-bottom:8px;">Собрать сет из коллекции</div>' +
          '<button type="button" class="laiso-btn laiso-btn-block" data-runt18c-action="open-modal">Выбрать пластинки / вся коллекция</button>' +
          '</div>'
      );
    }
    document.addEventListener('click', function (e) {
      var openBtn = e.target.closest && e.target.closest('[data-runt18c-action="open-modal"]');
      if (!openBtn) return;
      e.preventDefault();
      e.stopPropagation();
      openCollectionSetModal18c();
    });
    setInterval(function () {
      injectCollectionSafeButton18c();
      renderModal18c();
    }, 1000);
    setTimeout(function () {
      injectCollectionSafeButton18c();
      injectBpmPanel18c();
    }, 300);
    console.log('RUNT-01 PATCH-18C loaded safely');
  })();
}

function installRuntLiveMode() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      var originalRender = window.laisoBuck.render;
      var wakeLock = null;
      if (!state.ui) state.ui = {};
      if (!state.ui.livePlayed) state.ui.livePlayed = {};
      if (!state.ui.liveWakeLock) state.ui.liveWakeLock = false;
      function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function getGeneratedSet() {
        return state.ui && Array.isArray(state.ui.generatedSet) ? state.ui.generatedSet : [];
      }
      function getTrackId(t, i) {
        return String((t && (t.id || t.trackId)) || 'idx-' + i);
      }
      function playedCount() {
        var set = getGeneratedSet();
        var n = 0;
        set.forEach(function (t, i) {
          if (state.ui.livePlayed[getTrackId(t, i)]) n++;
        });
        return n;
      }
      async function enableWakeLock() {
        try {
          if (!('wakeLock' in navigator)) {
            showToastSafe('Wake Lock не поддерживается этим браузером');
            state.ui.liveWakeLock = false;
            return false;
          }
          wakeLock = await navigator.wakeLock.request('screen');
          state.ui.liveWakeLock = true;
          wakeLock.addEventListener('release', function () {
            state.ui.liveWakeLock = false;
            try {
              window.laisoBuck.render();
            } catch (_) {}
          });
          showToastSafe('Live mode включён');
          return true;
        } catch (e) {
          console.warn('RUNT-01 PATCH-19 wakeLock error:', e);
          state.ui.liveWakeLock = false;
          showToastSafe('Не удалось включить Live mode');
          return false;
        }
      }
      async function disableWakeLock() {
        try {
          if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
          }
        } catch (_) {}
        state.ui.liveWakeLock = false;
        showToastSafe('Live mode выключен');
      }
      function showToastSafe(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      document.addEventListener('visibilitychange', function () {
        if (
          document.visibilityState === 'visible' &&
          state.ui.liveWakeLock &&
          state.view === 'live-set'
        ) {
          enableWakeLock();
        }
      });
      function renderHeader(title) {
        if (typeof window.renderHeader === 'function') {
          return window.renderHeader(title);
        }
        if (typeof renderHeader === 'function') {
          return renderHeader(title);
        }
        return (
          '<div class="laiso-header"><button class="laiso-back" data-action="back">← Назад</button><h1 class="laiso-h1">' +
          esc(title) +
          '</h1><div></div></div>'
        );
      }
      function renderAttributionSafe() {
        if (typeof renderAttribution === 'function') return renderAttribution();
        return '';
      }
      function renderLiveSet() {
        var set = getGeneratedSet();
        var done = playedCount();
        var total = set.length;
        var nextIndex = 0;
        for (var n = 0; n < set.length; n++) {
          if (!state.ui.livePlayed[getTrackId(set[n], n)]) {
            nextIndex = n;
            break;
          }
        }
        var html = '';
        html += renderHeader('Играть сет');
        html += '<div class="runt19-live-top">';
        html += '<div class="runt19-live-status">';
        html += '<small>live set</small>';
        html += '<strong>' + done + ' / ' + total + '</strong>';
        html += '</div>';
        html += '<div class="runt19-live-controls">';
        html +=
          '<button class="laiso-btn ' +
          (state.ui.liveWakeLock ? 'runt19-wakelock-on' : 'laiso-btn-secondary') +
          '" data-action="runt19-toggle-wakelock">' +
          (state.ui.liveWakeLock ? 'Live mode включён' : 'Live mode · экран не гаснет') +
          '</button>';
        html +=
          '<button class="laiso-btn laiso-btn-secondary" data-action="runt19-reset-played">Сбросить отметки</button>';
        html +=
          '<button class="laiso-btn laiso-btn-secondary vertax-live-save" data-action="set-save">Сохранить сет</button>';
        html += '</div>';
        html +=
          '<div class="runt19-live-hint">Тап по карточке отмечает трек как сыгранный. Live mode просит телефон не гасить экран во время сета.</div>';
        html += '</div>';
        if (!set.length) {
          html +=
            '<div class="runt19-empty">Сет пока не собран. Вернись в сборку и нажми «Сгенерировать».</div>';
        } else {
          html += '<div class="runt19-live-list">';
          set.forEach(function (t, i) {
            var id = getTrackId(t, i);
            var isPlayed = !!state.ui.livePlayed[id];
            var isNow = !isPlayed && i === nextIndex;
            var bpm = t.bpm || '—';
            var cam = t.camelot || '—';
            var pos = t.displayPosition || t.position || '—';
            var title = t.title || '—';
            var artist = t.vinylArtist || '';
            var release = t.vinylTitle || '';
            var catno = t.vinylCatno ? ' · ' + t.vinylCatno : '';
            var key = t.key ? 'KEY: ' + t.key : 'KEY: —';
            html +=
              '<div class="runt19-live-card ' +
              (isPlayed ? 'is-played ' : '') +
              (isNow ? 'runt19-now-card' : '') +
              '" data-action="runt19-toggle-played" data-track-id="' +
              esc(id) +
              '">';
            html += '<div class="runt19-live-num">#' + (i + 1) + '</div>';
            html += '<div class="runt19-live-left">';
            html += '<div class="runt19-live-bpm">' + esc(bpm) + '</div>';
            html += '<div class="runt19-live-cam">' + esc(cam) + '</div>';
            html += '</div>';
            html += '<div class="runt19-live-main">';
            html += '<h2 class="runt19-live-title">' + esc(title) + '</h2>';
            html +=
              '<div class="runt19-live-release">' +
              esc(artist) +
              (artist && release ? ' — ' : '') +
              esc(release) +
              esc(catno) +
              '</div>';
            html += '<div class="runt19-live-pills">';
            html += '<span class="runt19-live-pill">на пластинке ' + esc(pos) + '</span>';
            html += '<span class="runt19-live-pill soft">' + esc(key) + '</span>';
            html += '<span class="runt19-live-pill soft">' + esc(bpm) + ' BPM</span>';
            html += '</div>';
            html += '</div>';
            html += '<div class="runt19-live-done">сыграно</div>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '<div class="laiso-row" style="margin-top:16px;">';
        html +=
          '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="runt19-back-to-set">Назад к сборке</button>';
        html +=
          '<button class="laiso-btn laiso-grow" data-action="set-export">Экспорт TXT</button>';
        html += '</div>';
        html += renderAttributionSafe();
        return html;
      }
      function injectPlayButton() {
        if (state.view !== 'set') return;
        var root = document.getElementById('laiso-root');
        if (!root) return;
        /* remove bad BPM panels again, including old inserted nodes */ root
          .querySelectorAll('.runt18c-bpm-panel,.runt18d-bpm-panel,.runt18d-bpm-line')
          .forEach(function (el) {
            el.remove();
          });
        if (!getGeneratedSet().length) return;
        if (root.querySelector('.runt19-play-btn-wrap')) return;
        var target = root.querySelector('[data-action="set-save"]');
        var row = target ? target.closest('.laiso-row') : null;
        var btn =
          '<div class="runt19-play-btn-wrap">' +
          '<button class="laiso-btn runt19-play-btn" data-action="runt19-play-set">Играть сет</button>' +
          '</div>';
        if (row) row.insertAdjacentHTML('beforebegin', btn);
        else root.insertAdjacentHTML('beforeend', btn);
      }
      /* Wrap render only once */ if (!window.__runt19RenderWrapped) {
        var baseRender = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          if (state.view === 'live-set') {
            var root = document.getElementById('laiso-root');
            if (root) root.innerHTML = renderLiveSet();
            return;
          }
          baseRender();
          setTimeout(injectPlayButton, 30);
        };
        window.__runt19RenderWrapped = true;
      }
      /* Also patch global render variable if it exists in same scope */ try {
        if (typeof render === 'function' && !window.__runt19GlobalRenderWrapped) {
          var oldRender = render;
          render = function () {
            if (state.view === 'live-set') {
              var root = document.getElementById('laiso-root');
              if (root) root.innerHTML = renderLiveSet();
              return;
            }
            oldRender();
            setTimeout(injectPlayButton, 30);
          };
          window.__runt19GlobalRenderWrapped = true;
        }
      } catch (_) {}
      document.addEventListener(
        'click',
        function (e) {
          var root = document.getElementById('laiso-app');
          if (!root || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var el = e.target.closest('[data-action]');
          if (!el) return;
          var action = el.dataset.action;
          if (action === 'runt19-play-set') {
            e.preventDefault();
            if (!getGeneratedSet().length) {
              showToastSafe('Сначала сгенерируй сет');
              return;
            }
            state.view = 'live-set';
            window.laisoBuck.render();
          }
          if (action === 'runt19-back-to-set') {
            e.preventDefault();
            state.view = 'set';
            window.laisoBuck.render();
          }
          if (action === 'runt19-toggle-played') {
            e.preventDefault();
            var id = el.dataset.trackId;
            if (!id) return;
            state.ui.livePlayed[id] = !state.ui.livePlayed[id];
            window.laisoBuck.render();
          }
          if (action === 'runt19-reset-played') {
            e.preventDefault();
            state.ui.livePlayed = {};
            window.laisoBuck.render();
          }
          if (action === 'runt19-toggle-wakelock') {
            e.preventDefault();
            if (state.ui.liveWakeLock)
              disableWakeLock().then(function () {
                window.laisoBuck.render();
              });
            else
              enableWakeLock().then(function () {
                window.laisoBuck.render();
              });
          }
        },
        true
      );
      /* If user leaves live screen, try releasing wake lock gently */ var lastView = state.view;
      setInterval(function () {
        if (lastView === 'live-set' && state.view !== 'live-set' && wakeLock) {
          disableWakeLock();
        }
        lastView = state.view;
        injectPlayButton();
      }, 700);
      setTimeout(function () {
        injectPlayButton();
        console.log(
          'RUNT-01 PATCH-19 loaded: Play Set / Live Mode + hidden broken BPM pool panels'
        );
      }, 300);
    }
    boot();
  })();
}

function installRuntLiveSuggestions() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      if (!state.ui) state.ui = {};
      if (!state.ui.livePlayed) state.ui.livePlayed = {};
      function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function getSet() {
        return state.ui && Array.isArray(state.ui.generatedSet) ? state.ui.generatedSet : [];
      }
      function getTrackId(t, i) {
        return String((t && (t.id || t.trackId)) || 'idx-' + i);
      }
      function getLastUnplayedOrLastTrack() {
        var set = getSet();
        if (!set.length) return null;
        /* First try last played track */ var lastPlayed = null;
        set.forEach(function (t, i) {
          if (state.ui.livePlayed[getTrackId(t, i)]) lastPlayed = t;
        });
        if (lastPlayed) return lastPlayed;
        /* Else first track in current set */ return set[0] || null;
      }
      function normalizeTitle(s) {
        return String(s || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\([^)]*\)/g, '')
          .replace(/\[[^\]]*\]/g, '')
          .trim();
      }
      function camelotNeighborsLocal(c) {
        if (typeof camelotNeighbors === 'function') return camelotNeighbors(c);
        if (!c) return [];
        var num = parseInt(c, 10);
        var letter = String(c).slice(-1);
        if (!num || !letter) return [c];
        var nxt = num === 12 ? 1 : num + 1;
        var prv = num === 1 ? 12 : num - 1;
        return [c, nxt + letter, prv + letter, num + (letter === 'A' ? 'B' : 'A')];
      }
      function getAllTracksFromCollection() {
        var out = [];
        var vinyls = state.collection || [];
        vinyls.forEach(function (v) {
          if (!v || !Array.isArray(v.tracklist)) return;
          v.tracklist.forEach(function (t) {
            if (!t || t.excludeFromSets || v.excludeFromSets) return;
            if (!t.bpm) return;
            var pos = '';
            try {
              pos =
                typeof displayPosition === 'function' ? displayPosition(t, v) : t.position || '';
            } catch (_) {
              pos = t.position || '';
            }
            out.push({
              id: t.id,
              recordId: v.id,
              position: t.position,
              displayPosition: pos,
              title: t.title,
              bpm: t.bpm,
              key: t.key,
              camelot: t.camelot,
              originalBpm: t.originalBpm || null,
              bpmSource: t.bpmSource || null,
              vinylTitle: v.title,
              vinylArtist: v.artist,
              vinylCatno: v.catno || '',
              vinylLabel: v.label || '',
            });
          });
        });
        return out;
      }
      function buildSuggestions() {
        var currentSet = getSet();
        var base = getLastUnplayedOrLastTrack();
        var usedIds = {};
        var usedNames = {};
        currentSet.forEach(function (t, i) {
          usedIds[String(t.id)] = true;
          usedNames[normalizeTitle(t.title) + '|' + normalizeTitle(t.vinylArtist)] = true;
        });
        var all = getAllTracksFromCollection();
        var baseBpm = base && base.bpm ? Number(base.bpm) : null;
        var baseCam = base && base.camelot ? base.camelot : null;
        var baseRecord = base && base.recordId ? base.recordId : null;
        var neighbors = camelotNeighborsLocal(baseCam);
        var candidates = all
          .filter(function (t) {
            if (usedIds[String(t.id)]) return false;
            if (usedNames[normalizeTitle(t.title) + '|' + normalizeTitle(t.vinylArtist)])
              return false;
            if (baseRecord && t.recordId === baseRecord) return false;
            if (baseBpm && Math.abs(Number(t.bpm) - baseBpm) > 8) return false;
            return true;
          })
          .map(function (t) {
            var score = 0;
            if (baseBpm && t.bpm) score += Math.max(0, 12 - Math.abs(Number(t.bpm) - baseBpm));
            if (baseCam && t.camelot) {
              if (t.camelot === baseCam) score += 10;
              else if (neighbors.indexOf(t.camelot) >= 0) score += 6;
            }
            return Object.assign({}, t, {
              _score: score,
              _bpmDiff: baseBpm && t.bpm ? Number(t.bpm) - baseBpm : null,
              _camOk: baseCam && t.camelot ? neighbors.indexOf(t.camelot) >= 0 : false,
            });
          });
        candidates.sort(function (a, b) {
          if (b._score !== a._score) return b._score - a._score;
          if (baseBpm) return Math.abs(a.bpm - baseBpm) - Math.abs(b.bpm - baseBpm);
          return String(a.title || '').localeCompare(String(b.title || ''));
        });
        return candidates.slice(0, 20);
      }
      function openSuggestModal() {
        state.modal = 'runt21-live-add';
        window.laisoBuck.render();
      }
      function renderSuggestModal() {
        var base = getLastUnplayedOrLastTrack();
        var candidates = buildSuggestions();
        var baseText = base
          ? 'Ориентир: ' +
            (base.title || 'текущий трек') +
            (base.bpm ? ' · ' + base.bpm + ' BPM' : '') +
            (base.camelot ? ' · ' + base.camelot : '')
          : 'Сначала собери или открой сет.';
        var rows = candidates.length
          ? candidates
              .map(function (t) {
                var diff =
                  t._bpmDiff == null ? '' : (t._bpmDiff > 0 ? '+' : '') + t._bpmDiff + ' BPM';
                var scoreText = [];
                if (diff) scoreText.push(diff);
                if (t._camOk) scoreText.push('Camelot рядом');
                if (!scoreText.length) scoreText.push('подходит по темпу');
                return (
                  '<div class="runt21-suggest-row">' +
                  '<div class="runt21-suggest-meters">' +
                  '<div class="runt21-suggest-bpm">' +
                  esc(t.bpm || '—') +
                  '</div>' +
                  '<div class="runt21-suggest-cam">' +
                  esc(t.camelot || '—') +
                  '</div>' +
                  '</div>' +
                  '<div>' +
                  '<div class="runt21-suggest-name">' +
                  esc(t.title || '—') +
                  '</div>' +
                  '<div class="runt21-suggest-meta">' +
                  esc(t.vinylArtist || '') +
                  (t.vinylArtist && t.vinylTitle ? ' — ' : '') +
                  esc(t.vinylTitle || '') +
                  (t.vinylCatno ? ' · ' + esc(t.vinylCatno) : '') +
                  '</div>' +
                  '<span class="runt21-suggest-score">' +
                  esc(scoreText.join(' · ')) +
                  '</span>' +
                  '</div>' +
                  '<button class="laiso-btn laiso-btn-sm" data-action="runt21-add-suggested-track" data-track-id="' +
                  esc(t.id) +
                  '">Добавить</button>' +
                  '</div>'
                );
              })
              .join('')
          : '<div class="runt21-suggest-empty">Подходящих треков не нашлось. Можно ослабить правила в сборке или добавить трек вручную через коллекцию.</div>';
        return (
          '<div class="laiso-modal-bg" data-action="runt21-close-modal-bg">' +
          '<div class="laiso-modal" data-stop>' +
          '<div class="runt21-suggest-head">' +
          '<div>' +
          '<div class="runt21-suggest-title">Добавить треки</div>' +
          '<div class="runt21-suggest-note">' +
          esc(baseText) +
          '</div>' +
          '</div>' +
          '<button class="laiso-back" data-action="runt21-close-modal">Закрыть</button>' +
          '</div>' +
          '<div class="runt21-modal-scroll">' +
          rows +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }
      function addSuggestedTrack(trackId) {
        var all = getAllTracksFromCollection();
        var t = all.find(function (x) {
          return String(x.id) === String(trackId);
        });
        if (!t) {
          toast('Трек не найден');
          return;
        }
        var set = getSet();
        var duplicate = set.some(function (x) {
          return (
            String(x.id) === String(t.id) ||
            (normalizeTitle(x.title) === normalizeTitle(t.title) &&
              normalizeTitle(x.vinylArtist) === normalizeTitle(t.vinylArtist))
          );
        });
        if (duplicate) {
          toast('Этот трек уже есть в сете');
          return;
        }
        set.push(t);
        state.ui.generatedSet = set;
        state.modal = null;
        toast('Трек добавлен в live set');
        window.laisoBuck.render();
      }
      /* Wrap render to render our custom modal and to inject add button into live mode. */ function wrapRender() {
        if (window.__runt21RenderWrapped) return;
        var oldRender = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          oldRender();
          setTimeout(function () {
            var root = document.getElementById('laiso-root');
            if (!root) return;
            /* If our modal is active, append it over the current view. */ if (
              state.modal === 'runt21-live-add' &&
              !root.querySelector('.runt21-suggest-title')
            ) {
              root.insertAdjacentHTML('beforeend', renderSuggestModal());
            }
            /* Inject "+ Добавить треки" into live screen controls. */ if (
              state.view === 'live-set' &&
              !root.querySelector('[data-action="runt21-open-live-add"]')
            ) {
              var controls = root.querySelector('.runt19-live-controls');
              if (controls) {
                controls.insertAdjacentHTML(
                  'beforeend',
                  '<button class="laiso-btn laiso-btn-secondary" data-action="runt21-open-live-add">+ Добавить треки</button>'
                );
              }
            }
          }, 30);
        };
        window.__runt21RenderWrapped = true;
      }
      /* Also patch global render if possible. */ try {
        if (typeof render === 'function' && !window.__runt21GlobalRenderWrapped) {
          var oldGlobalRender = render;
          render = function () {
            oldGlobalRender();
            setTimeout(function () {
              var root = document.getElementById('laiso-root');
              if (!root) return;
              if (
                state.modal === 'runt21-live-add' &&
                !root.querySelector('.runt21-suggest-title')
              ) {
                root.insertAdjacentHTML('beforeend', renderSuggestModal());
              }
              if (
                state.view === 'live-set' &&
                !root.querySelector('[data-action="runt21-open-live-add"]')
              ) {
                var controls = root.querySelector('.runt19-live-controls');
                if (controls) {
                  controls.insertAdjacentHTML(
                    'beforeend',
                    '<button class="laiso-btn laiso-btn-secondary" data-action="runt21-open-live-add">+ Добавить треки</button>'
                  );
                }
              }
            }, 30);
          };
          window.__runt21GlobalRenderWrapped = true;
        }
      } catch (_) {}
      document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var el = e.target.closest('[data-action]');
          if (!el) return;
          var action = el.dataset.action;
          if (action === 'runt21-open-live-add') {
            e.preventDefault();
            e.stopPropagation();
            openSuggestModal();
          }
          if (action === 'runt21-close-modal') {
            e.preventDefault();
            e.stopPropagation();
            state.modal = null;
            window.laisoBuck.render();
          }
          if (action === 'runt21-close-modal-bg') {
            if (e.target.classList && e.target.classList.contains('laiso-modal-bg')) {
              e.preventDefault();
              e.stopPropagation();
              state.modal = null;
              window.laisoBuck.render();
            }
          }
          if (action === 'runt21-add-suggested-track') {
            e.preventDefault();
            e.stopPropagation();
            addSuggestedTrack(el.dataset.trackId);
          }
        },
        true
      );
      wrapRender();
      setTimeout(function () {
        window.laisoBuck.render();
        console.log(
          'RUNT-01 PATCH-21 loaded: scrollable modals + stronger played + live add tracks'
        );
      }, 300);
    }
    boot();
  })();
}

function installRuntDiagnosticsPanel() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function renderApp() {
        try {
          if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
            window.laisoBuck.render();
          else if (typeof window.render === 'function') window.render();
        } catch (e) {
          console.warn('PATCH-25 render error', e);
        }
      }
      function getHeader(title) {
        try {
          if (typeof renderHeader === 'function') return renderHeader(title);
        } catch (_) {}
        return (
          '<div class="laiso-header"><button class="laiso-back" data-action="back">← Назад</button><h1 class="laiso-h1">' +
          esc(title) +
          '</h1><div></div></div>'
        );
      }
      function getAllVinyls() {
        var arr = [];
        var seen = {};
        (state.vinyls || []).concat(state.collection || []).forEach(function (v) {
          if (!v || !v.id || seen[v.id]) return;
          seen[v.id] = true;
          arr.push(v);
        });
        return arr;
      }
      function displayPos(t, v) {
        try {
          if (typeof displayPosition === 'function') return displayPosition(t, v);
        } catch (_) {}
        return (t && (t.position || t.side)) || '—';
      }
      function getProblemTracks() {
        var out = [];
        getAllVinyls().forEach(function (v) {
          if (!v || v.excludeFromSets || !Array.isArray(v.tracklist)) return;
          v.tracklist.forEach(function (t) {
            if (!t || t.excludeFromSets) return;
            var noBpm = !t.bpm;
            var noCam = !t.camelot;
            if (!noBpm && !noCam) return;
            out.push({ vinyl: v, track: t, noBpm: noBpm, noCam: noCam, pos: displayPos(t, v) });
          });
        });
        return out;
      }
      function countAllTracks() {
        var n = 0;
        getAllVinyls().forEach(function (v) {
          if (!v || v.excludeFromSets || !Array.isArray(v.tracklist)) return;
          v.tracklist.forEach(function (t) {
            if (t && !t.excludeFromSets) n++;
          });
        });
        return n;
      }
      function parseCamelot(v) {
        var s = String(v || '')
          .trim()
          .toUpperCase();
        return /^([1-9]|1[0-2])[AB]$/.test(s) ? s : null;
      }
      function normalizeManualKey(v) {
        var s = String(v || '').trim();
        if (!s) return { key: null, camelot: null };
        var cam = parseCamelot(s);
        if (cam) {
          var key = null;
          try {
            if (typeof CAMELOT_TO_KEY !== 'undefined') key = CAMELOT_TO_KEY[cam] || null;
          } catch (_) {}
          return { key: key || cam, camelot: cam };
        }
        try {
          if (typeof normalizeKey === 'function') {
            var nk = normalizeKey(s);
            if (nk) {
              var c = null;
              try {
                c = KEY_TO_CAMELOT[nk] || null;
              } catch (_) {}
              return { key: nk, camelot: c };
            }
          }
          if (typeof normalizeKeyName === 'function') {
            var nk2 = normalizeKeyName(s);
            if (nk2) {
              var c2 = null;
              try {
                c2 = KEY_TO_CAMELOT[nk2] || null;
              } catch (_) {}
              return { key: nk2, camelot: c2 };
            }
          }
        } catch (_) {}
        return { key: s, camelot: null };
      }
      function findPair(vid, tid) {
        var v = getAllVinyls().find(function (x) {
          return String(x.id) === String(vid);
        });
        var t =
          v && Array.isArray(v.tracklist)
            ? v.tracklist.find(function (x) {
                return String(x.id) === String(tid);
              })
            : null;
        return { v: v, t: t };
      }
      function persist(v) {
        try {
          if (typeof persistVinyl === 'function') persistVinyl(v);
        } catch (_) {}
      }
      async function manualEdit(vid, tid) {
        var p = findPair(vid, tid);
        if (!p.t) {
          toast('Трек не найден');
          return;
        }
        var bpmStr = await vertaxPrompt('BPM: число от 60 до 220', p.t.bpm || '');
        if (bpmStr === null) return;
        if (String(bpmStr).trim() !== '') {
          var bpm = parseInt(bpmStr, 10);
          if (isNaN(bpm) || bpm < 60 || bpm > 220) {
            toast('BPM должен быть числом от 60 до 220');
            return;
          }
          p.t.bpm = bpm;
          p.t.bpmSource = 'manual';
          p.t.originalBpm = null;
          p.t.halftimeCorrected = false;
        }
        var keyStr = await vertaxPrompt(
          'Camelot или Key: например 8A, 6B, F# minor',
          p.t.camelot || p.t.key || ''
        );
        if (keyStr === null) return;
        if (String(keyStr).trim() !== '') {
          var norm = normalizeManualKey(keyStr);
          if (!norm.camelot && !norm.key) {
            toast('Не понял тональность. Пример: 8A или F# minor');
            return;
          }
          p.t.key = norm.key;
          p.t.camelot = norm.camelot;
          p.t.keySource = 'manual';
        }
        p.t.confidence = p.t.bpm && p.t.camelot ? 'medium' : 'manual';
        persist(p.v);
        toast('Сохранено');
        renderApp();
      }
      function excludeTrack(vid, tid) {
        var p = findPair(vid, tid);
        if (!p.t) return;
        p.t.excludeFromSets = true;
        persist(p.v);
        toast('Трек исключён из сетов');
        renderApp();
      }
      function renderDiagnosticsPage() {
        var problems = getProblemTracks();
        var total = countAllTracks();
        var noBpm = problems.filter(function (p) {
          return p.noBpm;
        }).length;
        var noCam = problems.filter(function (p) {
          return p.noCam;
        }).length;
        var rows = problems.length
          ? problems
              .map(function (p) {
                var t = p.track;
                var v = p.vinyl;
                return (
                  '<div class="runt25-diag-card">' +
                  '<div class="runt25-pos">' +
                  esc(p.pos) +
                  '</div>' +
                  '<div>' +
                  '<h2 class="runt25-track-title">' +
                  esc(t.title || '—') +
                  '</h2>' +
                  '<div class="runt25-track-meta">' +
                  esc(v.artist || '') +
                  (v.artist && v.title ? ' — ' : '') +
                  esc(v.title || '') +
                  (v.catno ? ' · ' + esc(v.catno) : '') +
                  '</div>' +
                  '<div class="runt25-pills">' +
                  (t.bpm
                    ? '<span class="runt25-pill">' + esc(t.bpm) + ' BPM</span>'
                    : '<span class="runt25-pill warn">нет BPM</span>') +
                  (t.camelot
                    ? '<span class="runt25-pill">' + esc(t.camelot) + '</span>'
                    : '<span class="runt25-pill warn">нет Camelot</span>') +
                  '</div>' +
                  '<div class="runt25-actions">' +
                  '<button class="laiso-btn laiso-btn-sm" data-action="runt25-manual" data-vid="' +
                  esc(v.id) +
                  '" data-tid="' +
                  esc(t.id) +
                  '">Ввести BPM / Camelot</button>' +
                  '<button class="laiso-btn laiso-btn-sm laiso-btn-secondary" data-action="runt25-exclude" data-vid="' +
                  esc(v.id) +
                  '" data-tid="' +
                  esc(t.id) +
                  '">Не использовать</button>' +
                  '</div>' +
                  '</div>' +
                  '</div>'
                );
              })
              .join('')
          : '<div class="runt25-empty">Проблемных треков нет. Можно возвращаться к сборке сета.</div>';
        return (
          '<div class="runt25-diag-page">' +
          getHeader('Исправить данные') +
          '<div class="runt25-diag-intro">' +
          '<strong>Это теперь обычный раздел, без всплывашки</strong>' +
          '<p>Здесь собраны треки без BPM или Camelot. Заполни данные вручную или исключи трек из сетов. На телефоне это скроллится как обычная страница.</p>' +
          '</div>' +
          '<div class="runt25-diag-stats">' +
          '<div class="runt25-diag-stat"><span>треков</span><strong>' +
          total +
          '</strong></div>' +
          '<div class="runt25-diag-stat"><span>без bpm</span><strong>' +
          noBpm +
          '</strong></div>' +
          '<div class="runt25-diag-stat"><span>без cam</span><strong>' +
          noCam +
          '</strong></div>' +
          '</div>' +
          '<div class="runt25-diag-list">' +
          rows +
          '</div>' +
          '<div class="laiso-row" style="margin-top:16px;">' +
          '<button class="laiso-btn laiso-btn-secondary laiso-grow" data-action="runt25-back-set">Назад к сборке</button>' +
          '<button class="laiso-btn laiso-grow" data-action="set-generate">Пересобрать сет</button>' +
          '</div>' +
          '</div>'
        );
      }
      function markButtons() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        root.querySelectorAll('button, .laiso-btn').forEach(function (btn) {
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (
            text.indexOf('показать и исправить') >= 0 ||
            (text.indexOf('исправить') >= 0 && text.indexOf('bpm') >= 0) ||
            text.indexOf('есть треки без bpm') >= 0
          ) {
            btn.setAttribute('data-action', 'runt25-open-diag');
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
          }
        });
      }
      function openDiag() {
        state.ui = state.ui || {};
        state.ui.runt25PrevView = state.view || 'set';
        state.view = 'runt25-diagnostics';
        renderApp();
        setTimeout(function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      }
      function wrapRender() {
        if (window.__runt25RenderWrapped) return;
        var old = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          if (state.view === 'runt25-diagnostics') {
            var root = document.getElementById('laiso-root');
            if (root) root.innerHTML = renderDiagnosticsPage();
            return;
          }
          old();
          setTimeout(markButtons, 60);
        };
        window.__runt25RenderWrapped = true;
      }
      try {
        if (typeof render === 'function' && !window.__runt25GlobalRenderWrapped) {
          var oldGlobal = render;
          render = function () {
            if (state.view === 'runt25-diagnostics') {
              var root = document.getElementById('laiso-root');
              if (root) root.innerHTML = renderDiagnosticsPage();
              return;
            }
            oldGlobal();
            setTimeout(markButtons, 60);
          };
          window.__runt25GlobalRenderWrapped = true;
        }
      } catch (_) {}
      document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var el = e.target.closest('[data-action]');
          if (!el) return;
          var action = el.dataset.action;
          if (action === 'runt25-open-diag') {
            e.preventDefault();
            e.stopPropagation();
            openDiag();
          }
          if (action === 'runt25-back-set') {
            e.preventDefault();
            e.stopPropagation();
            state.view = 'set';
            renderApp();
          }
          if (action === 'runt25-manual') {
            e.preventDefault();
            e.stopPropagation();
            manualEdit(el.dataset.vid, el.dataset.tid).catch(function (err) {
              console.warn('manual edit failed', err);
            });
          }
          if (action === 'runt25-exclude') {
            e.preventDefault();
            e.stopPropagation();
            excludeTrack(el.dataset.vid, el.dataset.tid);
          }
        },
        true
      );
      /* back button compatibility */ document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var btn = e.target.closest('button, .laiso-btn');
          if (!btn) return;
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (state.view === 'runt25-diagnostics' && text.indexOf('назад') >= 0) {
            e.preventDefault();
            e.stopPropagation();
            state.view = 'set';
            renderApp();
          }
        },
        true
      );
      wrapRender();
      markButtons();
      setTimeout(function () {
        markButtons();
        console.log('RUNT-01 PATCH-25 loaded: diagnostics is now a normal section, no popup');
      }, 300);
    }
    boot();
  })();
}

function installRuntSourceSelectionPage() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      if (!state.ui) state.ui = {};
      if (!state.ui.runt26SelectedVinyls) state.ui.runt26SelectedVinyls = {};
      function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function renderApp() {
        try {
          if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
            window.laisoBuck.render();
          else if (typeof window.render === 'function') window.render();
        } catch (e) {
          console.warn('PATCH-26 render error', e);
        }
      }
      function getHeader(title) {
        try {
          if (typeof renderHeader === 'function') return renderHeader(title);
        } catch (_) {}
        return (
          '<div class="laiso-header"><button class="laiso-back" data-action="back">← Назад</button><h1 class="laiso-h1">' +
          esc(title) +
          '</h1><div></div></div>'
        );
      }
      function getCollectionVinyls() {
        var arr = [];
        var seen = {};
        (state.collection || []).forEach(function (v) {
          if (!v || !v.id || seen[v.id]) return;
          seen[v.id] = true;
          arr.push(v);
        });
        arr.sort(function (a, b) {
          return (
            String(a.artist || '').localeCompare(String(b.artist || '')) ||
            String(a.title || '').localeCompare(String(b.title || ''))
          );
        });
        return arr;
      }
      function getSessionVinyls() {
        var arr = [];
        var seen = {};
        (state.vinyls || []).forEach(function (v) {
          if (!v || !v.id || seen[v.id]) return;
          seen[v.id] = true;
          arr.push(v);
        });
        return arr;
      }
      function ensureInitialSelection() {
        var selected = state.ui.runt26SelectedVinyls || {};
        var hasAny = Object.keys(selected).some(function (k) {
          return selected[k];
        });
        if (hasAny) return;
        if (state.ui.runt26SelectionCleared) return;
        /* По умолчанию выбираем пластинки из текущей сессии. */ var session = getSessionVinyls();
        if (session.length) {
          session.forEach(function (v) {
            selected[v.id] = true;
          });
        } else {
          /* Если сессия пустая, выбираем всю коллекцию, чтобы пользователь не упёрся в пустоту. */ getCollectionVinyls().forEach(
            function (v) {
              selected[v.id] = true;
            }
          );
        }
        state.ui.runt26SelectedVinyls = selected;
      }
      function getSelectedVinyls() {
        ensureInitialSelection();
        var selected = state.ui.runt26SelectedVinyls || {};
        return getCollectionVinyls().filter(function (v) {
          return !!selected[v.id];
        });
      }
      function countTracks(v) {
        return v && Array.isArray(v.tracklist)
          ? v.tracklist.filter(function (t) {
              return t && !t.excludeFromSets;
            }).length
          : 0;
      }
      function countReadyTracks(v) {
        return v && Array.isArray(v.tracklist)
          ? v.tracklist.filter(function (t) {
              return t && !t.excludeFromSets && t.bpm;
            }).length
          : 0;
      }
      function renderSourcePage() {
        ensureInitialSelection();
        var allVinyls = getCollectionVinyls();
        var selected = state.ui.runt26SelectedVinyls || {};
        var search = String(state.ui.runt26Search || '')
          .toLowerCase()
          .trim();
        var vinyls = search
          ? allVinyls.filter(function (v) {
              return [v.title, v.artist, v.label, v.catno, v.year, v.format].some(function (x) {
                return (
                  String(x || '')
                    .toLowerCase()
                    .indexOf(search) >= 0
                );
              });
            })
          : allVinyls;
        var selectedCount = allVinyls.filter(function (v) {
          return selected[v.id];
        }).length;
        var rows = vinyls.length
          ? vinyls
              .map(function (v) {
                var isSelected = !!selected[v.id];
                var tracks = countTracks(v);
                var ready = countReadyTracks(v);
                var cover = v.coverUrl ? '<img src="' + esc(v.coverUrl) + '" alt="">' : 'vinyl';
                return (
                  '<div class="runt26-card ' +
                  (isSelected ? 'is-selected' : '') +
                  '" data-action="runt26-toggle-vinyl" data-vid="' +
                  esc(v.id) +
                  '">' +
                  '<div class="runt26-cover">' +
                  cover +
                  '</div>' +
                  '<div>' +
                  '<div class="runt26-title">' +
                  esc(v.title || '—') +
                  '</div>' +
                  '<div class="runt26-meta">' +
                  esc(v.artist || '') +
                  (v.catno ? ' · ' + esc(v.catno) : '') +
                  (v.year ? ' · ' + esc(v.year) : '') +
                  '</div>' +
                  '<div class="runt26-stats">' +
                  '<span class="runt26-pill">' +
                  tracks +
                  ' трек.</span>' +
                  '<span class="runt26-pill">с BPM: ' +
                  ready +
                  '</span>' +
                  '</div>' +
                  '</div>' +
                  '<div class="runt26-check">' +
                  (isSelected ? '✓' : '') +
                  '</div>' +
                  '</div>'
                );
              })
              .join('')
          : '<div class="runt26-empty">В коллекции пока нет пластинок. Сначала добавь пластинки через поиск.</div>';
        return (
          '<div class="runt26-source-page">' +
          getHeader('Выбор пластинок') +
          '<div class="runt26-intro">' +
          '<strong>Выбери пластинки для сета</strong>' +
          '<p>Можно собрать сет из текущих добавленных пластинок или из всей коллекции. Отметь нужные релизы, проверь количество треков с BPM и нажми «Собрать из выбранных».</p>' +
          '</div>' +
          '<div class="runt26-tools">' +
          '<button class="laiso-btn laiso-btn-secondary" data-action="runt26-select-all">Выделить все</button>' +
          '<button class="laiso-btn laiso-btn-secondary" data-action="runt26-clear">Снять всё</button>' +
          '</div>' +
          '<div class="laiso-panel runt26-search-panel"><input class="laiso-input" type="search" data-action="runt26-search" placeholder="Поиск по пластинкам" value="' +
          esc(state.ui.runt26Search || '') +
          '"></div>' +
          '<div class="laiso-meta" style="margin:10px 2px 8px;">выбрано: ' +
          selectedCount +
          ' / ' +
          allVinyls.length +
          (search ? ' · показано: ' + vinyls.length : '') +
          '</div>' +
          '<div class="runt26-list">' +
          rows +
          '</div>' +
          '<div class="runt26-sticky">' +
          '<button class="laiso-btn laiso-btn-block" data-action="runt26-build-selected">Собрать из выбранных (' +
          selectedCount +
          ')</button>' +
          '</div>' +
          '</div>'
        );
      }
      function setSelectedVinyls(vinyls) {
        var selected = {};
        (vinyls || []).forEach(function (v) {
          if (v && v.id) selected[v.id] = true;
        });
        state.ui.runt26SelectedVinyls = selected;
        state.ui.runt26SelectionCleared = Object.keys(selected).length === 0;
      }
      function syncSelectedVinylsToSession() {
        var selectedVinyls = getSelectedVinyls();
        state.vinyls = selectedVinyls.slice();
        state.ui.setScope = 'session';
        return selectedVinyls;
      }
      function selectedTracksForSet() {
        var selectedVinyls = getSelectedVinyls();
        var out = [];
        selectedVinyls.forEach(function (v) {
          if (!v || v.excludeFromSets || !Array.isArray(v.tracklist)) return;
          v.tracklist.forEach(function (t) {
            if (!t || t.excludeFromSets) return;
            var pos = t.position || '';
            try {
              if (typeof displayPosition === 'function') pos = displayPosition(t, v);
            } catch (_) {}
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
              displayPosition: pos,
              recordId: v.id,
              vinylTitle: v.title,
              vinylArtist: v.artist,
              vinylCatno: v.catno || '',
              vinylLabel: v.label || '',
            });
          });
        });
        return out;
      }
      function buildFromSelected() {
        syncSelectedVinylsToSession();
        var tracks = selectedTracksForSet();
        var mode = state.ui.setMode || 'best-flow';
        var opts = state.ui.setOptions || { tempoRange: 4 };
        if (mode === 'custom') {
          state.ui.generatedSet = tracks.slice();
          state.view = 'set';
          state.modal = null;
          toast('Добавлено в свой сет: ' + tracks.length + ' трек.');
          renderApp();
          return;
        }
        var usable = tracks.filter(function (t) {
          if (mode === 'tempo-safe' || mode === 'best-flow') return !!t.bpm;
          if (mode === 'camelot-safe') return !!t.camelot;
          if (mode === 'camelot-filter') {
            var s = opts.camelotSet || {};
            return t.camelot && s[t.camelot];
          }
          return true;
        });
        if (usable.length < 2) {
          if (tracks.length) {
            state.ui.setMode = 'custom';
            state.ui.generatedSet = tracks.slice();
            state.view = 'set';
            state.modal = null;
            toast(
              'Собран свой сет: ' + tracks.length + ' трек. BPM / Camelot можно заполнить позже.'
            );
            renderApp();
            return;
          }
          toast(
            'В выбранных пластинках нет треклистов. Открой пластинку в коллекции и загрузи треки.'
          );
          return;
        }
        var targetLen =
          typeof window.vertaxSetDesiredTrackCount === 'function'
            ? window.vertaxSetDesiredTrackCount(usable)
            : Math.min(16, usable.length);
        var result = [];
        try {
          if (typeof generateSetAlgo === 'function') {
            result = generateSetAlgo(usable, mode, opts, targetLen);
          }
        } catch (e) {
          console.warn('PATCH-26 generate error', e);
        }
        if (!result || !result.length) {
          toast('Не удалось собрать сет из выбранных');
          return;
        }
        state.ui.generatedSet = result;
        state.view = 'set';
        toast('Сет собран из выбранных: ' + result.length + ' трек.');
        renderApp();
      }
      function openSourcePage() {
        ensureInitialSelection();
        state.ui.runt26PrevView = state.view || 'set';
        state.view = 'runt26-source';
        renderApp();
        setTimeout(function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      }
      function markButtons() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        root.querySelectorAll('button, .laiso-btn').forEach(function (btn) {
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          var action = btn.dataset && btn.dataset.action;
          var looksLikeSource =
            text.indexOf('выбрать пластинки') >= 0 ||
            (text.indexOf('вся коллекция') >= 0 && text.indexOf('выбрать') >= 0) ||
            text.indexOf('выбрать / вся') >= 0 ||
            text.indexOf('пластинки / вся коллекция') >= 0 ||
            action === 'runt18c-open-source' ||
            action === 'runt18-open-source' ||
            action === 'open-set-source' ||
            action === 'set-source-picker';
          if (looksLikeSource) {
            btn.setAttribute('data-action', 'runt26-open-source');
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
          }
        });
      }
      function wrapRender() {
        if (window.__runt26RenderWrapped) return;
        var old = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          if (state.view === 'runt26-source') {
            var root = document.getElementById('laiso-root');
            if (root) root.innerHTML = renderSourcePage();
            if (typeof syncTelegramChrome === 'function') syncTelegramChrome();
            if (typeof window.vertaxTranslateApp === 'function') window.vertaxTranslateApp();
            return;
          }
          old();
          setTimeout(markButtons, 80);
        };
        window.__runt26RenderWrapped = true;
      }
      try {
        if (typeof render === 'function' && !window.__runt26GlobalRenderWrapped) {
          var oldGlobal = render;
          render = function () {
            if (state.view === 'runt26-source') {
              var root = document.getElementById('laiso-root');
              if (root) root.innerHTML = renderSourcePage();
              if (typeof syncTelegramChrome === 'function') syncTelegramChrome();
              if (typeof window.vertaxTranslateApp === 'function') window.vertaxTranslateApp();
              return;
            }
            oldGlobal();
            setTimeout(markButtons, 80);
          };
          window.__runt26GlobalRenderWrapped = true;
        }
      } catch (_) {}
      document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var el = e.target.closest('[data-action], button, .laiso-btn');
          if (!el) return;
          var action = el.dataset && el.dataset.action;
          var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (
            action === 'runt26-open-source' ||
            text.indexOf('выбрать пластинки') >= 0 ||
            text.indexOf('пластинки / вся коллекция') >= 0
          ) {
            e.preventDefault();
            e.stopPropagation();
            openSourcePage();
            return;
          }
          if (action === 'runt26-toggle-vinyl') {
            e.preventDefault();
            e.stopPropagation();
            var id = el.dataset.vid;
            if (!id) return;
            state.ui.runt26SelectedVinyls = state.ui.runt26SelectedVinyls || {};
            state.ui.runt26SelectedVinyls[id] = !state.ui.runt26SelectedVinyls[id];
            renderApp();
            return;
          }
          if (action === 'runt26-select-session') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedVinyls(getSessionVinyls());
            renderApp();
            return;
          }
          if (action === 'runt26-select-all') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedVinyls(getCollectionVinyls());
            renderApp();
            return;
          }
          if (action === 'runt26-clear') {
            e.preventDefault();
            e.stopPropagation();
            state.ui.runt26SelectedVinyls = {};
            state.ui.runt26SelectionCleared = true;
            renderApp();
            return;
          }
          if (action === 'runt26-back-set') {
            e.preventDefault();
            e.stopPropagation();
            state.view = 'set';
            renderApp();
            return;
          }
          if (action === 'runt26-build-selected') {
            e.preventDefault();
            e.stopPropagation();
            buildFromSelected();
            return;
          }
        },
        true
      );
      document.addEventListener(
        'input',
        function (e) {
          if (!e.target.closest || !e.target.closest('#laiso-app')) return;
          if (!e.target.dataset || e.target.dataset.action !== 'runt26-search') return;
          state.ui.runt26Search = e.target.value || '';
          renderApp();
          setTimeout(function () {
            var input = document.querySelector('#laiso-app input[data-action="runt26-search"]');
            if (input) {
              input.focus();
              try {
                input.setSelectionRange(input.value.length, input.value.length);
              } catch (_) {}
            }
          }, 0);
        },
        true
      );
      /* Back compatibility */ document.addEventListener(
        'click',
        function (e) {
          if (state.view !== 'runt26-source') return;
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var btn = e.target.closest('button, .laiso-btn');
          if (!btn) return;
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (text.indexOf('назад') >= 0) {
            e.preventDefault();
            e.stopPropagation();
            state.view = 'set';
            renderApp();
          }
        },
        true
      );
      wrapRender();
      markButtons();
      setTimeout(function () {
        markButtons();
        console.log('RUNT-01 PATCH-26 loaded: set source picker is now a normal section, no popup');
      }, 300);
    }
    boot();
  })();
}

function installRuntBackButtonCopy() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      function cleanBackButtons() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        root.querySelectorAll('.laiso-back').forEach(function (btn) {
          var txt = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          /* унифицируем текст */ if (
            txt.indexOf('назад') >= 0 ||
            txt.indexOf('back') >= 0 ||
            txt.indexOf('закрыть') >= 0 ||
            txt.indexOf('close') >= 0
          ) {
            btn.textContent = 'Назад';
          }
          /* если это закрытие модалки, оставляем "Закрыть", чтобы не путать */ var action =
            btn.dataset && btn.dataset.action;
          if (action === 'close-modal' || action === 'runt21-close-modal') {
            btn.textContent = 'Закрыть';
          }
        });
        /* На всякий случай убираем заголовки, которые могли быть не h1, а прямым текстом в header. */ root
          .querySelectorAll('.laiso-header')
          .forEach(function (header) {
            Array.from(header.children).forEach(function (child) {
              if (child.classList && child.classList.contains('laiso-back')) return;
              var isTitle =
                (child.tagName && /^H[1-3]$/.test(child.tagName)) ||
                (child.classList && child.classList.contains('laiso-h1'));
              if (isTitle) child.style.display = 'none';
              /* пустые декоративные слоты */ if (
                !child.textContent.trim() &&
                child.children.length === 0
              ) {
                child.style.display = 'none';
              }
            });
          });
      }
      if (!window.__runt27RenderWrapped) {
        var old = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          old();
          setTimeout(cleanBackButtons, 40);
        };
        window.__runt27RenderWrapped = true;
      }
      try {
        if (typeof render === 'function' && !window.__runt27GlobalRenderWrapped) {
          var oldGlobal = render;
          render = function () {
            oldGlobal();
            setTimeout(cleanBackButtons, 40);
          };
          window.__runt27GlobalRenderWrapped = true;
        }
      } catch (_) {}
      var app = document.getElementById('laiso-app');
      if (app && window.MutationObserver) {
        var obs = new MutationObserver(function () {
          clearTimeout(window.__runt27Timer);
          window.__runt27Timer = setTimeout(cleanBackButtons, 60);
        });
        obs.observe(app, { childList: true, subtree: true });
      }
      setTimeout(function () {
        cleanBackButtons();
        console.log('RUNT-01 PATCH-27 loaded: page titles removed, back button improved');
      }, 300);
    }
    boot();
  })();
}

function installRuntSourceEntryButtons() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      function renderApp() {
        try {
          if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
            window.laisoBuck.render();
          else if (typeof window.render === 'function') window.render();
        } catch (e) {
          console.warn('PATCH-28 render error', e);
        }
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function hasCollection() {
        return Array.isArray(state.collection) && state.collection.length > 0;
      }
      function hasSessionVinyls() {
        return Array.isArray(state.vinyls) && state.vinyls.length > 0;
      }
      function openSourceSection() {
        state.ui = state.ui || {};
        state.ui.runt26PrevView = state.view || 'set';
        /* Если PATCH-26 есть, он сам нарисует нормальный раздел. */ state.view = 'runt26-source';
        /* Если сессия пустая, а коллекция есть, по умолчанию пусть выбор будет из всей коллекции. */ if (
          !hasSessionVinyls() &&
          hasCollection()
        ) {
          state.ui.runt26SelectedVinyls = {};
          state.collection.forEach(function (v) {
            if (v && v.id) state.ui.runt26SelectedVinyls[v.id] = true;
          });
        }
        state.modal = null;
        renderApp();
        setTimeout(function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          cleanSourceCopy();
        }, 80);
      }
      function cleanSourceCopy() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        /* Меняем текст в intro PATCH-26 */ var intro = root.querySelector('.runt26-intro');
        if (intro) {
          var strong = intro.querySelector('strong');
          var p = intro.querySelector('p');
          if (strong) strong.textContent = 'Выбери пластинки для сета';
          if (p) {
            p.textContent =
              'Можно собрать сет из текущих добавленных пластинок или из всей коллекции. Отметь нужные релизы, проверь количество треков с BPM и нажми «Собрать из выбранных».';
          }
        }
        /* На всякий случай чистим фразу, если она где-то осталась текстовым узлом. */ var walker =
          document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (n) {
          if (
            n.nodeValue &&
            n.nodeValue.indexOf('Это теперь обычный раздел, без всплывашки') >= 0
          ) {
            n.nodeValue = n.nodeValue.replace(
              'Это теперь обычный раздел, без всплывашки',
              'Выбери пластинки для сета'
            );
          }
        });
      }
      function markBuildButtons() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        root.querySelectorAll('button, .laiso-btn, [data-action]').forEach(function (btn) {
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          var action = btn.dataset && btn.dataset.action;
          var isHomeBuild =
            text === 'собрать сет' || (text.indexOf('собрать сет') >= 0 && state.view === 'home');
          var isCollectionBuild =
            text.indexOf('+ собрать сет') >= 0 ||
            (text.indexOf('собрать сет') >= 0 && state.view === 'collection');
          var isOldSource =
            action === 'go-set' ||
            action === 'open-set-source' ||
            action === 'set-source-picker' ||
            action === 'runt18c-open-source' ||
            action === 'runt26-open-source';
          if (isHomeBuild || isCollectionBuild || isOldSource) {
            btn.setAttribute('data-action', 'runt28-open-source');
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
          }
        });
        cleanSourceCopy();
      }
      function killSourceModalIfAppeared() {
        var modals = document.querySelectorAll('#laiso-app .laiso-modal-bg');
        modals.forEach(function (bg) {
          var text = (bg.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          var looksLikeSourceModal =
            text.indexOf('собрать сет') >= 0 &&
            (text.indexOf('источник треков') >= 0 ||
              text.indexOf('выбрать пластинки') >= 0 ||
              text.indexOf('вся коллекция') >= 0);
          if (looksLikeSourceModal) {
            bg.classList.add('runt28-kill-source-modal');
            try {
              bg.remove();
            } catch (_) {}
            state.modal = null;
            openSourceSection();
          }
        });
      }
      /* Подстраховка: если есть handlers, перехватываем go-set. */ try {
        if (typeof handlers !== 'undefined' && handlers) {
          handlers['runt28-open-source'] = function () {
            openSourceSection();
          };
          handlers['go-set'] = function () {
            /* Больше не идём сразу в set/модалку. Сначала нормальный выбор источника. */ if (
              !hasCollection() &&
              !hasSessionVinyls()
            ) {
              state.view = 'add';
              renderApp();
              toast('Сначала добавь пластинки');
              return;
            }
            openSourceSection();
          };
        }
      } catch (e) {
        console.warn('PATCH-28 handlers patch failed', e);
      }
      document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          var el = e.target.closest('button, .laiso-btn, [data-action]');
          if (!el) return;
          var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          var action = el.dataset && el.dataset.action;
          var shouldOpenSource =
            action === 'runt28-open-source' ||
            action === 'go-set' ||
            action === 'open-set-source' ||
            action === 'set-source-picker' ||
            action === 'runt18c-open-source' ||
            (text.indexOf('собрать сет') >= 0 &&
              (state.view === 'home' || state.view === 'collection'));
          if (!shouldOpenSource) return;
          e.preventDefault();
          e.stopPropagation();
          if (!hasCollection() && !hasSessionVinyls()) {
            state.view = 'add';
            state.modal = null;
            renderApp();
            toast('Сначала добавь пластинки');
            return;
          }
          openSourceSection();
        },
        true
      );
      if (!window.__runt28RenderWrapped) {
        var old = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          old();
          setTimeout(function () {
            markBuildButtons();
            killSourceModalIfAppeared();
            cleanSourceCopy();
          }, 80);
        };
        window.__runt28RenderWrapped = true;
      }
      try {
        if (typeof render === 'function' && !window.__runt28GlobalRenderWrapped) {
          var oldGlobal = render;
          render = function () {
            oldGlobal();
            setTimeout(function () {
              markBuildButtons();
              killSourceModalIfAppeared();
              cleanSourceCopy();
            }, 80);
          };
          window.__runt28GlobalRenderWrapped = true;
        }
      } catch (_) {}
      var app = document.getElementById('laiso-app');
      if (app && window.MutationObserver) {
        var obs = new MutationObserver(function () {
          clearTimeout(window.__runt28Timer);
          window.__runt28Timer = setTimeout(function () {
            markBuildButtons();
            killSourceModalIfAppeared();
            cleanSourceCopy();
          }, 100);
        });
        obs.observe(app, { childList: true, subtree: true });
      }
      setTimeout(function () {
        markBuildButtons();
        killSourceModalIfAppeared();
        cleanSourceCopy();
        console.log('RUNT-01 PATCH-28 loaded: clean source copy + home build set opens section');
      }, 300);
    }
    boot();
  })();
}

function installRuntSourceSelectionHardFix() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      if (!state.ui) state.ui = {};
      if (!state.ui.runt26SelectedVinyls) state.ui.runt26SelectedVinyls = {};
      function renderApp() {
        try {
          if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
            window.laisoBuck.render();
          else if (typeof window.render === 'function') window.render();
        } catch (e) {
          console.warn('PATCH-30 render error', e);
        }
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function uniqueVinyls(list) {
        var out = [];
        var seen = {};
        (list || []).forEach(function (v) {
          if (!v || !v.id || seen[v.id]) return;
          seen[v.id] = true;
          out.push(v);
        });
        return out;
      }
      function getCollectionVinyls() {
        return uniqueVinyls(state.collection || []);
      }
      function getSessionVinyls() {
        return uniqueVinyls(state.vinyls || []);
      }
      function getSelectedMap() {
        state.ui = state.ui || {};
        state.ui.runt26SelectedVinyls = state.ui.runt26SelectedVinyls || {};
        return state.ui.runt26SelectedVinyls;
      }
      function setSelected(vinyls) {
        var map = {};
        uniqueVinyls(vinyls || []).forEach(function (v) {
          map[v.id] = true;
        });
        state.ui.runt26SelectedVinyls = map;
        state.ui.runt26SelectionCleared = Object.keys(map).length === 0;
        updateSourceDom();
      }
      function getSelectedVinyls() {
        var selected = getSelectedMap();
        return getCollectionVinyls().filter(function (v) {
          return !!selected[v.id];
        });
      }
      function syncSelectedVinylsToSession() {
        var selectedVinyls = getSelectedVinyls();
        state.vinyls = selectedVinyls.slice();
        state.ui.setScope = 'session';
        return selectedVinyls;
      }
      function isSourcePage() {
        var root = document.getElementById('laiso-root');
        return (
          state.view === 'runt26-source' || !!(root && root.querySelector('.runt26-source-page'))
        );
      }
      function updateSourceDom() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        var selected = getSelectedMap();
        var totalCards = 0;
        var selectedCount = 0;
        root
          .querySelectorAll(
            '.runt26-card[data-vid], .runt26-card[data-action="runt26-toggle-vinyl"]'
          )
          .forEach(function (card) {
            var id = card.dataset.vid;
            if (!id) return;
            totalCards++;
            var isSel = !!selected[id];
            if (isSel) selectedCount++;
            card.classList.toggle('is-selected', isSel);
            var check = card.querySelector('.runt26-check');
            if (check) check.textContent = isSel ? '✓' : '';
          });
        /* Update every "выбрано: X / Y" label. */ var walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          null
        );
        var textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach(function (n) {
          var txt = n.nodeValue || '';
          if (/выбрано\s*:/i.test(txt)) {
            n.nodeValue = txt.replace(
              /выбрано\s*:\s*\d+\s*\/\s*\d+/i,
              'выбрано: ' + selectedCount + ' / ' + totalCards
            );
            n.nodeValue = n.nodeValue.replace(/выбрано\s*:\s*\d+/i, 'выбрано: ' + selectedCount);
          }
        });
        /* Update sticky build button count. */ root
          .querySelectorAll('button, .laiso-btn')
          .forEach(function (btn) {
            var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (text.indexOf('собрать из выбранных') >= 0) {
              btn.textContent = 'Собрать из выбранных (' + selectedCount + ')';
              btn.disabled = selectedCount === 0;
              btn.style.pointerEvents = selectedCount === 0 ? 'none' : 'auto';
            }
          });
      }
      window.runt30UpdateSourceDom = updateSourceDom;
      function selectedTracksForSet() {
        var out = [];
        getSelectedVinyls().forEach(function (v) {
          if (!v || v.excludeFromSets || !Array.isArray(v.tracklist)) return;
          v.tracklist.forEach(function (t) {
            if (!t || t.excludeFromSets) return;
            var pos = t.position || '';
            try {
              if (typeof displayPosition === 'function') pos = displayPosition(t, v);
            } catch (_) {}
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
              displayPosition: pos,
              recordId: v.id,
              vinylTitle: v.title,
              vinylArtist: v.artist,
              vinylCatno: v.catno || '',
              vinylLabel: v.label || '',
            });
          });
        });
        return out;
      }
      function buildFromSelected() {
        syncSelectedVinylsToSession();
        var tracks = selectedTracksForSet();
        var mode = state.ui.setMode || 'best-flow';
        var opts = state.ui.setOptions || { tempoRange: 4 };
        if (mode === 'custom') {
          state.ui.generatedSet = tracks.slice();
          state.view = 'set';
          state.modal = null;
          toast('Добавлено в свой сет: ' + tracks.length + ' трек.');
          renderApp();
          return;
        }
        var usable = tracks.filter(function (t) {
          if (mode === 'tempo-safe' || mode === 'best-flow') return !!t.bpm;
          if (mode === 'camelot-safe') return !!t.camelot;
          if (mode === 'camelot-filter') {
            var s = opts.camelotSet || {};
            return t.camelot && s[t.camelot];
          }
          return true;
        });
        if (usable.length < 2) {
          if (tracks.length) {
            state.ui.setMode = 'custom';
            state.ui.generatedSet = tracks.slice();
            state.view = 'set';
            state.modal = null;
            toast(
              'Собран свой сет: ' + tracks.length + ' трек. BPM / Camelot можно заполнить позже.'
            );
            renderApp();
            return;
          }
          toast(
            'В выбранных пластинках нет треклистов. Открой пластинку в коллекции и загрузи треки.'
          );
          return;
        }
        var targetLen =
          typeof window.vertaxSetDesiredTrackCount === 'function'
            ? window.vertaxSetDesiredTrackCount(usable)
            : Math.min(16, usable.length);
        var result = [];
        try {
          if (typeof generateSetAlgo === 'function') {
            result = generateSetAlgo(usable, mode, opts, targetLen);
          }
        } catch (e) {
          console.warn('PATCH-30 generate error', e);
        }
        if (!result || !result.length) {
          toast('Не удалось собрать сет из выбранных');
          return;
        }
        state.ui.generatedSet = result;
        state.view = 'set';
        state.modal = null;
        toast('Сет собран: ' + result.length + ' трек.');
        renderApp();
      }
      function handleSourceClick(e, el) {
        var action = el.dataset && el.dataset.action;
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var selectSession =
          action === 'runt30-select-session' ||
          action === 'runt29-select-session' ||
          action === 'runt26-select-session' ||
          text.indexOf('выбрать добавленные') >= 0;
        var selectAll =
          action === 'runt30-select-all' ||
          action === 'runt29-select-all' ||
          action === 'runt26-select-all' ||
          text === 'вся коллекция' ||
          text.indexOf('вся коллекция') >= 0;
        var clear =
          action === 'runt30-clear' ||
          action === 'runt29-clear' ||
          action === 'runt26-clear' ||
          text.indexOf('снять всё') >= 0 ||
          text.indexOf('снять все') >= 0;
        var back =
          action === 'runt30-back-set' ||
          action === 'runt29-back-set' ||
          action === 'runt26-back-set' ||
          text.indexOf('назад к сборке') >= 0 ||
          (text.indexOf('назад') >= 0 && state.view === 'runt26-source');
        var toggleCard =
          action === 'runt26-toggle-vinyl' ||
          (el.classList && el.classList.contains('runt26-card') && el.dataset.vid);
        var build =
          action === 'runt30-build-selected' ||
          action === 'runt26-build-selected' ||
          text.indexOf('собрать из выбранных') >= 0;
        if (!(selectSession || selectAll || clear || back || toggleCard || build)) return false;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (selectSession) {
          var session = getSessionVinyls();
          /* Если текущая сессия пустая, не делаем вид, что всё ок. */ if (!session.length) {
            toast('В текущей сессии нет добавленных пластинок');
            setSelected([]);
            return true;
          }
          setSelected(session);
          return true;
        }
        if (selectAll) {
          var collection = getCollectionVinyls();
          if (!collection.length) {
            toast('Коллекция пустая');
            setSelected([]);
            return true;
          }
          setSelected(collection);
          return true;
        }
        if (clear) {
          setSelected([]);
          return true;
        }
        if (back) {
          state.view = 'set';
          state.modal = null;
          renderApp();
          return true;
        }
        if (toggleCard) {
          var id = el.dataset.vid;
          if (!id) return true;
          var map = getSelectedMap();
          map[id] = !map[id];
          updateSourceDom();
          return true;
        }
        if (build) {
          buildFromSelected();
          return true;
        }
        return true;
      }
      function addRemoveButtonsToSet() {
        var root = document.getElementById('laiso-root');
        if (!root || state.view !== 'set') return;
        var cards = root.querySelectorAll('.laiso-set-card, .runt-set-card');
        cards.forEach(function (card, idx) {
          if (card.querySelector('.runt30-remove-track')) return;
          var titleEl = card.querySelector('.laiso-set-title, .runt-set-title');
          var trackTitle = titleEl ? titleEl.textContent.trim() : '';
          var btn = document.createElement('button');
          btn.className = 'runt30-remove-track';
          btn.setAttribute('data-runt30-remove-index', String(idx));
          btn.type = 'button';
          btn.textContent = 'убрать';
          /* Put near existing pills if possible. */ var pills = card.querySelector(
            '.laiso-set-pills, .runt-set-actions'
          );
          if (pills) {
            pills.appendChild(btn);
          } else {
            var box = document.createElement('div');
            box.className = 'runt30-card-actions';
            box.appendChild(btn);
            card.appendChild(box);
          }
        });
      }
      function removeSetTrackByIndex(idx) {
        if (!state.ui || !Array.isArray(state.ui.generatedSet)) return;
        if (idx < 0 || idx >= state.ui.generatedSet.length) return;
        var removed = state.ui.generatedSet.splice(idx, 1)[0];
        toast('Убрано: ' + ((removed && removed.title) || 'трек'));
        renderApp();
      }
      function logoToHome(e, el) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        state.view = 'home';
        state.modal = null;
        renderApp();
        setTimeout(function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      }
      function isLogoClickTarget(el) {
        if (!el || !el.closest) return false;
        return !!el.closest('.laiso-brand, .laiso-brand-wrap, .laiso-dotmark');
      }
      function markControls() {
        var root = document.getElementById('laiso-root');
        if (!root) return;
        if (isSourcePage()) {
          var page = root.querySelector('.runt26-source-page');
          var tools = page && page.querySelector('.runt26-tools');
          if (tools) tools.style.display = '';
          root.querySelectorAll('button, .laiso-btn, [data-action]').forEach(function (btn) {
            var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            if (text.indexOf('выбрать добавленные') >= 0 || text.indexOf('назад к сборке') >= 0) {
              btn.remove();
              return;
            }
            if (text.indexOf('вся коллекция') >= 0)
              btn.setAttribute('data-action', 'runt30-select-all');
            if (text.indexOf('снять всё') >= 0 || text.indexOf('снять все') >= 0)
              btn.setAttribute('data-action', 'runt30-clear');
            if (text.indexOf('собрать из выбранных') >= 0)
              btn.setAttribute('data-action', 'runt30-build-selected');
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
          });
          updateSourceDom();
        }
        addRemoveButtonsToSet();
      }
      document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          /* Logo to home */ if (isLogoClickTarget(e.target)) {
            logoToHome(e, e.target);
            return;
          }
          /* Remove set track */ var removeBtn =
            e.target.closest && e.target.closest('[data-runt30-remove-index]');
          if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            var idx = parseInt(removeBtn.getAttribute('data-runt30-remove-index'), 10);
            removeSetTrackByIndex(idx);
            return;
          }
          /* Source section controls */ if (isSourcePage()) {
            var el = e.target.closest('button, .laiso-btn, .runt26-card, [data-action]');
            if (el && handleSourceClick(e, el)) return;
          }
        },
        true
      );
      if (!window.__runt30RenderWrapped) {
        var old = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          old();
          setTimeout(markControls, 80);
        };
        window.__runt30RenderWrapped = true;
      }
      try {
        if (typeof render === 'function' && !window.__runt30GlobalRenderWrapped) {
          var oldGlobal = render;
          render = function () {
            oldGlobal();
            setTimeout(markControls, 80);
          };
          window.__runt30GlobalRenderWrapped = true;
        }
      } catch (_) {}
      var app = document.getElementById('laiso-app');
      if (app && window.MutationObserver) {
        var obs = new MutationObserver(function () {
          clearTimeout(window.__runt30Timer);
          window.__runt30Timer = setTimeout(markControls, 80);
        });
        obs.observe(app, { childList: true, subtree: true });
      }
      setTimeout(function () {
        markControls();
        console.log(
          'RUNT-01 PATCH-30 loaded: source controls hard fixed, remove tracks, logo home'
        );
      }, 300);
    }
    boot();
  })();
}

function installRuntAscendingTempoMode() {
  (function () {
    'use strict';
    function boot() {
      if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
        setTimeout(boot, 200);
        return;
      }
      var state = window.laisoBuck.state;
      function renderApp() {
        try {
          if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
            window.laisoBuck.render();
          else if (typeof window.render === 'function') window.render();
        } catch (e) {
          console.warn('PATCH-32 render error', e);
        }
      }
      function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else console.log(msg);
      }
      function trackSignature(t) {
        return [
          String(t.title || '')
            .trim()
            .toLowerCase(),
          String(t.vinylArtist || '')
            .trim()
            .toLowerCase(),
          String(t.recordId || '')
            .trim()
            .toLowerCase(),
          String(t.position || t.displayPosition || '')
            .trim()
            .toLowerCase(),
        ].join('|');
      }
      function sameTrack(a, b) {
        if (!a || !b) return false;
        if (a.id && b.id && String(a.id) === String(b.id)) return true;
        return trackSignature(a) === trackSignature(b);
      }
      function canFollowTempo(prev, cand, tempoRange) {
        if (!cand || !cand.bpm) return false;
        if (!prev) return true;
        if (!prev.bpm) return false;
        /* No same exact track. */ if (sameTrack(prev, cand)) return false;
        /* No same vinyl directly after previous. */ if (
          prev.recordId &&
          cand.recordId &&
          String(prev.recordId) === String(cand.recordId)
        )
          return false;
        var diff = cand.bpm - prev.bpm;
        /* Главная логика режима "По темпу": только вверх или ровно. */ if (diff < 0) return false;
        /* Шаг вверх не больше выбранного диапазона. */ if (diff > tempoRange) return false;
        return true;
      }
      function generateAscendingTempoSet(allTracks, opts, length) {
        opts = opts || {};
        var tempoRange = opts.tempoRange || 4;
        length = length || 16;
        var tracks = (allTracks || [])
          .filter(function (t) {
            return t && t.bpm;
          })
          .slice()
          .sort(function (a, b) {
            if (a.bpm !== b.bpm) return a.bpm - b.bpm;
            return (
              String(a.camelot || '').localeCompare(String(b.camelot || '')) ||
              String(a.title || '').localeCompare(String(b.title || ''))
            );
          });
        if (tracks.length < 2) return tracks;
        var best = [];
        var t0 = Date.now();
        var TIMEOUT = 1800;
        function score(prev, cand) {
          if (!prev) return 0;
          var s = 0;
          var diff = cand.bpm - prev.bpm;
          /* Prefer smooth upward movement: +0 to +2 is best. */ if (diff === 0) s += 6;
          else if (diff === 1) s += 8;
          else if (diff === 2) s += 7;
          else s += Math.max(0, 6 - diff);
          /* Camelot compatibility as bonus, not hard rule. */ try {
            if (prev.camelot && cand.camelot && typeof camelotNeighbors === 'function') {
              if (prev.camelot === cand.camelot) s += 4;
              else if (camelotNeighbors(prev.camelot).indexOf(cand.camelot) >= 0) s += 2;
            }
          } catch (_) {}
          /* Prefer not using same artist too often, lightly. */ if (
            prev.vinylArtist &&
            cand.vinylArtist &&
            prev.vinylArtist === cand.vinylArtist
          )
            s -= 0.5;
          return s;
        }
        function backtrack(cur, usedIds, usedSig) {
          if (Date.now() - t0 > TIMEOUT) return;
          if (cur.length > best.length) best = cur.slice();
          if (cur.length >= length) return;
          var prev = cur[cur.length - 1];
          var cands = tracks.filter(function (t) {
            var id = String(t.id || '');
            var sig = trackSignature(t);
            if (id && usedIds[id]) return false;
            if (usedSig[sig]) return false;
            return canFollowTempo(prev, t, tempoRange);
          });
          cands.sort(function (a, b) {
            var sb = score(prev, b);
            var sa = score(prev, a);
            if (sb !== sa) return sb - sa;
            return a.bpm - b.bpm;
          });
          for (var i = 0; i < Math.min(cands.length, 10); i++) {
            var c = cands[i];
            var id = String(c.id || '');
            var sig = trackSignature(c);
            if (id) usedIds[id] = true;
            usedSig[sig] = true;
            cur.push(c);
            backtrack(cur, usedIds, usedSig);
            if (best.length >= length) return;
            cur.pop();
            if (id) usedIds[id] = false;
            usedSig[sig] = false;
          }
        }
        /* Try starts from lower BPM first, but not only absolute minimum. */ var starts =
          tracks.slice(0, Math.min(tracks.length, 30));
        for (var i = 0; i < starts.length; i++) {
          if (Date.now() - t0 > TIMEOUT) break;
          if (best.length >= length) break;
          var st = starts[i];
          var usedIds = {};
          var usedSig = {};
          if (st.id) usedIds[String(st.id)] = true;
          usedSig[trackSignature(st)] = true;
          backtrack([st], usedIds, usedSig);
        }
        return best;
      }
      function currentPoolTracks() {
        /* Берём текущий пул так же, как базовое приложение: через getAllSessionTracks, */ /* потому что в него уже могли попасть выбранные пластинки из последних патчей. */ try {
          if (typeof getAllSessionTracks === 'function') return getAllSessionTracks();
        } catch (_) {}
        return [];
      }
      function generateTempoAscendingNow() {
        var tracks = currentPoolTracks().filter(function (t) {
          return t && t.bpm;
        });
        if (tracks.length < 2) {
          toast('Мало треков с BPM для режима по темпу');
          return;
        }
        var desired =
          typeof window.vertaxSetDesiredTrackCount === 'function'
            ? window.vertaxSetDesiredTrackCount(tracks)
            : 16;
        var result = generateAscendingTempoSet(
          tracks,
          (state.ui && state.ui.setOptions) || { tempoRange: 4 },
          desired
        );
        if (!result || result.length < 2) {
          toast('Не удалось собрать по возрастанию темпа');
          return;
        }
        state.ui.generatedSet = result;
        toast('Собрано по возрастанию BPM: ' + result.length + ' трек.');
        renderApp();
      }
      /* Patch base algorithm for direct calls. */ try {
        if (typeof generateSetAlgo === 'function' && !window.__runt32OriginalGenerateSetAlgo) {
          window.__runt32OriginalGenerateSetAlgo = generateSetAlgo;
          generateSetAlgo = function (allTracks, mode, opts, length) {
            if (mode === 'tempo-safe') {
              return generateAscendingTempoSet(allTracks, opts, length || 16);
            }
            return window.__runt32OriginalGenerateSetAlgo(allTracks, mode, opts, length);
          };
        }
      } catch (e) {
        console.warn('PATCH-32 could not patch generateSetAlgo', e);
      }
      /* Patch handler if available. */ try {
        if (
          typeof handlers !== 'undefined' &&
          handlers &&
          !window.__runt32OriginalSetGenerateHandler
        ) {
          window.__runt32OriginalSetGenerateHandler = handlers['set-generate'];
          handlers['set-generate'] = function () {
            if (state.ui && state.ui.setMode === 'tempo-safe') {
              generateTempoAscendingNow();
              return;
            }
            if (typeof window.__runt32OriginalSetGenerateHandler === 'function') {
              return window.__runt32OriginalSetGenerateHandler.apply(this, arguments);
            }
          };
        }
      } catch (e) {
        console.warn('PATCH-32 could not patch set-generate handler', e);
      }
      /* Capture fallback for the orange generate/rebuild button. */ document.addEventListener(
        'click',
        function (e) {
          var app = document.getElementById('laiso-app');
          if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
          if (!state.ui || state.ui.setMode !== 'tempo-safe' || state.view !== 'set') return;
          var btn = e.target.closest('button, .laiso-btn, [data-action]');
          if (!btn) return;
          var text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          var action = btn.dataset && btn.dataset.action;
          var isGenerate =
            action === 'set-generate' ||
            text.indexOf('сгенерировать') >= 0 ||
            text.indexOf('пересобрать') >= 0;
          if (!isGenerate) return;
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          generateTempoAscendingNow();
        },
        true
      );
      /* Add small hint text for tempo mode. */ function patchTempoHint() {
        var root = document.getElementById('laiso-root');
        if (!root || state.view !== 'set' || !state.ui || state.ui.setMode !== 'tempo-safe') return;
        var existing = root.querySelector('.runt32-tempo-hint');
        if (existing) return;
        var panels = root.querySelectorAll('.laiso-panel');
        var target = null;
        panels.forEach(function (p) {
          var txt = (p.textContent || '').toLowerCase();
          if (txt.indexOf('диапазон темпа') >= 0) target = p;
        });
        if (target) {
          var div = document.createElement('div');
          div.className = 'runt32-tempo-hint';
          div.style.cssText =
            'margin-top:10px;font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-tertiary,#8A847B);';
          div.textContent = 'режим по темпу: сет строится от меньшего BPM к большему';
          target.appendChild(div);
        }
      }
      function registerTempoHint() {
        if (
          typeof window.vertaxRegisterAfterRender === 'function' &&
          !window.__runt32AfterRenderRegistered
        ) {
          window.vertaxRegisterAfterRender(function () {
            setTimeout(patchTempoHint, 80);
          });
          window.__runt32AfterRenderRegistered = true;
        }
      }
      registerTempoHint();
      setTimeout(registerTempoHint, 300);
      setTimeout(function () {
        patchTempoHint();
        console.log('RUNT-01 PATCH-32 loaded: tempo-safe mode is now ascending BPM');
      }, 300);
    }
    boot();
  })();
}

function installVertaxBackupFeature() {
  if (
    !window.laisoBuck ||
    !window.laisoBuck.state ||
    !window.laisoBuck.render ||
    typeof on !== 'function'
  ) {
    console.warn('VERTAX backup feature skipped: app is not ready');
    return;
  }
  if (window.__vertaxBackupPatchInstalled) return;
  window.__vertaxBackupPatchInstalled = true;

  window.STORE_VINYLS = window.STORE_VINYLS || 'vinyls';
  window.STORE_SETS = window.STORE_SETS || 'sets';
  window.STORE_SETTINGS = window.STORE_SETTINGS || 'settings';
  if (typeof window.dbDel !== 'function' && typeof dbDelete === 'function') window.dbDel = dbDelete;
  if (typeof window.dbClear !== 'function') {
    window.dbClear = function (storeName) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = dbInstance.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            reject(tx.error);
          };
        } catch (e) {
          reject(e);
        }
      });
    };
  }

  var state = window.laisoBuck.state;

  function safeEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function renderApp() {
    try {
      if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
        window.laisoBuck.render();
      else if (typeof render === 'function') render();
    } catch (e) {
      console.warn('VERTAX backup render error', e);
    }
  }
  function toast(msg, ms) {
    if (typeof showToast === 'function') showToast(msg, ms);
    else console.log(msg);
  }
  function storeVinyls() {
    return window.STORE_VINYLS || 'vinyls';
  }
  function storeSets() {
    return window.STORE_SETS || 'sets';
  }
  function storeSettings() {
    return window.STORE_SETTINGS || 'settings';
  }
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
  function formatDateTime(ts) {
    if (!ts) return '';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    return (
      pad(d.getDate()) +
      '.' +
      pad(d.getMonth() + 1) +
      '.' +
      d.getFullYear() +
      ', ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }
  function formatFileStamp(ts) {
    var d = new Date(ts || Date.now());
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      '-' +
      pad(d.getHours()) +
      '-' +
      pad(d.getMinutes())
    );
  }
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }
  function settingValue(settings, key) {
    var rec = (settings || []).find(function (x) {
      return x && x.key === key;
    });
    return rec ? rec.value : null;
  }
  async function loadSettings() {
    var settings = [];
    try {
      settings = await dbGetAll(storeSettings());
    } catch (_) {}
    state.ui = state.ui || {};
    state.ui.backupSettings = settings || [];
    return state.ui.backupSettings;
  }
  async function putSetting(key, value) {
    try {
      await dbPut(storeSettings(), { key: key, value: value });
    } catch (e) {
      console.warn('backup setting error', e);
    }
    state.ui = state.ui || {};
    var arr = state.ui.backupSettings || [];
    var rec = arr.find(function (x) {
      return x && x.key === key;
    });
    if (rec) rec.value = value;
    else arr.push({ key: key, value: value });
    state.ui.backupSettings = arr;
  }
  async function openBackup() {
    state.ui = state.ui || {};
    state.ui.backupRestoreData = null;
    state.ui.backupRestoreError = null;
    await loadSettings();
    state.view = 'backup';
    state.modal = null;
    renderApp();
    setTimeout(function () {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (_) {}
    }, 60);
  }
  function uniqueById(list) {
    var out = [],
      seen = {};
    (list || []).forEach(function (item) {
      if (!item || !item.id || seen[item.id]) return;
      seen[item.id] = true;
      out.push(item);
    });
    return out;
  }
  function currentVinylCount() {
    return uniqueById(state.collection || []).length;
  }
  function backupStatusHtml() {
    var settings = (state.ui && state.ui.backupSettings) || [];
    var lastAt = settingValue(settings, 'lastBackupAt');
    var lastCount = Number(settingValue(settings, 'lastBackupVinylCount') || 0);
    var currentCount = currentVinylCount();
    var added = lastAt ? Math.max(0, currentCount - lastCount) : 0;
    var status = lastAt
      ? '<strong>Последняя копия: ' +
        safeEsc(formatDateTime(lastAt)) +
        '</strong><span>Пластинок в той копии: ' +
        safeEsc(lastCount) +
        '</span>'
      : '<strong>Резервная копия: не создавалась</strong>';
    var warning =
      added > 0
        ? '<div class="vertax-backup-warn">С последней копии добавлено: ' +
          safeEsc(added) +
          ' пластинок.<br>Рекомендуем сохранить новую копию.</div>'
        : '';
    return '<div class="vertax-backup-status">' + status + '</div>' + warning;
  }
  function shouldShowOnboarding() {
    var settings = (state.ui && state.ui.backupSettings) || [];
    return (
      !settingValue(settings, 'lastBackupAt') && !settingValue(settings, 'backupOnboardingSeen')
    );
  }
  function onboardingHtml() {
    if (!shouldShowOnboarding()) return '';
    return (
      '<div class="vertax-backup-onboarding">' +
      '<div class="vertax-backup-lock">🔒</div>' +
      '<h2>Ваши данные — только ваши</h2>' +
      '<p>VERTAX не собирает и не хранит вашу коллекцию на серверах. Мы не знаем кто вы и что у вас в коллекции — и не хотим знать.</p>' +
      '<p>Обратная сторона: если браузер очистит данные или вы смените телефон — коллекция пропадёт.</p>' +
      '<p>Поэтому мы сделали резервную копию. Это файл который вы сохраняете сами — в Telegram себе, в заметки, в облако. Вы полностью контролируете где он хранится.</p>' +
      '<p><strong>Честно. Просто. Надёжно.</strong></p>' +
      '<button class="laiso-btn laiso-btn-block" data-action="backup-onboarding-done">Понятно, сохраню копию</button>' +
      '</div>'
    );
  }
  function restoreChoiceHtml() {
    var data = state.ui && state.ui.backupRestoreData;
    if (!data) return '';
    var date = data.createdAt ? formatDateTime(data.createdAt).split(',')[0] : 'неизвестной даты';
    var count = Array.isArray(data.vinyls) ? data.vinyls.length : 0;
    return (
      '<div class="vertax-backup-restore">' +
      '<strong>Найдена копия от ' +
      safeEsc(date) +
      '</strong>' +
      '<span>Пластинок в файле: ' +
      safeEsc(count) +
      '</span>' +
      '<p>Как восстановить коллекцию?</p>' +
      '<button class="laiso-btn laiso-btn-block" data-action="backup-restore-replace">Заменить текущую коллекцию</button>' +
      '<button class="laiso-btn laiso-btn-secondary laiso-btn-block" data-action="backup-restore-merge">Объединить с текущей</button>' +
      '<button class="laiso-btn laiso-btn-secondary laiso-btn-block" data-action="backup-restore-cancel">Отмена</button>' +
      '</div>'
    );
  }
  function viewBackup() {
    return (
      renderHeader('Резервная копия') +
      '<div class="vertax-backup-page">' +
      '<div class="laiso-panel vertax-backup-intro">' +
      '<p>Ваши пластинки хранятся в этом браузере. Если сменить телефон, очистить браузер или переустановить приложение — данные пропадут.</p>' +
      '<p>Резервная копия — это файл с вашей коллекцией. Сохраните его в Telegram себе, в заметки, в iCloud или Google Drive.</p>' +
      '<p>Каждая копия содержит всю коллекцию целиком. Делайте новую копию после каждого пополнения.</p>' +
      '</div>' +
      onboardingHtml() +
      backupStatusHtml() +
      restoreChoiceHtml() +
      '<div class="laiso-stack" style="margin-top:14px;">' +
      '<button class="laiso-btn laiso-btn-block" data-action="backup-download">Сохранить копию коллекции</button>' +
      '<button class="laiso-btn laiso-btn-secondary laiso-btn-block" data-action="backup-restore-pick">Восстановить из файла</button>' +
      '</div>' +
      '</div>' +
      renderFooter()
    );
  }
  async function buildBackupBundle() {
    var vinyls = [];
    var sets = [];
    var settings = [];
    try {
      vinyls = await dbGetAll(storeVinyls());
      sets = await dbGetAll(storeSets());
      settings = await dbGetAll(storeSettings());
    } catch (e) {
      toast('Не удалось создать резервную копию');
      return null;
    }
    var now = Date.now();
    var data = {
      app: 'VERTAX-01 / RUNT-01',
      backupVersion: 1,
      createdAt: now,
      vinylCount: (vinyls || []).length,
      vinyls: vinyls || [],
      sets: sets || [],
      settings: settings || [],
    };
    var filename = 'vertax-backup-' + formatFileStamp(now) + '.json';
    var text = JSON.stringify(data, null, 2);
    var blob = new Blob([text], { type: 'application/octet-stream' });
    var file = null;
    try {
      file = new File([text], filename, { type: 'application/json' });
    } catch (_) {}
    return { data: data, filename: filename, blob: blob, file: file };
  }
  async function saveBackupMeta(bundle) {
    if (!bundle || !bundle.data) return;
    await putSetting('lastBackupAt', bundle.data.createdAt);
    await putSetting('lastBackupVinylCount', bundle.data.vinylCount);
    state.ui.backupRestoreData = null;
    renderApp();
  }
  function canShareFile(file) {
    try {
      return !!(
        file &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      );
    } catch (_) {
      return false;
    }
  }
  function triggerFileDownload(bundle) {
    var url = URL.createObjectURL(bundle.blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = bundle.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1200);
  }
  async function downloadBackup() {
    var bundle = await buildBackupBundle();
    if (!bundle) return;
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') && canShareFile(bundle.file)) {
      try {
        await navigator.share({
          files: [bundle.file],
          title: 'Резервная копия VERTAX',
          text: 'Сохраните файл в удобное место.',
        });
        await saveBackupMeta(bundle);
        toast('Резервная копия создана');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    triggerFileDownload(bundle);
    await saveBackupMeta(bundle);
    toast('Резервная копия создана');
  }
  function validateBackup(data) {
    if (!data || data.backupVersion == null) return false;
    if (!Array.isArray(data.vinyls)) return false;
    var appName = String(data.app || '');
    return appName.indexOf('VERTAX') >= 0 || appName.indexOf('RUNT') >= 0;
  }
  function pickRestoreFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var data = JSON.parse(String(fr.result || ''));
          if (!validateBackup(data)) {
            toast('Это не похоже на резервную копию VERTAX');
            return;
          }
          state.ui.backupRestoreData = data;
          renderApp();
        } catch (_) {
          toast('Это не похоже на резервную копию VERTAX');
        }
      };
      fr.readAsText(file);
    };
    input.click();
  }
  async function replaceFromBackup() {
    var data = state.ui && state.ui.backupRestoreData;
    if (!validateBackup(data)) {
      toast('Это не похоже на резервную копию VERTAX');
      return;
    }
    try {
      await dbClear(storeVinyls());
      await dbClear(storeSets());
      for (var i = 0; i < data.vinyls.length; i++) {
        if (data.vinyls[i] && data.vinyls[i].id) await dbPut(storeVinyls(), data.vinyls[i]);
      }
      var backupSets = Array.isArray(data.sets) ? data.sets : [];
      for (var j = 0; j < backupSets.length; j++) {
        if (backupSets[j] && backupSets[j].id) await dbPut(storeSets(), backupSets[j]);
      }
      state.collection = data.vinyls.slice();
      state.sets = backupSets.slice();
      state.vinyls = [];
      state.ui.backupRestoreData = null;
      await putSetting('lastBackupAt', data.createdAt || Date.now());
      await putSetting('lastBackupVinylCount', data.vinyls.length);
      toast('Коллекция восстановлена из резервной копии');
      state.view = 'collection';
      renderApp();
    } catch (e) {
      console.warn('backup replace error', e);
      toast('Не удалось восстановить коллекцию');
    }
  }
  function isDuplicateVinyl(current, candidate) {
    for (var i = 0; i < current.length; i++) {
      var v = current[i];
      if (
        v &&
        candidate &&
        v.discogsId &&
        candidate.discogsId &&
        String(v.discogsId) === String(candidate.discogsId)
      )
        return true;
    }
    for (var j = 0; j < current.length; j++) {
      var a = current[j];
      if (
        a &&
        candidate &&
        norm(a.artist) === norm(candidate.artist) &&
        norm(a.title) === norm(candidate.title) &&
        String(a.year || '') === String(candidate.year || '')
      )
        return true;
    }
    for (var k = 0; k < current.length; k++) {
      var b = current[k];
      if (b && candidate && b.id && candidate.id && String(b.id) === String(candidate.id))
        return true;
    }
    return false;
  }
  async function mergeFromBackup() {
    var data = state.ui && state.ui.backupRestoreData;
    if (!validateBackup(data)) {
      toast('Это не похоже на резервную копию VERTAX');
      return;
    }
    try {
      var current = await dbGetAll(storeVinyls());
      var currentSets = await dbGetAll(storeSets());
      var added = 0;
      var skipped = 0;
      for (var i = 0; i < data.vinyls.length; i++) {
        var v = data.vinyls[i];
        if (!v || !v.id) continue;
        if (isDuplicateVinyl(current, v)) {
          skipped++;
        } else {
          current.push(v);
          await dbPut(storeVinyls(), v);
          added++;
        }
      }
      var setMap = {};
      (currentSets || []).forEach(function (s) {
        if (s && s.id) setMap[String(s.id)] = true;
      });
      var incomingSets = Array.isArray(data.sets) ? data.sets : [];
      for (var j = 0; j < incomingSets.length; j++) {
        var set = incomingSets[j];
        if (!set || !set.id || setMap[String(set.id)]) continue;
        setMap[String(set.id)] = true;
        currentSets.push(set);
        await dbPut(storeSets(), set);
      }
      state.collection = await dbGetAll(storeVinyls());
      state.sets = await dbGetAll(storeSets());
      state.vinyls = [];
      state.ui.backupRestoreData = null;
      toast('Добавлено: ' + added + ' пластинок. Пропущено дублей: ' + skipped + '.');
      state.view = 'collection';
      renderApp();
    } catch (e) {
      console.warn('backup merge error', e);
      toast('Не удалось восстановить коллекцию');
    }
  }
  function cancelRestore() {
    state.ui.backupRestoreData = null;
    renderApp();
  }
  function showBackupHint() {
    if (!state || state.view === 'backup') return;
    var settings = (state.ui && state.ui.backupSettings) || [];
    var lastAt = settingValue(settings, 'lastBackupAt');
    var lastCount = Number(settingValue(settings, 'lastBackupVinylCount') || 0);
    var current = currentVinylCount();
    var missing = lastAt ? Math.max(0, current - lastCount) : current;
    if (current <= 0 || (lastAt && missing <= 0)) return;
    var msg = !lastAt
      ? 'Сохраните резервную копию'
      : missing === 1
        ? '1 пластинка без резервной копии'
        : missing + ' пластинок без резервной копии';
    var old = document.querySelector('.vertax-backup-toast');
    if (old) old.remove();
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'laiso-toast vertax-backup-toast';
    el.setAttribute('data-action', 'goto-backup');
    el.textContent = msg;
    (document.getElementById('laiso-app') || document.body).appendChild(el);
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 5200);
  }
  function scheduleBackupHint() {
    clearTimeout(window.__vertaxBackupHintTimer);
    window.__vertaxBackupHintTimer = setTimeout(function () {
      loadSettings().then(showBackupHint);
    }, 3000);
  }

  state.ui = state.ui || {};
  state.ui.__backupKnownCollectionCount = currentVinylCount();
  if (typeof persistVinyl === 'function' && !window.__vertaxBackupPersistWrapped) {
    var originalPersistVinyl = persistVinyl;
    persistVinyl = window.persistVinyl = async function (v) {
      var before = state.ui.__backupKnownCollectionCount || 0;
      var result = await originalPersistVinyl.apply(this, arguments);
      var after = currentVinylCount();
      if (after > before && state.view !== 'backup') scheduleBackupHint();
      state.ui.__backupKnownCollectionCount = after;
      return result;
    };
    window.__vertaxBackupPersistWrapped = true;
  }

  window.viewBackup = viewBackup;

  var oldBack = handlers && handlers.back;
  on('back', function () {
    if (state.view === 'backup') {
      state.view = 'home';
      renderApp();
      return;
    }
    if (typeof oldBack === 'function') return oldBack.apply(this, arguments);
  });
  on('goto-backup', function () {
    openBackup();
  });
  on('backup-download', function () {
    downloadBackup();
  });
  on('backup-restore-pick', function () {
    pickRestoreFile();
  });
  on('backup-restore-replace', function () {
    replaceFromBackup();
  });
  on('backup-restore-merge', function () {
    mergeFromBackup();
  });
  on('backup-restore-cancel', function () {
    cancelRestore();
  });
  on('backup-onboarding-done', async function () {
    await putSetting('backupOnboardingSeen', true);
    await downloadBackup();
  });

  document.addEventListener(
    'click',
    function (e) {
      var t =
        e.target &&
        e.target.closest &&
        e.target.closest('.vertax-backup-toast[data-action="goto-backup"]');
      if (!t) return;
      e.preventDefault();
      if (t.parentNode) t.parentNode.removeChild(t);
      openBackup();
    },
    true
  );

  var style = document.createElement('style');
  style.textContent = [
    '#laiso-app .vertax-backup-page p{font-size:14px;line-height:1.55;color:var(--text-secondary,#666158);margin:0 0 10px;}',
    '#laiso-app .vertax-backup-status{display:flex;flex-direction:column;gap:6px;background:#101010;color:var(--accent-lime,#C4F542);border-radius:16px;padding:15px 16px;font-family:var(--font-mono,monospace);box-shadow:inset 0 0 20px rgba(0,0,0,.85);}',
    '#laiso-app .vertax-backup-status strong{font-size:13px;letter-spacing:.04em;}',
    '#laiso-app .vertax-backup-status span{font-size:11px;color:rgba(196,245,66,.72);}',
    '#laiso-app .vertax-backup-warn{margin-top:10px;padding:14px 16px;border-radius:16px;background:#FFF0E8;color:var(--warning,#E66A2C);border:1px solid rgba(230,106,44,.35);font-weight:650;line-height:1.45;}',
    '#laiso-app .vertax-backup-onboarding,.vertax-backup-restore{margin:14px 0;padding:18px;border:1px solid #111;border-radius:20px;background:#FFFDF7;box-shadow:0 14px 40px rgba(20,16,10,.08);}',
    '#laiso-app .vertax-backup-onboarding{background:linear-gradient(180deg,#FBFFF0 0%,#FFFDF7 100%);}',
    '#laiso-app .vertax-backup-lock{font-size:28px;margin-bottom:8px;}',
    '#laiso-app .vertax-backup-onboarding h2{font-size:22px;line-height:1.08;margin:0 0 12px;letter-spacing:-.02em;}',
    '#laiso-app .vertax-backup-onboarding p{font-size:15px;color:#111;}',
    '#laiso-app .vertax-backup-restore{display:flex;flex-direction:column;gap:10px;}',
    '#laiso-app .vertax-backup-restore strong{font-size:17px;}',
    '#laiso-app .vertax-backup-restore span{font-family:var(--font-mono,monospace);font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-tertiary,#8A847B);}',
    '.vertax-backup-toast{border:0;cursor:pointer;}',
  ].join('\n');
  document.head.appendChild(style);

  loadSettings().then(function () {
    renderApp();
  });
  console.log('VERTAX backup patch loaded');
}

(function installSmartSuggestionsForSet() {
  if (window.__vertaxSmartSuggestionsInstalled) return;
  function boot() {
    if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
      setTimeout(boot, 200);
      return;
    }
    if (typeof window.viewSet !== 'function') {
      setTimeout(boot, 200);
      return;
    }
    if (window.__vertaxSmartSuggestionsInstalled) return;
    window.__vertaxSmartSuggestionsInstalled = true;
    var prevViewSet = window.viewSet;
    function getSmartSuggestPool() {
      if (typeof runtGetTracksByScope === 'function')
        return runtGetTracksByScope('collection', { includeAll: true });
      if (typeof getAllSessionTracks === 'function')
        return getAllSessionTracks({ includeAll: true });
      return [];
    }
    function suggestionsHtml() {
      try {
        var s = window.laisoBuck.state;
        var set = (s.ui && s.ui.generatedSet) || [];
        if (set.length < 1 || set.length > 3) return '';
        var last = set[set.length - 1];
        if (!last) return '';
        var pool = getSmartSuggestPool();
        if (!pool.length) return '';
        var usedIds = {},
          usedKeys = {};
        set.forEach(function (t) {
          if (t && t.id) usedIds[t.id] = true;
          if (t && typeof runtTrackPhysicalKey === 'function') {
            var k = runtTrackPhysicalKey(t);
            if (k) usedKeys[k] = true;
          }
        });
        var mode = s.ui.setMode || 'best-flow';
        var opts = s.ui.setOptions || {};
        function notUsed(c) {
          if (!c) return false;
          if (usedIds[c.id]) return false;
          if (typeof runtTrackPhysicalKey === 'function') {
            var ck = runtTrackPhysicalKey(c);
            if (usedKeys[ck]) return false;
          }
          if (c.recordKey && last.recordKey && c.recordKey === last.recordKey) return false;
          return true;
        }
        var cands = pool.filter(function (c) {
          return (
            notUsed(c) &&
            (typeof isValidNext === 'function' ? isValidNext(last, c, mode, opts) : true)
          );
        });
        if (cands.length < 2) {
          cands = pool.filter(function (c) {
            if (!notUsed(c)) return false;
            if (last.bpm && c.bpm && Math.abs(last.bpm - c.bpm) > 8) return false;
            return true;
          });
        }
        if (!cands.length) return '';
        if (typeof scoreCandidate === 'function')
          cands.sort(function (a, b) {
            return scoreCandidate(last, b, mode, opts) - scoreCandidate(last, a, mode, opts);
          });
        var rows = cands
          .slice(0, 3)
          .map(function (c) {
            var bpm = c.bpm ? c.bpm + ' BPM' : '— BPM';
            var cam = c.camelot ? c.camelot : '—';
            var diff = last.bpm && c.bpm ? c.bpm - last.bpm : null;
            var diffStr = diff !== null ? (diff >= 0 ? '+' : '') + diff : '';
            return (
              '<div class="vertax-suggest-row" data-action="suggest-pick" data-track-id="' +
              esc(c.id) +
              '">' +
              '<div class="vertax-suggest-meters"><span class="vertax-suggest-bpm">' +
              esc(bpm) +
              (diffStr ? ' <em>' + esc(diffStr) + '</em>' : '') +
              '</span><span class="vertax-suggest-cam">' +
              esc(cam) +
              '</span></div>' +
              '<div class="vertax-suggest-info"><div class="vertax-suggest-title">' +
              esc(c.title || '—') +
              '</div><div class="vertax-suggest-meta">' +
              esc(c.vinylArtist || '') +
              ' — ' +
              esc(c.vinylTitle || '') +
              (c.displayPosition ? ' · ' + esc(c.displayPosition) : '') +
              '</div></div>' +
              '<div class="vertax-suggest-add">+</div>' +
              '</div>'
            );
          })
          .join('');
        return (
          '<div class="laiso-mod-label" style="margin-top:18px;">возможные следующие</div>' +
          '<div class="vertax-suggest-list">' +
          rows +
          '</div>'
        );
      } catch (e) {
        console.warn('smart-suggest error', e);
        return '';
      }
    }
    window.viewSet = function vertaxViewSetWithSuggestions() {
      var html = prevViewSet.apply(this, arguments);
      var add = suggestionsHtml();
      if (!add) return html;
      var marker = '<div class="laiso-set-tools"';
      var idx = html.indexOf(marker);
      if (idx >= 0) return html.slice(0, idx) + add + html.slice(idx);
      return html + add;
    };
    if (typeof on === 'function') {
      on('suggest-pick', function (e, el) {
        var tid = el && el.dataset && el.dataset.trackId;
        if (!tid) return;
        var pool = getSmartSuggestPool();
        var cand = pool.find(function (t) {
          return String(t.id) === String(tid);
        });
        if (!cand) return;
        var s = window.laisoBuck.state;
        s.ui.generatedSet = (s.ui.generatedSet || []).slice();
        s.ui.generatedSet.push(cand);
        try {
          if (typeof haptic === 'function') haptic('light');
        } catch (_) {}
        if (typeof showToast === 'function') showToast('Трек добавлен в сет');
        window.laisoBuck.render();
      });
    }
  }
  boot();
})();

/* VERTAX set-builder UX: target length, genre filter, one-vinyl guard */
(function installVertaxSetBuilderUxPatch() {
  if (window.__vertaxSetBuilderUxPatchInstalled) return;
  window.__vertaxSetBuilderUxPatchInstalled = true;

  function boot() {
    if (!window.laisoBuck || !window.laisoBuck.state || !window.laisoBuck.render) {
      setTimeout(boot, 200);
      return;
    }
    if (!window.__runtSetDndPatchInstalled) {
      setTimeout(boot, 200);
      return;
    }
    var state = window.laisoBuck.state;

    function esc(s) {
      if (typeof window.esc === 'function') return window.esc(s);
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function toast(msg) {
      if (typeof showToast === 'function') showToast(msg);
      else console.log(msg);
    }

    function renderApp() {
      try {
        if (window.laisoBuck && typeof window.laisoBuck.render === 'function')
          window.laisoBuck.render();
        else if (typeof render === 'function') render();
      } catch (e) {
        console.warn('set builder UX render error', e);
      }
    }

    function setOptions() {
      state.ui = state.ui || {};
      state.ui.setOptions = state.ui.setOptions || {};
      if (!state.ui.setOptions.targetMinutes) state.ui.setOptions.targetMinutes = 60;
      return state.ui.setOptions;
    }

    function clampMinutes(n) {
      n = parseInt(n, 10);
      if ([30, 60, 90, 120].indexOf(n) < 0) n = 60;
      return n;
    }

    function targetMinutes() {
      return clampMinutes(setOptions().targetMinutes || 60);
    }

    function parseDurationSeconds(value) {
      if (value == null || value === '') return 0;
      if (typeof value === 'number') return isFinite(value) && value > 0 ? value : 0;
      var s = String(value).trim();
      if (!s) return 0;
      if (/^\d+(\.\d+)?$/.test(s)) {
        var numeric = parseFloat(s);
        return isFinite(numeric) && numeric > 0 ? numeric : 0;
      }
      var parts = s.split(':').map(function (part) {
        return parseInt(part, 10);
      });
      if (
        parts.some(function (part) {
          return !isFinite(part);
        })
      )
        return 0;
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return 0;
    }

    function trackPlayableSeconds(t) {
      var seconds = parseDurationSeconds(t && t.duration);
      return seconds > 0 ? seconds * 0.5 : 0;
    }

    function desiredTrackCount(allTracks) {
      var tracks = allTracks || [];
      var playable = tracks.map(trackPlayableSeconds).filter(function (n) {
        return n > 0;
      });
      var max = tracks.length || 64;
      if (!playable.length) return Math.max(2, Math.min(16, max));
      var avg =
        playable.reduce(function (sum, n) {
          return sum + n;
        }, 0) / playable.length;
      var count = Math.ceil((targetMinutes() * 60) / avg);
      return Math.max(2, Math.min(max, count));
    }
    window.vertaxSetDesiredTrackCount = desiredTrackCount;

    function norm(s) {
      return String(s || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function normKey(s) {
      return norm(s).toLowerCase();
    }

    function getAllVinyls() {
      var out = [];
      var seen = {};
      (state.vinyls || []).concat(state.collection || []).forEach(function (v) {
        if (!v || !v.id || seen[v.id]) return;
        seen[v.id] = true;
        out.push(v);
      });
      return out;
    }

    function genreFromVinyl(v) {
      var values = [];
      ['genre', 'style'].forEach(function (k) {
        var val = v && v[k];
        if (Array.isArray(val)) values = values.concat(val);
        else if (val) values.push(val);
      });
      return values.map(norm).filter(Boolean);
    }

    function genresForTrack(t) {
      var values = [];
      ['genre', 'subGenre', 'sub_genre', 'style'].forEach(function (k) {
        var val = t && t[k];
        if (Array.isArray(val)) values = values.concat(val);
        else if (val) values.push(val);
      });
      if (t && t.recordId) {
        var v = getAllVinyls().find(function (x) {
          return String(x.id) === String(t.recordId);
        });
        values = values.concat(genreFromVinyl(v));
      }
      return values.map(norm).filter(Boolean);
    }

    function trackMatchesGenre(t, selected) {
      if (!selected) return true;
      selected = normKey(selected);
      return genresForTrack(t).some(function (g) {
        return normKey(g) === selected;
      });
    }

    function genreOptions() {
      var map = {};
      function add(v) {
        var label = norm(v);
        if (!label) return;
        map[normKey(label)] = label;
      }
      getAllVinyls().forEach(function (v) {
        genreFromVinyl(v).forEach(add);
        (v.tracklist || []).forEach(function (t) {
          genresForTrack(Object.assign({ recordId: v.id }, t)).forEach(add);
        });
      });
      return Object.keys(map)
        .sort()
        .map(function (k) {
          return map[k];
        });
    }

    function enrichTracksWithGenre(tracks) {
      return (tracks || []).map(function (t) {
        if (!t || t.genre || t.subGenre || t.sub_genre) return t;
        var copy = Object.assign({}, t);
        if (t.recordId) {
          var v = getAllVinyls().find(function (x) {
            return String(x.id) === String(t.recordId);
          });
          if (v) {
            if (v.genre) copy.genre = Array.isArray(v.genre) ? v.genre[0] : v.genre;
            if (v.style) copy.subGenre = Array.isArray(v.style) ? v.style[0] : v.style;
          }
        }
        return copy;
      });
    }

    function installTrackScopeWrapper() {
      if (typeof window.runtGetTracksByScope === 'function' && !window.__vertaxSetUxScopeWrapped) {
        var oldScope = window.runtGetTracksByScope;
        window.runtGetTracksByScope = function (scope, opts) {
          var tracks = enrichTracksWithGenre(oldScope.call(this, scope, opts));
          var filter = setOptions().genreFilter || '';
          if (state.view === 'set' && scope === 'collection' && filter) {
            tracks = tracks.filter(function (t) {
              return trackMatchesGenre(t, filter);
            });
          }
          return tracks;
        };
        window.__vertaxSetUxScopeWrapped = true;
      }

      if (typeof getAllSessionTracks === 'function' && !window.__vertaxSetUxGetAllWrapped) {
        var oldGetAll = getAllSessionTracks;
        getAllSessionTracks = window.getAllSessionTracks = function (opts) {
          var tracks = enrichTracksWithGenre(oldGetAll.call(this, opts));
          var filter = setOptions().genreFilter || '';
          if (state.view === 'set' && (state.ui && state.ui.setScope) === 'collection' && filter) {
            tracks = tracks.filter(function (t) {
              return trackMatchesGenre(t, filter);
            });
          }
          return tracks;
        };
        window.__vertaxSetUxGetAllWrapped = true;
      }
    }

    function installGenerateWrapper() {
      if (typeof generateSetAlgo !== 'function' || window.__vertaxSetUxGenerateWrapped) return;
      var oldGenerate = generateSetAlgo;
      generateSetAlgo = window.generateSetAlgo = function (allTracks, mode, opts, length) {
        var desired = desiredTrackCount(allTracks || []);
        var requested = length || desired;
        if (!length || length === 8 || length === 16) requested = desired;
        requested = Math.min(
          Math.max(2, Math.min(64, parseInt(requested, 10) || desired)),
          (allTracks || []).length || requested
        );
        return oldGenerate.call(this, allTracks, mode, opts, requested);
      };
      window.__vertaxSetUxGenerateWrapped = true;
    }

    function uniqueRecordCount(tracks) {
      var seen = {};
      (tracks || []).forEach(function (t) {
        var key = t && (t.recordId || t.recordKey || t.vinylTitle || t.vinylArtist);
        if (key) seen[String(key)] = true;
      });
      return Object.keys(seen).length;
    }

    function currentPoolTracks() {
      try {
        if (typeof window.runtGetTracksByScope === 'function') {
          return window.runtGetTracksByScope((state.ui && state.ui.setScope) || 'session');
        }
        if (typeof getAllSessionTracks === 'function') return getAllSessionTracks();
      } catch (_) {}
      return [];
    }

    function selectedVinylCount() {
      var selected = (state.ui && state.ui.runt26SelectedVinyls) || {};
      return Object.keys(selected).filter(function (id) {
        return selected[id];
      }).length;
    }

    function oneVinylMessage() {
      toast('Из одной пластинки сет собрать нельзя. Добавьте ещё пластинку.');
    }

    function targetControlsHtml() {
      var current = targetMinutes();
      var options = [30, 60, 90, 120];
      return (
        '<div class="vertax-set-ux-panel vertax-set-target-panel">' +
        '<div class="vertax-set-ux-head"><span>цель сета</span><strong>' +
        esc(current) +
        ' мин</strong></div>' +
        '<div class="vertax-set-target-chips">' +
        options
          .map(function (n) {
            return (
              '<button type="button" class="' +
              (n === current ? 'is-active' : '') +
              '" data-action="set-target-pick" data-value="' +
              n +
              '">' +
              n +
              ' мин</button>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="vertax-set-duration-note">расчёт: примерно 50% длительности каждого трека</div>' +
        '</div>'
      );
    }

    function genreFilterHtml() {
      var genres = genreOptions();
      var current = setOptions().genreFilter || '';
      return (
        '<div class="vertax-set-ux-panel vertax-set-genre-panel">' +
        '<label for="vertax-set-genre">жанр</label>' +
        '<select id="vertax-set-genre" class="laiso-select" data-action="set-genre-filter"' +
        (!genres.length ? ' disabled' : '') +
        '>' +
        '<option value="">' +
        (genres.length ? 'Все жанры' : 'Жанры пока не загружены') +
        '</option>' +
        genres
          .map(function (g) {
            return (
              '<option value="' +
              esc(g) +
              '"' +
              (normKey(g) === normKey(current) ? ' selected' : '') +
              '>' +
              esc(g) +
              '</option>'
            );
          })
          .join('') +
        '</select>' +
        '</div>'
      );
    }

    function setExtrasHtml() {
      return (
        '<div class="vertax-set-ux-controls">' + targetControlsHtml() + genreFilterHtml() + '</div>'
      );
    }

    function stripOldTargetHint(html) {
      return html.replace(
        /<div([^>]*class="[^"]*laiso-meta[^"]*"[^>]*)>\s*ЦЕЛЬ:\s*СОБРАТЬ ДО 16 ТРЕКОВ\.[\s\S]*?<\/div>/i,
        ''
      );
    }

    function injectIntoSetHtml(html) {
      html = stripOldTargetHint(html);
      if (html.indexOf('vertax-set-ux-controls') < 0) {
        var extras = setExtrasHtml();
        var generateIdx = html.indexOf('data-action="set-generate"');
        if (generateIdx >= 0) {
          var buttonStart = html.lastIndexOf('<button', generateIdx);
          if (buttonStart >= 0)
            html = html.slice(0, buttonStart) + extras + html.slice(buttonStart);
          else html += extras;
        } else {
          html += extras;
        }
      }
      if (html.indexOf('data-action="set-add-vinyl"') < 0) {
        var addBtn =
          '<button class="laiso-btn laiso-btn-secondary laiso-btn-block vertax-set-add-vinyl" data-action="set-add-vinyl">+ Добавить ещё одну пластинку</button>';
        var sourceIdx = html.indexOf('data-action="runt26-open-source"');
        if (sourceIdx < 0) sourceIdx = html.indexOf('data-action="runt28-open-source"');
        if (sourceIdx >= 0) {
          var btnStart = html.lastIndexOf('<button', sourceIdx);
          var btnEnd = html.indexOf('</button>', sourceIdx);
          if (btnStart >= 0 && btnEnd >= 0)
            html = html.slice(0, btnEnd + 9) + addBtn + html.slice(btnEnd + 9);
          else html += addBtn;
        } else {
          html += addBtn;
        }
      }
      return html;
    }

    function removeCollectionDuplicateBlock() {
      var root = document.getElementById('laiso-root');
      if (!root || state.view !== 'collection') return;
      root.querySelectorAll('.runt18c-safe-build').forEach(function (el) {
        el.remove();
      });
      root.querySelectorAll('.laiso-panel, .laiso-card, section, div').forEach(function (el) {
        if (!el.parentNode) return;
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var isSafeBuild = el.classList && el.classList.contains('runt18c-safe-build');
        if (
          isSafeBuild ||
          (text.indexOf('собрать сет из коллекции') >= 0 && text.indexOf('+ собрать сет') < 0)
        ) {
          el.parentNode.removeChild(el);
        }
      });
    }

    function injectLiveSaveButton() {
      var root = document.getElementById('laiso-root');
      if (
        !root ||
        state.view !== 'live-set' ||
        root.querySelector('[data-action="set-save"].vertax-live-save')
      )
        return;
      var controls =
        root.querySelector('.runt19-live-controls') || root.querySelector('.laiso-stack') || root;
      controls.insertAdjacentHTML(
        'beforeend',
        '<button class="laiso-btn laiso-btn-secondary vertax-live-save" data-action="set-save">Сохранить сет</button>'
      );
    }

    function afterRender() {
      installTrackScopeWrapper();
      installGenerateWrapper();
      removeCollectionDuplicateBlock();
      injectLiveSaveButton();
    }

    if (typeof window.viewSet === 'function' && !window.__vertaxSetUxViewSetWrapped) {
      var oldViewSet = window.viewSet;
      window.viewSet = viewSet = function () {
        return injectIntoSetHtml(oldViewSet.apply(this, arguments));
      };
      window.__vertaxSetUxViewSetWrapped = true;
    }

    if (typeof handlers !== 'undefined' && handlers && !window.__vertaxSetUxHandlersWrapped) {
      handlers['set-generate'] = function (e, el) {
        var allTracks = currentPoolTracks();
        if (allTracks.length && uniqueRecordCount(allTracks) < 2) {
          state.ui = state.ui || {};
          state.ui.setLastWarning = 'one-vinyl';
          oneVinylMessage();
          renderApp();
          return;
        }
        var mode = (state.ui && state.ui.setMode) || 'best-flow';
        var opts = setOptions();
        var tracks = allTracks.filter(function (t) {
          if (mode === 'tempo-safe' || mode === 'best-flow') return !!t.bpm;
          if (mode === 'camelot-safe') return !!t.camelot;
          if (mode === 'camelot-filter') {
            var s = opts.camelotSet || {};
            return t.camelot && s[t.camelot];
          }
          return true;
        });
        if (allTracks.length === 0) {
          state.ui.setLastWarning = 'no-tracks';
          toast('Сначала добавь пластинки и треклисты');
          renderApp();
          return;
        }
        if (tracks.length < 2) {
          state.ui.setLastWarning = 'not-enough-data';
          state.ui.setOpenDataPanel = true;
          toast('Недостаточно данных для этого режима');
          renderApp();
          return;
        }
        var targetLen = desiredTrackCount(tracks);
        var result = [];
        if (typeof generateSetAlgo === 'function') {
          result = generateSetAlgo(tracks, mode, opts, targetLen);
        }
        state.ui.generatedSet = result || [];
        if (!result || result.length < 2) {
          state.ui.setLastWarning = 'no-valid-set';
          toast('Не удалось собрать сет — попробуй другой режим или ослабь фильтры');
        } else if (result.length < targetLen) {
          state.ui.setLastWarning = 'short-set';
          toast('Собрано ' + result.length + ' из ' + targetLen + '. Правила не дают длиннее.');
        } else {
          state.ui.setLastWarning = null;
          toast('Сет собран: ' + result.length + ' треков');
        }
        renderApp();
      };
      window.__vertaxSetUxHandlersWrapped = true;
    }

    document.addEventListener(
      'click',
      function (e) {
        var app = document.getElementById('laiso-app');
        if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
        var el = e.target.closest('[data-action]');
        if (!el) return;
        var action = el.dataset.action;

        if (action === 'set-add-vinyl') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          state.view = 'add';
          state.modal = null;
          renderApp();
          return;
        }

        if (action === 'set-target-pick') {
          e.preventDefault();
          setOptions().targetMinutes = clampMinutes(el.dataset.value);
          renderApp();
          return;
        }

        if (action === 'runt26-build-selected' || action === 'runt30-build-selected') {
          var count = selectedVinylCount();
          if (count > 0 && count < 2) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            oneVinylMessage();
          }
        }
      },
      true
    );

    document.addEventListener(
      'change',
      function (e) {
        var app = document.getElementById('laiso-app');
        if (!app || !e.target.closest || !e.target.closest('#laiso-app')) return;
        var action = e.target.dataset && e.target.dataset.action;
        if (action === 'set-genre-filter') {
          setOptions().genreFilter = e.target.value || '';
          state.ui.generatedSet = [];
          renderApp();
        }
      },
      true
    );

    function registerAfterRender() {
      if (
        typeof window.vertaxRegisterAfterRender === 'function' &&
        !window.__vertaxSetUxAfterRenderRegistered
      ) {
        window.vertaxRegisterAfterRender(function () {
          setTimeout(afterRender, 60);
        });
        window.__vertaxSetUxAfterRenderRegistered = true;
      }
    }

    registerAfterRender();
    setTimeout(registerAfterRender, 300);

    afterRender();
    console.log('VERTAX set-builder UX patch loaded');
  }

  boot();
})();
