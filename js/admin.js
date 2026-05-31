(function () {
  var tokenKey = 'vertax-admin-token';
  var state = {
    token: sessionStorage.getItem(tokenKey) || '',
    data: null,
    candidates: { rows: [], offset: 0, limit: 50, total: 0, sortBy: 'updated_at', sortDir: 'desc' },
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
    renderHtmlTable($('seedConfigTable'), ['Label', 'Family', 'Count', 'Action'],
      seedLabels.map(function (label) {
        return [
          esc(label.name) + (label.enabled ? '' : ' <span class="admin-muted">off</span>'),
          esc(label.genre_family),
          esc(label.current_family_count || 0),
          '<button class="admin-mini-button" type="button" data-action="seed-label" data-label-id="' +
            esc(label.discogs_label_id) + '" data-label-name="' + esc(label.name) +
            '" data-genre-family="' + esc(label.genre_family) + '">Seed 5</button>',
        ];
      }));
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
    /* Sortable headers */
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
      var seedBtn = event.target && event.target.closest && event.target.closest('[data-action="seed-label"]');
      if (seedBtn) { event.preventDefault(); seedLabel(seedBtn); return; }
      var enrichBtn = event.target && event.target.closest && event.target.closest('[data-action="enrich-candidate"]');
      if (enrichBtn) { event.preventDefault(); enrichCandidate(enrichBtn.getAttribute('data-id'), enrichBtn); return; }
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
