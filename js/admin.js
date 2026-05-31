(function () {
  var tokenKey = 'vertax-admin-token';
  var state = {
    token: sessionStorage.getItem(tokenKey) || '',
    data: null,
    candidates: { rows: [], offset: 0, limit: 50, total: 0, sortBy: 'updated_at', sortDir: 'desc' },
    tracks: { rows: [], offset: 0, limit: 50, total: 0, sortBy: 'savedAt', sortDir: 'desc', selected: {} },
    coll: { mode: 'releases', rows: [], offset: 0, limit: 50, total: 0, sortBy: 'updated_at', sortDir: 'desc', detail: null },
  };

  /* ============================================================
     Utils
     ============================================================ */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmt(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'number') return value.toLocaleString('ru-RU');
    return String(value);
  }

  function dateShort(value) {
    var time = Date.parse(value || '');
    if (!time) return '—';
    return new Date(time).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  function entries(obj, limit) {
    return Object.keys(obj || {})
      .map(function (key) { return { name: key, count: Number(obj[key]) || 0 }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, limit || 12);
  }

  function showError(message) {
    var box = $('errorBox');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
  }

  function showAuthError(message) {
    var box = $('authError');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
  }

  /* ============================================================
     Auth + API
     ============================================================ */
  function getTelegramInitData() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        return window.Telegram.WebApp.initData || '';
      }
    } catch (_) {}
    return '';
  }

  async function adminPost(action, extra) {
    var headers = { 'Content-Type': 'application/json' };
    var initData = getTelegramInitData();
    if (initData) headers['X-Telegram-Init-Data'] = initData;
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    var response = await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(Object.assign({ action: action }, extra || {})),
    });
    var json = await response.json().catch(function () { return {}; });
    if (response.status === 401) {
      var err = new Error('unauthorized');
      err.status = 401;
      throw err;
    }
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || json.message || 'HTTP ' + response.status);
    }
    return json;
  }

  function showAuthScreen() {
    $('authShell').hidden = false;
    $('appShell').hidden = true;
    sessionStorage.removeItem(tokenKey);
    state.token = '';
  }

  function showAppScreen() {
    $('authShell').hidden = true;
    $('appShell').hidden = false;
  }

  /* ============================================================
     Tabs
     ============================================================ */
  function switchTab(name) {
    document.querySelectorAll('.admin-tab').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.admin-view').forEach(function (el) {
      el.hidden = el.getAttribute('data-view') !== name;
    });
    $('viewTitle').textContent = {
      dashboard: 'Дашборд', candidates: 'Кандидаты',
      users: 'Юзеры', collection: 'Коллекция',
    }[name] || 'Дашборд';
    if (name === 'candidates') loadCandidates();
    if (name === 'users') loadUsersTab();
    if (name === 'collection') loadCollection();
  }

  function setCollMode(mode) {
    state.coll.mode = mode;
    document.querySelectorAll('.admin-subtab').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-cmode') === mode);
    });
    document.querySelector('.admin-cmode-releases').hidden = (mode !== 'releases');
    document.querySelector('.admin-cmode-tracks').hidden = (mode !== 'tracks');
    /* Hide detail when switching modes */
    if (mode === 'tracks') {
      $('collReleaseDetail').hidden = true;
      $('collReleasesTable').closest('.admin-card').hidden = false;
    }
    loadCollection();
  }

  function loadCollection() {
    if (state.coll.mode === 'tracks') return loadTracks();
    return loadCollReleases();
  }

  /* ============================================================
     Dashboard (reuses old overview render)
     ============================================================ */
  function renderStats(data) {
    var candidates = data.candidates || {};
    var redis = data.redis || {};
    var users = data.users || {};
    var metadata = candidates.metadata || {};
    var stats = [
      ['Кандидаты', candidates.total_candidates || 0, 'общая база релизов'],
      ['BPM/Key кэш', redis.total_tracks || 0, 'постоянные track:* записи'],
      ['Юзеры', users.collection_index_users || 0, 'видны через server-side анализ'],
      ['Coverage', Math.round((metadata.avg_metadata_coverage || 0) * 100) + '%', 'среднее по BPM/Key'],
      ['С обложками', metadata.with_cover || 0, 'релизы с cover_url'],
      ['С marketplace', metadata.with_marketplace || 0, 'есть цена Discogs'],
      ['Collection indexes', users.collection_index_count || 0, 'temporary TTL cache'],
      ['Pending proposals', data.proposals ? data.proposals.pending_count : 0, 'ручные правки'],
    ];
    $('statsGrid').innerHTML = stats.map(function (item) {
      return '<article class="admin-stat"><span>' + esc(item[0]) +
        '</span><strong>' + esc(item[1]) + '</strong><span>' + esc(item[2]) + '</span></article>';
    }).join('');
  }

  function renderBars(target, rows) {
    var max = rows.reduce(function (m, row) { return Math.max(m, row.count); }, 1);
    target.innerHTML = rows.length
      ? rows.map(function (row) {
          return '<div class="admin-bar"><span>' + esc(row.name) +
            '</span><div class="admin-bar-track"><div class="admin-bar-fill" style="--value:' +
            row.count / max + '"></div></div><strong>' + esc(row.count) + '</strong></div>';
        }).join('')
      : '<p class="admin-release-meta">Пока нет данных.</p>';
  }

  function renderTable(target, headers, rows) {
    target.innerHTML = '<thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr>' + row.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }

  function renderHtmlTable(target, headers, rows) {
    target.innerHTML = '<thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr>' + row.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }

  function renderRecentReleases(items) {
    $('recentTotal').textContent = (items || []).length + ' shown';
    $('recentCandidates').innerHTML = (items || []).length
      ? items.map(function (item) {
          var cover = item.cover_url
            ? '<img src="' + esc(item.cover_url) + '" alt="">'
            : '<div class="admin-release-cover"></div>';
          return '<article class="admin-release">' + cover +
            '<div><div class="admin-release-title">' + esc(item.artist || '') + ' — ' + esc(item.title || '') +
            '</div><div class="admin-release-meta">' +
            esc([item.label, item.year, item.catalog_number].filter(Boolean).join(' · ')) +
            '</div><div class="admin-release-small">' + esc(item.genre_family || 'other') +
            ' · ' + esc(item.enriched_track_count || 0) + '/' + esc(item.track_count || 0) +
            ' meta · upd ' + esc(dateShort(item.updated_at)) + '</div></div></article>';
        }).join('')
      : '<p class="admin-release-meta">Пока нет candidates.</p>';
  }

  function renderDashboard(data) {
    state.data = data;
    renderStats(data);
    var candidates = data.candidates || {};
    $('genreTotal').textContent = fmt(candidates.total_candidates || 0) + ' total';
    renderBars($('genreBars'), entries(candidates.by_genre_family, 14));
    renderBars($('bpmBars'), entries(candidates.by_bpm_bucket, 14));
    var labels = (candidates.by_label_top || []).slice(0, 20);
    $('labelTotal').textContent = labels.length + ' shown';
    renderTable($('labelTable'), ['Лейбл', 'Релизов'],
      labels.map(function (item) { return [item.label, item.count]; }));
    var seed = (data.seed && data.seed.labels) || [];
    renderTable($('seedTable'), ['Лейбл', 'Offset', 'Saved', 'Updated', 'Last run'],
      seed.map(function (item) {
        return [item.label_name || item.label_id, item.last_offset || 0,
          item.total_saved || 0, item.total_updated || 0, dateShort(item.last_run_at)];
      }));
    var coverageFamilies = (data.seed_config && data.seed_config.families) || [];
    renderTable($('coverageTable'), ['Family', 'Candidates', 'Enabled labels', 'Status'],
      coverageFamilies.map(function (item) {
        return [item.genre_family, item.current_count || 0,
          item.enabled_labels + ' / ' + item.configured_labels,
          item.missing_enabled_source ? 'needs source' : item.current_count ? 'ok' : 'empty'];
      }));
    var seedLabels = ((data.seed_config && data.seed_config.labels) || [])
      .filter(function (l) { return l.discogs_label_id; })
      .sort(function (a, b) {
        return Number(a.enabled === false) - Number(b.enabled === false) ||
          (a.current_family_count || 0) - (b.current_family_count || 0) ||
          String(a.name).localeCompare(String(b.name));
      })
      .slice(0, 24);
    var seedRows = seedLabels.map(function (label) {
      return [
        esc(label.name) + (label.enabled ? '' : ' <span class="admin-muted">off</span>'),
        esc(label.genre_family),
        esc(label.current_family_count || 0),
        '<button class="admin-mini-button" type="button" data-action="seed-label" data-label-id="' +
          esc(label.discogs_label_id) + '" data-label-name="' + esc(label.name) +
          '" data-genre-family="' + esc(label.genre_family) + '">Seed 5</button>',
      ];
    });
    renderHtmlTable($('seedConfigTable'), ['Label', 'Family', 'Count', 'Action'], seedRows);
    /* Duplicate to candidates tab */
    if ($('seedConfigTableCandidates'))
      renderHtmlTable($('seedConfigTableCandidates'), ['Label', 'Family', 'Count', 'Action'], seedRows);
    renderRecentReleases(data.recent_candidates || []);
  }

  /* ============================================================
     Candidates tab
     ============================================================ */
  async function loadCandidates() {
    showError('');
    try {
      /* Load labels for filter dropdown if not yet done */
      if (!state.labels) {
        var lr = await adminPost('list_candidate_labels');
        state.labels = lr.labels || [];
        renderLabelFilters(state.labels);
        renderLabelsConfig(state.labels);
      }
      var result = await adminPost('list_candidates_paged', {
        offset: state.candidates.offset,
        limit: state.candidates.limit,
        sort_by: state.candidates.sortBy,
        sort_dir: state.candidates.sortDir,
        label: $('candidateLabelFilter').value || '',
        genre_family: $('candidateGenreFilter').value || '',
        q: $('candidateSearch').value || '',
      });
      state.candidates.rows = result.rows || [];
      state.candidates.total = result.total || 0;
      renderCandidatesTable();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError(error.message || 'load candidates failed');
    }
  }

  function renderLabelFilters(labels) {
    var labelSel = $('candidateLabelFilter');
    var genreSel = $('candidateGenreFilter');
    var seenGenres = {};
    labelSel.innerHTML = '<option value="">Все лейблы</option>' +
      (labels || []).map(function (l) {
        return '<option value="' + esc(l.name) + '">' + esc(l.name) +
          ' (' + (l.candidate_count || 0) + ')</option>';
      }).join('');
    (labels || []).forEach(function (l) { if (l.genre_family) seenGenres[l.genre_family] = true; });
    genreSel.innerHTML = '<option value="">Все жанры</option>' +
      Object.keys(seenGenres).sort().map(function (g) {
        return '<option value="' + esc(g) + '">' + esc(g) + '</option>';
      }).join('');
    populateSeedGenreSelect();
  }

  function renderLabelsConfig(labels) {
    $('labelsTotal').textContent = (labels || []).length + ' лейблов';
    $('labelsConfigTbody').innerHTML = (labels || []).map(function (l) {
      return '<tr>' +
        '<td><strong>' + esc(l.name) + '</strong></td>' +
        '<td>' + esc(l.discogs_label_id || '—') + '</td>' +
        '<td>' + esc(l.genre_family || '—') + '</td>' +
        '<td>' + esc(l.priority || '—') + '</td>' +
        '<td>' + esc(l.candidate_count || 0) + '</td>' +
        '<td>' + (l.unmanaged ? '<span class="admin-muted">unmanaged</span>' :
                  l.enabled === false ? '<span class="admin-muted">off</span>' :
                  '<span class="admin-ok">enabled</span>') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="6" class="admin-muted">Пусто.</td></tr>';
  }

  function renderCandidatesTable() {
    var rows = state.candidates.rows;
    $('candidatesTotal').textContent = state.candidates.total + ' релизов';
    $('candidatesTbody').innerHTML = rows.length ? rows.map(function (r) {
      var cover = r.cover_url ? '<img class="admin-tiny-cover" src="' + esc(r.cover_url) + '" alt="">'
                              : '<div class="admin-tiny-cover admin-tiny-cover-empty"></div>';
      var price = r.marketplace && r.marketplace.lowest_price
        ? r.marketplace.lowest_price + (r.marketplace.currency ? ' ' + r.marketplace.currency : '')
        : '—';
      var coverage = Math.round((r.metadata_coverage || 0) * 100) + '%';
      return '<tr data-id="' + esc(r.discogs_id) + '">' +
        '<td>' + cover + '</td>' +
        '<td>' + esc(r.artist || '—') + '</td>' +
        '<td>' + esc(r.title || '—') +
          (r.catalog_number ? ' <span class="admin-muted">' + esc(r.catalog_number) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.label || '—') + '</td>' +
        '<td>' + esc(r.year || '—') + '</td>' +
        '<td>' + esc(r.genre_family || '—') + '</td>' +
        '<td>' + esc((r.enriched_track_count || 0) + '/' + (r.track_count || 0)) + '</td>' +
        '<td>' + esc(coverage) + '</td>' +
        '<td>' + esc(price) + '</td>' +
        '<td>' + esc(dateShort(r.updated_at)) + '</td>' +
        '<td>' +
          (r.discogs_url ? '<a class="admin-mini-link" href="' + esc(r.discogs_url) + '" target="_blank" rel="noopener">Discogs</a>' : '') +
          ' <button class="admin-mini-button" type="button" data-action="enrich-candidate" data-id="' + esc(r.discogs_id) + '">Обогатить</button>' +
        '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="11" class="admin-muted">Ничего не найдено.</td></tr>';

    var hasNext = (state.candidates.offset + state.candidates.limit) < state.candidates.total;
    var hasPrev = state.candidates.offset > 0;
    $('candidatesNext').disabled = !hasNext;
    $('candidatesPrev').disabled = !hasPrev;
    var shown = Math.min(state.candidates.total, state.candidates.offset + rows.length);
    $('candidatesPagerInfo').textContent = (state.candidates.offset + 1) + '–' + shown + ' из ' + state.candidates.total;

    /* Header sort indicators */
    document.querySelectorAll('#candidatesTable thead th[data-sort]').forEach(function (th) {
      th.classList.toggle('is-sorted', th.getAttribute('data-sort') === state.candidates.sortBy);
      th.classList.toggle('asc', state.candidates.sortDir === 'asc');
      th.classList.toggle('desc', state.candidates.sortDir === 'desc');
    });
  }

  async function enrichCandidate(id, button) {
    if (!id) return;
    button.disabled = true;
    var orig = button.textContent;
    button.textContent = '...';
    try {
      var result = await adminPost('enrich_candidate', { discogs_id: id });
      showError('Обогащено [' + id + ']: marketplace=' + (result.marketplace_updated || 0) +
        ', samples=' + (result.samples_updated || 0));
      /* Update row in place */
      if (result.release) {
        var idx = state.candidates.rows.findIndex(function (r) { return String(r.discogs_id) === String(id); });
        if (idx >= 0) {
          state.candidates.rows[idx] = result.release;
          renderCandidatesTable();
        }
      }
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Обогащение упало: ' + (error.message || 'unknown'));
    } finally {
      button.disabled = false;
      button.textContent = orig;
    }
  }

  /* ============================================================
     Users tab (basic, server-side data only)
     ============================================================ */
  function loadUsersTab() {
    if (!state.data) return;
    var users = state.data.users || {};
    var temp = state.data.temporary_cache || {};
    var summary = [
      ['Collection-index юзеров', users.collection_index_users || 0, 'видны на сервере'],
      ['Snapshot-ов в Redis', users.collection_index_count || 0, 'temporary TTL'],
      ['AI verdict кэш', temp.ai_verdict_count || 0, 'cached AI разборы'],
    ];
    $('usersSummary').innerHTML = summary.map(function (item) {
      return '<article class="admin-stat"><span>' + esc(item[0]) +
        '</span><strong>' + esc(item[1]) + '</strong><span>' + esc(item[2]) + '</span></article>';
    }).join('');
  }

  /* ============================================================
     Collection tab — full beatport:track:* browser
     ============================================================ */
  async function loadTracks() {
    showError('');
    try {
      var filter = $('trackFilter').value;
      var result = await adminPost('list_tracks_paged', {
        offset: state.tracks.offset,
        limit: state.tracks.limit,
        sort_by: state.tracks.sortBy,
        sort_dir: state.tracks.sortDir,
        q: $('trackSearch').value || '',
        beatport_track_id: ($('trackBpId') && $('trackBpId').value) || '',
        only_missing_sample: filter === 'missing_sample',
        only_missing_bpm: filter === 'missing_bpm',
        only_manual: filter === 'manual',
      });
      state.tracks.rows = result.rows || [];
      state.tracks.total = result.total || 0;
      renderTracksTable(result.keys_scanned || 0);
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Не удалось загрузить треки: ' + (error.message || 'unknown'));
    }
  }

  function renderTracksTable(scanned) {
    var rows = state.tracks.rows;
    $('tracksTotal').textContent = state.tracks.total + ' / ' + scanned + ' в кэше';
    $('tracksTbody').innerHTML = rows.length ? rows.map(function (r) {
      var manual = String(r.meta_status || '').toLowerCase() === 'admin' ||
                   String(r.bpm_source || '').toLowerCase() === 'admin';
      var manualTag = manual ? ' <span class="admin-muted" style="font-size:9px">[admin]</span>' : '';
      var sampleBtn = r.sample_url
        ? '<button class="admin-mini-button" type="button" data-action="track-play" data-url="' + esc(r.sample_url) + '">▶</button>'
        : '<span class="admin-muted">—</span>';
      var checked = state.tracks.selected[r.key] ? ' checked' : '';
      return '<tr data-key="' + esc(r.key) + '">' +
        '<td><input type="checkbox" class="admin-row-check" data-key="' + esc(r.key) + '"' + checked + ' aria-label="Выбрать" /></td>' +
        '<td>' + esc(r.artist || '—') + '</td>' +
        '<td>' + esc(r.title || '—') + manualTag +
          (r.beatport_track_id ? ' <span class="admin-muted" style="font-size:9px">bp:' + esc(r.beatport_track_id) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.label || '—') + '</td>' +
        '<td><input class="admin-cell-input" type="number" min="0" max="300" value="' + esc(r.bpm || '') +
          '" data-field="bpm" data-key="' + esc(r.key) + '" /></td>' +
        '<td><input class="admin-cell-input admin-cell-narrow" type="text" maxlength="3" value="' + esc(r.camelot || '') +
          '" data-field="camelot" data-key="' + esc(r.key) + '" /></td>' +
        '<td><input class="admin-cell-input admin-cell-key" type="text" maxlength="12" value="' + esc(r.key_name || '') +
          '" data-field="key_name" data-key="' + esc(r.key) + '" /></td>' +
        '<td>' + esc(r.genre || '—') + (r.sub_genre ? ' <span class="admin-muted">' + esc(r.sub_genre) + '</span>' : '') + '</td>' +
        '<td>' + sampleBtn + '</td>' +
        '<td>' + esc(dateShort(r.savedAt)) + '</td>' +
        '<td>' +
          (r.beatport_url ? '<a class="admin-mini-link" href="' + esc(r.beatport_url) + '" target="_blank" rel="noopener">BP</a>' : '') +
          ' <button class="admin-mini-button" type="button" data-action="enrich-track" data-key="' + esc(r.key) + '">Обогатить</button>' +
        '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="11" class="admin-muted">Ничего не найдено.</td></tr>';

    var hasNext = (state.tracks.offset + state.tracks.limit) < state.tracks.total;
    var hasPrev = state.tracks.offset > 0;
    $('tracksNext').disabled = !hasNext;
    $('tracksPrev').disabled = !hasPrev;
    var shown = Math.min(state.tracks.total, state.tracks.offset + rows.length);
    $('tracksPagerInfo').textContent = (state.tracks.total ? (state.tracks.offset + 1) : 0) + '–' + shown + ' из ' + state.tracks.total;

    document.querySelectorAll('#tracksTable thead th[data-sort-track]').forEach(function (th) {
      th.classList.toggle('is-sorted', th.getAttribute('data-sort-track') === state.tracks.sortBy);
      th.classList.toggle('asc', state.tracks.sortDir === 'asc');
      th.classList.toggle('desc', state.tracks.sortDir === 'desc');
    });
  }

  async function updateTrackField(input) {
    var key = input.getAttribute('data-key');
    var field = input.getAttribute('data-field');
    var value = input.value.trim();
    if (!key || !field) return;
    input.disabled = true;
    showError('');
    try {
      var body = { key: key };
      body[field] = value;
      var result = await adminPost('update_track', body);
      if (result.ok) {
        input.style.borderColor = '#C8FF2E';
        setTimeout(function () { input.style.borderColor = ''; }, 800);
        /* Update local row */
        var idx = state.tracks.rows.findIndex(function (r) { return r.key === key; });
        if (idx >= 0 && result.track) {
          Object.assign(state.tracks.rows[idx], result.patch);
        }
      }
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      input.style.borderColor = '#E66A2C';
      showError('Update failed: ' + (error.message || 'unknown'));
    } finally {
      input.disabled = false;
    }
  }

  async function enrichTrack(key, button) {
    if (!key) return;
    button.disabled = true;
    var orig = button.textContent;
    button.textContent = '...';
    try {
      var result = await adminPost('enrich_track', { key: key });
      if (result.ok && result.track) {
        showError('Трек обогащён');
        var idx = state.tracks.rows.findIndex(function (r) { return r.key === key; });
        if (idx >= 0) {
          var t = result.track;
          state.tracks.rows[idx] = Object.assign({}, state.tracks.rows[idx], {
            sample_url: t.sample_url || null,
            genre: t.genre || state.tracks.rows[idx].genre,
            sub_genre: t.sub_genre || state.tracks.rows[idx].sub_genre,
            label: t.label || state.tracks.rows[idx].label,
            beatport_url: t.beatport_url || state.tracks.rows[idx].beatport_url,
            savedAt: t.savedAt,
          });
          renderTracksTable(state.tracks.total);
        }
      }
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Обогащение упало: ' + (error.message || 'unknown'));
    } finally {
      button.disabled = false;
      button.textContent = orig;
    }
  }

  /* ============================================================
     Seed by genre
     ============================================================ */
  function populateSeedGenreSelect() {
    var sel = $('seedGenreSelect');
    if (!sel) return;
    var seen = {};
    (state.labels || []).forEach(function (l) {
      if (l.genre_family && l.enabled !== false && l.discogs_label_id) seen[l.genre_family] = true;
    });
    sel.innerHTML = '<option value="">— жанровая семья —</option>' +
      Object.keys(seen).sort().map(function (g) {
        return '<option value="' + esc(g) + '">' + esc(g) + '</option>';
      }).join('');
  }

  async function seedByGenreClick() {
    var family = $('seedGenreSelect').value;
    var limit = Math.max(1, Math.min(25, parseInt($('seedGenreLimit').value, 10) || 10));
    var btn = $('seedGenreBtn');
    var status = $('seedGenreStatus');
    if (!family) { status.textContent = 'Выбери жанр'; return; }
    btn.disabled = true;
    status.textContent = 'Загрузка…';
    try {
      var result = await adminPost('seed_by_genre', { genre_family: family, limit: limit });
      var picked = result.picked_label ? result.picked_label.name : '—';
      status.textContent = 'Лейбл: ' + picked +
        ' · saved ' + (result.saved || 0) +
        ' · updated ' + (result.updated || 0) +
        ' · skipped non-vinyl ' + (result.skipped_non_vinyl || 0);
      await load();
      if (state.candidates) state.candidates.offset = 0;
      await loadCandidates();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      status.textContent = 'Ошибка: ' + (error.message || 'unknown');
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================================================
     CSV / JSON export of current candidates filter
     ============================================================ */
  async function exportCandidatesAs(format) {
    /* Pull a generous slice for current filter without paging */
    showError('');
    try {
      var result = await adminPost('list_candidates_paged', {
        offset: 0,
        limit: 2000,
        sort_by: state.candidates.sortBy,
        sort_dir: state.candidates.sortDir,
        label: $('candidateLabelFilter').value || '',
        genre_family: $('candidateGenreFilter').value || '',
        q: $('candidateSearch').value || '',
      });
      var rows = result.rows || [];
      var ts = new Date().toISOString().slice(0, 10);
      var blob;
      var filename;
      if (format === 'csv') {
        var headers = ['discogs_id','artist','title','label','catno','year','genre_family','tracks','enriched','coverage','lowest_price','currency','updated_at','discogs_url'];
        var lines = [headers.join(',')];
        rows.forEach(function (r) {
          var market = r.marketplace || {};
          var line = [
            r.discogs_id,
            csvEsc(r.artist), csvEsc(r.title), csvEsc(r.label), csvEsc(r.catalog_number),
            r.year || '', csvEsc(r.genre_family),
            r.track_count || 0, r.enriched_track_count || 0,
            (r.metadata_coverage || 0).toFixed(2),
            market.lowest_price || '', csvEsc(market.currency),
            r.updated_at || '', csvEsc(r.discogs_url)
          ].join(',');
          lines.push(line);
        });
        blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        filename = 'vertax-candidates-' + ts + '.csv';
      } else {
        blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
        filename = 'vertax-candidates-' + ts + '.json';
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 200);
      showError('Скачано: ' + filename + ' (' + rows.length + ' релизов)');
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Export failed: ' + (error.message || 'unknown'));
    }
  }

  function csvEsc(value) {
    var s = String(value == null ? '' : value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /* ============================================================
     Sample preview engine for Collection tab
     ============================================================ */
  function playTrackPreview(button) {
    var url = button.getAttribute('data-url');
    if (!url) return;
    if (!window.__adminAudio) window.__adminAudio = new Audio();
    var audio = window.__adminAudio;
    if (audio.src === url && !audio.paused) { audio.pause(); button.textContent = '▶'; return; }
    /* Reset all play buttons */
    document.querySelectorAll('[data-action="track-play"]').forEach(function (b) { b.textContent = '▶'; });
    audio.src = url;
    audio.play().then(function () { button.textContent = '⏸'; })
      .catch(function () { button.textContent = '!'; });
    audio.onended = function () { button.textContent = '▶'; };
  }

  /* ============================================================
     Collection — Releases sub-view
     ============================================================ */
  async function loadCollReleases() {
    showError('');
    try {
      /* Use same backend as Candidates tab */
      if (!state.labels) {
        var lr = await adminPost('list_candidate_labels');
        state.labels = lr.labels || [];
        populateCollFilters(state.labels);
      }
      var result = await adminPost('list_candidates_paged', {
        offset: state.coll.offset,
        limit: state.coll.limit,
        sort_by: state.coll.sortBy,
        sort_dir: state.coll.sortDir,
        label: $('collReleaseLabel').value || '',
        genre_family: $('collReleaseGenre').value || '',
        q: $('collReleaseSearch').value || '',
      });
      state.coll.rows = result.rows || [];
      state.coll.total = result.total || 0;
      renderCollReleasesTable();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError(error.message || 'load failed');
    }
  }

  function populateCollFilters(labels) {
    var labelSel = $('collReleaseLabel');
    var genreSel = $('collReleaseGenre');
    if (!labelSel || !genreSel) return;
    var seenGenres = {};
    labelSel.innerHTML = '<option value="">Все лейблы</option>' +
      (labels || []).map(function (l) {
        return '<option value="' + esc(l.name) + '">' + esc(l.name) +
          ' (' + (l.candidate_count || 0) + ')</option>';
      }).join('');
    (labels || []).forEach(function (l) { if (l.genre_family) seenGenres[l.genre_family] = true; });
    genreSel.innerHTML = '<option value="">Все жанры</option>' +
      Object.keys(seenGenres).sort().map(function (g) {
        return '<option value="' + esc(g) + '">' + esc(g) + '</option>';
      }).join('');
  }

  function renderCollReleasesTable() {
    var rows = state.coll.rows;
    $('collReleasesTotal').textContent = state.coll.total + ' релизов';
    $('collReleasesTbody').innerHTML = rows.length ? rows.map(function (r) {
      var cover = r.cover_url ? '<img class="admin-tiny-cover" src="' + esc(r.cover_url) + '" alt="">'
                              : '<div class="admin-tiny-cover admin-tiny-cover-empty"></div>';
      var coverage = Math.round((r.metadata_coverage || 0) * 100) + '%';
      return '<tr data-id="' + esc(r.discogs_id) + '">' +
        '<td>' + cover + '</td>' +
        '<td>' + esc(r.artist || '—') + '</td>' +
        '<td><a class="admin-link-open" href="#" data-action="open-release" data-id="' + esc(r.discogs_id) + '">' +
          esc(r.title || '—') + '</a>' +
          (r.catalog_number ? ' <span class="admin-muted">' + esc(r.catalog_number) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.label || '—') + '</td>' +
        '<td>' + esc(r.year || '—') + '</td>' +
        '<td>' + esc(r.genre_family || '—') + '</td>' +
        '<td>' + esc((r.enriched_track_count || 0) + '/' + (r.track_count || 0)) + '</td>' +
        '<td>' + esc(coverage) + '</td>' +
        '<td>' + esc(dateShort(r.updated_at)) + '</td>' +
        '<td>' +
          '<button class="admin-mini-button" type="button" data-action="open-release" data-id="' + esc(r.discogs_id) + '">Открыть</button> ' +
          '<button class="admin-mini-button" type="button" data-action="enrich-candidate" data-id="' + esc(r.discogs_id) + '">Обогатить</button>' +
        '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="10" class="admin-muted">Ничего не найдено.</td></tr>';

    var hasNext = (state.coll.offset + state.coll.limit) < state.coll.total;
    $('collReleasesNext').disabled = !hasNext;
    $('collReleasesPrev').disabled = state.coll.offset <= 0;
    var shown = Math.min(state.coll.total, state.coll.offset + rows.length);
    $('collReleasesPagerInfo').textContent = (state.coll.total ? (state.coll.offset + 1) : 0) + '–' + shown + ' из ' + state.coll.total;

    document.querySelectorAll('#collReleasesTable thead th[data-sort-coll]').forEach(function (th) {
      th.classList.toggle('is-sorted', th.getAttribute('data-sort-coll') === state.coll.sortBy);
      th.classList.toggle('asc', state.coll.sortDir === 'asc');
      th.classList.toggle('desc', state.coll.sortDir === 'desc');
    });
  }

  async function openReleaseDetail(id) {
    if (!id) return;
    showError('');
    try {
      var result = await adminPost('get_release_detail', { discogs_id: id });
      if (!result.ok) throw new Error(result.error || 'detail failed');
      state.coll.detail = result.release;
      renderReleaseDetail();
      $('collReleaseDetail').hidden = false;
      $('collReleasesTable').closest('.admin-card').hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Open release failed: ' + (error.message || 'unknown'));
    }
  }

  function closeReleaseDetail() {
    $('collReleaseDetail').hidden = true;
    $('collReleasesTable').closest('.admin-card').hidden = false;
    state.coll.detail = null;
  }

  function renderReleaseDetail() {
    var r = state.coll.detail || {};
    $('collDetailTitle').textContent = (r.artist || '—') + ' — ' + (r.title || '—');
    $('collDetailMeta').textContent = [r.label, r.year, r.catalog_number, r.genre_family]
      .filter(Boolean).join(' · ');

    var cover = r.cover_url
      ? '<img class="admin-detail-cover" src="' + esc(r.cover_url) + '" alt="">' : '';
    var stats = '<div class="admin-detail-stats">' +
      statBox('Треков', (r.tracks || []).length) +
      statBox('Обогащено', r.enriched_track_count || 0) +
      statBox('Coverage', Math.round((r.metadata_coverage || 0) * 100) + '%') +
      statBox('Жанр', r.genre_family || '—') +
      '</div>';
    var actions = '<div style="margin-top:10px;">' +
      (r.discogs_url ? '<a class="admin-mini-link" href="' + esc(r.discogs_url) +
        '" target="_blank" rel="noopener">Discogs ↗</a> ' : '') +
      '<button class="admin-mini-button" type="button" data-action="enrich-candidate" data-id="' +
        esc(r.discogs_id) + '">Обогатить релиз</button>' +
      '</div>';
    $('collDetailHeader').innerHTML = '<div class="admin-detail-head">' + cover +
      '<div>' + stats + actions + '</div></div>';

    var tracks = Array.isArray(r.tracks) ? r.tracks : [];
    $('collDetailTbody').innerHTML = tracks.length ? tracks.map(function (t, idx) {
      var key = t.cache_key || ('vertax:beatport:track:' + (t.beatport_track_id || ('idx-' + idx)));
      var manual = String(t.meta_status || '').toLowerCase() === 'admin' ||
                   String(t.bpm_source || '').toLowerCase() === 'admin';
      var manualTag = manual ? ' <span class="admin-muted" style="font-size:9px">[admin]</span>' : '';
      var sampleBtn = t.sample_url
        ? '<button class="admin-mini-button" type="button" data-action="track-play" data-url="' + esc(t.sample_url) + '">▶</button>'
        : '<span class="admin-muted">—</span>';
      var inputs = t.beatport_track_id ? (
        '<td><input class="admin-cell-input" type="number" min="0" max="300" value="' + esc(t.bpm || '') +
          '" data-field="bpm" data-key="' + esc(key) + '" /></td>' +
        '<td><input class="admin-cell-input admin-cell-narrow" type="text" maxlength="3" value="' + esc(t.camelot || '') +
          '" data-field="camelot" data-key="' + esc(key) + '" /></td>' +
        '<td><input class="admin-cell-input admin-cell-key" type="text" maxlength="12" value="' + esc(t.key_name || '') +
          '" data-field="key_name" data-key="' + esc(key) + '" /></td>'
      ) : (
        '<td>' + esc(t.bpm || '—') + '</td>' +
        '<td>' + esc(t.camelot || '—') + '</td>' +
        '<td>' + esc(t.key_name || '—') + '</td>'
      );
      return '<tr>' +
        '<td>' + esc(t.position || '—') + '</td>' +
        '<td>' + esc(t.artist || r.artist || '—') + '</td>' +
        '<td>' + esc(t.title || '—') + manualTag + '</td>' +
        inputs +
        '<td>' + sampleBtn + '</td>' +
        '<td>' +
          (t.beatport_url ? '<a class="admin-mini-link" href="' + esc(t.beatport_url) + '" target="_blank" rel="noopener">BP</a>' : '') +
          (t.beatport_track_id ? ' <button class="admin-mini-button" type="button" data-action="enrich-track" data-key="' + esc(key) + '">Обогатить</button>' : '') +
        '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="8" class="admin-muted">У релиза нет треков в кэше.</td></tr>';
  }

  function statBox(label, value) {
    return '<span class="admin-detail-stat"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></span>';
  }

  /* ============================================================
     Bulk enrich + select-all for Tracks
     ============================================================ */
  function refreshBulkCount() {
    var n = Object.keys(state.tracks.selected).length;
    $('tracksBulkCount').textContent = n;
    $('tracksBulkEnrichBtn').disabled = n === 0;
  }
  function toggleTrackSelect(key, on) {
    if (on) state.tracks.selected[key] = true;
    else delete state.tracks.selected[key];
    refreshBulkCount();
  }
  async function bulkEnrichTracks() {
    var keys = Object.keys(state.tracks.selected);
    if (!keys.length) return;
    var btn = $('tracksBulkEnrichBtn');
    btn.disabled = true;
    var orig = btn.textContent;
    btn.textContent = 'Обогащаю ' + keys.length + '…';
    try {
      var result = await adminPost('enrich_tracks_batch', { keys: keys });
      showError('Bulk обогащение: ' + result.succeeded + '/' + result.total + ' успешно');
      state.tracks.selected = {};
      refreshBulkCount();
      await loadTracks();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError('Bulk failed: ' + (error.message || 'unknown'));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  /* Reclassify candidates */
  async function reclassifyCandidates(dryRun) {
    var statusEl = $('reclassifyStatus');
    var outEl = $('reclassifyOutput');
    statusEl.textContent = dryRun ? 'Считаю изменения…' : 'Применяю…';
    outEl.hidden = true;
    try {
      var result = await adminPost('reclassify_candidates', { dry_run: !!dryRun });
      statusEl.textContent = 'Examined: ' + result.examined + ', changed: ' + result.changed +
        (dryRun ? ' (dry run)' : ' (applied)');
      outEl.hidden = false;
      outEl.textContent = JSON.stringify(result.sample_changes || [], null, 2);
      if (!dryRun) await load();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      statusEl.textContent = 'Ошибка: ' + (error.message || 'unknown');
    }
  }

  /* Wrap loadTracks to update beatport_track_id filter */
  /* ============================================================
     Dashboard load
     ============================================================ */
  async function load() {
    showError('');
    $('refreshBtn').disabled = true;
    try {
      var data = await adminPost('admin_overview');
      showAppScreen();
      renderDashboard(data);
      /* If currently on candidates/users tab, refresh them too */
      var activeTab = document.querySelector('.admin-tab.is-active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : 'dashboard';
      if (tabName === 'users') loadUsersTab();
    } catch (error) {
      if (error.status === 401) {
        showAuthScreen();
        showAuthError('Неверный пароль.');
      } else {
        showError(error.message || 'load failed');
      }
    } finally {
      $('refreshBtn').disabled = false;
    }
  }

  /* ============================================================
     Boot
     ============================================================ */
  async function seedLabel(button) {
    var labelId = button.getAttribute('data-label-id');
    if (!labelId) return;
    var name = button.getAttribute('data-label-name') || labelId;
    button.disabled = true;
    button.textContent = 'Seeding...';
    showError('');
    try {
      var result = await adminPost('seed_candidates', {
        label_id: Number(labelId), label_name: name,
        genre_family: button.getAttribute('data-genre-family') || null, limit: 5,
      });
      showError('Seed ' + name + ': saved ' + (result.saved || 0) +
        ', updated ' + (result.updated || 0) + ', skipped non-vinyl ' + (result.skipped_non_vinyl || 0));
      await load();
    } catch (error) {
      if (error.status === 401) { showAuthScreen(); return; }
      showError(error.message || 'seed failed');
    } finally {
      button.disabled = false;
      button.textContent = 'Seed 5';
    }
  }

  function boot() {
    $('refreshBtn').addEventListener('click', load);
    $('logoutBtn').addEventListener('click', showAuthScreen);
    $('tokenForm').addEventListener('submit', function (event) {
      event.preventDefault();
      state.token = $('tokenInput').value.trim();
      if (state.token) sessionStorage.setItem(tokenKey, state.token);
      showAuthError('');
      load();
    });
    /* Tabs */
    document.querySelectorAll('.admin-tab').forEach(function (el) {
      el.addEventListener('click', function () { switchTab(el.getAttribute('data-tab')); });
    });
    /* Candidates toolbar */
    $('candidatesApplyBtn').addEventListener('click', function () {
      state.candidates.offset = 0;
      loadCandidates();
    });
    $('candidateSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { state.candidates.offset = 0; loadCandidates(); }
    });
    $('candidatesPrev').addEventListener('click', function () {
      state.candidates.offset = Math.max(0, state.candidates.offset - state.candidates.limit);
      loadCandidates();
    });
    $('candidatesNext').addEventListener('click', function () {
      state.candidates.offset += state.candidates.limit;
      loadCandidates();
    });
    $('candidatesExportCsv').addEventListener('click', function () { exportCandidatesAs('csv'); });
    $('candidatesExportJson').addEventListener('click', function () { exportCandidatesAs('json'); });
    $('seedGenreBtn').addEventListener('click', seedByGenreClick);
    /* Tracks toolbar */
    $('tracksApplyBtn').addEventListener('click', function () {
      state.tracks.offset = 0; state.tracks.selected = {}; refreshBulkCount(); loadTracks();
    });
    $('trackSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { state.tracks.offset = 0; loadTracks(); }
    });
    if ($('trackBpId')) {
      $('trackBpId').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { state.tracks.offset = 0; loadTracks(); }
      });
    }
    $('tracksPrev').addEventListener('click', function () {
      state.tracks.offset = Math.max(0, state.tracks.offset - state.tracks.limit);
      loadTracks();
    });
    $('tracksNext').addEventListener('click', function () {
      state.tracks.offset += state.tracks.limit;
      loadTracks();
    });
    /* Bulk + select-all */
    $('tracksBulkEnrichBtn').addEventListener('click', bulkEnrichTracks);
    $('tracksSelectAll').addEventListener('change', function (e) {
      var on = !!e.target.checked;
      document.querySelectorAll('.admin-row-check').forEach(function (cb) {
        cb.checked = on;
        if (on) state.tracks.selected[cb.getAttribute('data-key')] = true;
        else delete state.tracks.selected[cb.getAttribute('data-key')];
      });
      refreshBulkCount();
    });
    /* Collection sub-tabs */
    document.querySelectorAll('.admin-subtab').forEach(function (el) {
      el.addEventListener('click', function () { setCollMode(el.getAttribute('data-cmode')); });
    });
    /* Collection releases toolbar */
    $('collReleasesApplyBtn').addEventListener('click', function () { state.coll.offset = 0; loadCollReleases(); });
    $('collReleaseSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { state.coll.offset = 0; loadCollReleases(); }
    });
    $('collReleasesPrev').addEventListener('click', function () {
      state.coll.offset = Math.max(0, state.coll.offset - state.coll.limit);
      loadCollReleases();
    });
    $('collReleasesNext').addEventListener('click', function () {
      state.coll.offset += state.coll.limit;
      loadCollReleases();
    });
    $('collReleaseBack').addEventListener('click', closeReleaseDetail);
    /* Reclassify */
    $('reclassifyDryBtn').addEventListener('click', function () { reclassifyCandidates(true); });
    $('reclassifyApplyBtn').addEventListener('click', function () {
      if (confirm('Перезаписать genre_family у всех изменившихся релизов?')) reclassifyCandidates(false);
    });
    /* Inline track edit on blur */
    document.addEventListener('blur', function (event) {
      var input = event.target && event.target.closest && event.target.closest('.admin-cell-input');
      if (input) updateTrackField(input);
    }, true);
    /* Sortable headers + row actions */
    document.addEventListener('click', function (event) {
      var th = event.target && event.target.closest && event.target.closest('th[data-sort]');
      if (th) {
        var key = th.getAttribute('data-sort');
        if (state.candidates.sortBy === key) {
          state.candidates.sortDir = state.candidates.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.candidates.sortBy = key;
          state.candidates.sortDir = 'desc';
        }
        state.candidates.offset = 0;
        loadCandidates();
        return;
      }
      var thT = event.target && event.target.closest && event.target.closest('th[data-sort-track]');
      if (thT) {
        var k = thT.getAttribute('data-sort-track');
        if (state.tracks.sortBy === k) {
          state.tracks.sortDir = state.tracks.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.tracks.sortBy = k;
          state.tracks.sortDir = 'desc';
        }
        state.tracks.offset = 0;
        loadTracks();
        return;
      }
      var seedBtn = event.target && event.target.closest && event.target.closest('[data-action="seed-label"]');
      if (seedBtn) { event.preventDefault(); seedLabel(seedBtn); return; }
      var enrichBtn = event.target && event.target.closest && event.target.closest('[data-action="enrich-candidate"]');
      if (enrichBtn) { event.preventDefault(); enrichCandidate(enrichBtn.getAttribute('data-id'), enrichBtn); return; }
      var enrichTr = event.target && event.target.closest && event.target.closest('[data-action="enrich-track"]');
      if (enrichTr) { event.preventDefault(); enrichTrack(enrichTr.getAttribute('data-key'), enrichTr); return; }
      var playBtn = event.target && event.target.closest && event.target.closest('[data-action="track-play"]');
      if (playBtn) { event.preventDefault(); playTrackPreview(playBtn); return; }
      var openRel = event.target && event.target.closest && event.target.closest('[data-action="open-release"]');
      if (openRel) { event.preventDefault(); openReleaseDetail(openRel.getAttribute('data-id')); return; }
      /* Row checkboxes — capture via change too, but click bubbles first */
      var rowCheck = event.target && event.target.matches && event.target.matches('.admin-row-check');
      if (rowCheck) {
        toggleTrackSelect(event.target.getAttribute('data-key'), event.target.checked);
        return;
      }
    });
    if (state.token) {
      $('tokenInput').value = state.token;
      setTimeout(load, 100);
    } else {
      showAuthScreen();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
