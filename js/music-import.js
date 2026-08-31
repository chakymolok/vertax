(function installPublicDiscogsImport() {
  'use strict';

  var form = document.getElementById('music-discogs-import');
  if (!form) return;

  var input = document.getElementById('music-discogs-username');
  var button = form.querySelector('button[type="submit"]');
  var progressWrap = form.querySelector('.music-discogs-progress');
  var progress = progressWrap.querySelector('progress');
  var status = progressWrap.querySelector('[role="status"]');

  function setStatus(message, value, max, state) {
    progressWrap.hidden = false;
    status.textContent = message;
    progress.max = Math.max(1, Number(max) || 1);
    progress.value = Math.max(0, Math.min(progress.max, Number(value) || 0));
    progressWrap.dataset.state = state || 'working';
  }

  function setBusy(busy) {
    input.disabled = busy;
    button.disabled = busy;
    button.textContent = busy ? 'Загружаем…' : 'Добавить в базу';
  }

  function clientId() {
    try {
      var key = 'vertax_uid';
      var value = localStorage.getItem(key);
      if (!value) {
        value = window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return '';
    }
  }

  function isVinyl(item) {
    var formats = item && item.basic_information && item.basic_information.formats || [];
    var text = formats.map(function (format) {
      return [format && format.name]
        .concat(format && format.descriptions || [])
        .filter(Boolean)
        .join(' ');
    }).join(' ').toLowerCase();
    return text.indexOf('vinyl') >= 0 && text.indexOf('cd') < 0;
  }

  function mapRelease(item) {
    var info = item && item.basic_information || {};
    var label = info.labels && info.labels[0] || {};
    var artists = (info.artists || []).map(function (artist) {
      return String(artist && artist.name || '').replace(/\s\(\d+\)$/, '');
    }).filter(Boolean);
    return {
      discogsId: String(item && item.id || info.id || ''),
      artist: artists.join(', '),
      title: info.title || '',
      label: label.name || '',
      catno: label.catno || '',
      year: info.year || '',
      cover: info.cover_image || info.thumb || '',
      genre: info.genres || [],
      style: info.styles || [],
      tracklist: [],
    };
  }

  async function collectionPage(username, page) {
    var url = new URL('/api/discogs', window.location.origin);
    url.searchParams.set('action', 'collection');
    url.searchParams.set('username', username);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    var response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      var error = new Error(response.status === 403 || response.status === 404
        ? 'Профиль не найден или коллекция закрыта.'
        : 'Discogs временно не ответил. Попробуйте позже.');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function sendBatch(batch) {
    var id = clientId();
    var headers = { 'Content-Type': 'application/json' };
    if (id) headers['X-Vertax-Client-Id'] = id;
    var response = await fetch('/api/discogs-ingest', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ vinyls: batch, clientId: id }),
    });
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok || !body.ok) throw new Error(body.message || 'Не удалось сохранить пакет релизов.');
    return body;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var username = String(input.value || '').trim();
    if (!username) {
      input.focus();
      return;
    }

    setBusy(true);
    setStatus('Читаем публичную коллекцию Discogs…', 0, 1);
    try {
      var first = await collectionPage(username, 1);
      var pages = Math.max(1, Number(first.pagination && first.pagination.pages) || 1);
      var releases = (first.releases || []).filter(isVinyl);
      setStatus('Загружена страница 1 из ' + pages + '. Винила: ' + releases.length, 1, pages);

      for (var page = 2; page <= pages; page += 1) {
        var data = await collectionPage(username, page);
        releases = releases.concat((data.releases || []).filter(isVinyl));
        setStatus(
          'Загружена страница ' + page + ' из ' + pages + '. Винила: ' + releases.length,
          page,
          pages
        );
      }

      var unique = {};
      var vinyls = releases.map(mapRelease).filter(function (release) {
        if (!release.discogsId || !release.title || unique[release.discogsId]) return false;
        unique[release.discogsId] = true;
        return true;
      });
      if (!vinyls.length) throw new Error('В публичной коллекции не найдено виниловых релизов.');

      var saved = 0;
      for (var offset = 0; offset < vinyls.length; offset += 20) {
        var batch = vinyls.slice(offset, offset + 20);
        var result = await sendBatch(batch);
        saved += Number(result.releases_saved) || 0;
        setStatus(
          'Добавляем в общую базу: ' + Math.min(offset + batch.length, vinyls.length) + ' из ' + vinyls.length,
          Math.min(offset + batch.length, vinyls.length),
          vinyls.length
        );
      }

      setStatus(
        'Готово: ' + saved + ' пластинок добавлено или обновлено. Треклисты, BPM и Camelot догрузятся автоматически.',
        vinyls.length,
        vinyls.length,
        'success'
      );
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Импорт не удался. Попробуйте ещё раз.', 0, 1, 'error');
    } finally {
      setBusy(false);
    }
  });
})();
