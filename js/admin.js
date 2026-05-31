(function () {
  var tokenKey = 'vertax-admin-token';
  var state = {
    token: sessionStorage.getItem(tokenKey) || '',
    data: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

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
    var json = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || json.message || 'HTTP ' + response.status);
    }
    return json;
  }

  function showError(message) {
    var box = $('errorBox');
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
  }

  function fmt(value) {
    if (value == null || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString('ru-RU');
    return String(value);
  }

  function dateShort(value) {
    var time = Date.parse(value || '');
    if (!time) return '-';
    return new Date(time).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function entries(obj, limit) {
    return Object.keys(obj || {})
      .map(function (key) {
        return { name: key, count: Number(obj[key]) || 0 };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, limit || 12);
  }

  function renderStats(data) {
    var candidates = data.candidates || {};
    var redis = data.redis || {};
    var users = data.users || {};
    var metadata = candidates.metadata || {};
    var stats = [
      ['Candidate releases', candidates.total_candidates || 0, 'общая база пластинок'],
      ['BPM/Key cache', redis.total_tracks || 0, 'постоянные track:* записи'],
      ['Visible users', users.collection_index_users || 0, 'через server-side анализ'],
      [
        'Coverage',
        Math.round((metadata.avg_metadata_coverage || 0) * 100) + '%',
        'среднее BPM/Key',
      ],
      ['With covers', metadata.with_cover || 0, 'релизы с обложками'],
      ['With marketplace', metadata.with_marketplace || 0, 'есть цена Discogs'],
      ['Collection indexes', users.collection_index_count || 0, 'temporary TTL cache'],
      ['Pending proposals', data.proposals ? data.proposals.pending_count : 0, 'ручные правки'],
    ];
    $('statsGrid').innerHTML = stats
      .map(function (item) {
        return (
          '<article class="admin-stat"><span>' +
          esc(item[0]) +
          '</span><strong>' +
          esc(item[1]) +
          '</strong><span>' +
          esc(item[2]) +
          '</span></article>'
        );
      })
      .join('');
  }

  function renderBars(target, rows) {
    var max = rows.reduce(function (m, row) {
      return Math.max(m, row.count);
    }, 1);
    target.innerHTML = rows.length
      ? rows
          .map(function (row) {
            return (
              '<div class="admin-bar"><span>' +
              esc(row.name) +
              '</span><div class="admin-bar-track"><div class="admin-bar-fill" style="--value:' +
              row.count / max +
              '"></div></div><strong>' +
              esc(row.count) +
              '</strong></div>'
            );
          })
          .join('')
      : '<p class="admin-release-meta">Пока нет данных.</p>';
  }

  function renderTable(target, headers, rows) {
    target.innerHTML =
      '<thead><tr>' +
      headers
        .map(function (head) {
          return '<th>' + esc(head) + '</th>';
        })
        .join('') +
      '</tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            '<tr>' +
            row
              .map(function (cell) {
                return '<td>' + esc(cell) + '</td>';
              })
              .join('') +
            '</tr>'
          );
        })
        .join('') +
      '</tbody>';
  }

  function renderCandidates(items) {
    $('recentTotal').textContent = (items || []).length + ' shown';
    $('recentCandidates').innerHTML = (items || []).length
      ? items
          .map(function (item) {
            var cover = item.cover_url
              ? '<img src="' + esc(item.cover_url) + '" alt="">'
              : '<div class="admin-release-cover"></div>';
            return (
              '<article class="admin-release">' +
              cover +
              '<div><div class="admin-release-title">' +
              esc(item.artist || '') +
              ' - ' +
              esc(item.title || '') +
              '</div><div class="admin-release-meta">' +
              esc([item.label, item.year, item.catalog_number].filter(Boolean).join(' · ')) +
              '</div><div class="admin-release-small">' +
              esc(item.genre_family || 'other') +
              ' · ' +
              esc(item.enriched_track_count || 0) +
              '/' +
              esc(item.track_count || 0) +
              ' meta · updated ' +
              esc(dateShort(item.updated_at)) +
              '</div></div></article>'
            );
          })
          .join('')
      : '<p class="admin-release-meta">Пока нет candidates.</p>';
  }

  function render(data) {
    state.data = data;
    $('authPanel').hidden = true;
    renderStats(data);
    var candidates = data.candidates || {};
    var genres = entries(candidates.by_genre_family, 14);
    var bpms = entries(candidates.by_bpm_bucket, 14);
    $('genreTotal').textContent = fmt(candidates.total_candidates || 0) + ' total';
    renderBars($('genreBars'), genres);
    renderBars($('bpmBars'), bpms);
    var labels = (candidates.by_label_top || []).slice(0, 20);
    $('labelTotal').textContent = labels.length + ' shown';
    renderTable(
      $('labelTable'),
      ['Лейбл', 'Релизов'],
      labels.map(function (item) {
        return [item.label, item.count];
      })
    );
    var seed = (data.seed && data.seed.labels) || [];
    renderTable(
      $('seedTable'),
      ['Лейбл', 'Offset', 'Saved', 'Updated', 'Last run'],
      seed.map(function (item) {
        return [
          item.label_name || item.label_id,
          item.last_offset || 0,
          item.total_saved || 0,
          item.total_updated || 0,
          dateShort(item.last_run_at),
        ];
      })
    );
    renderCandidates(data.recent_candidates || []);
  }

  async function load() {
    showError('');
    $('refreshBtn').disabled = true;
    try {
      var data = await adminPost('admin_overview');
      render(data);
    } catch (error) {
      $('authPanel').hidden = false;
      showError(
        error.message === 'unauthorized' ? 'Нужен Telegram admin или ADMIN_TOKEN.' : error.message
      );
    } finally {
      $('refreshBtn').disabled = false;
    }
  }

  function boot() {
    $('refreshBtn').addEventListener('click', load);
    $('tokenForm').addEventListener('submit', function (event) {
      event.preventDefault();
      state.token = $('tokenInput').value.trim();
      if (state.token) sessionStorage.setItem(tokenKey, state.token);
      load();
    });
    if (state.token) $('tokenInput').value = state.token;
    setTimeout(load, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
