(function installPublicDiscogsImport() {
  'use strict';

  var form = document.getElementById('music-discogs-import');
  if (!form) return;

  var input = document.getElementById('music-discogs-username');
  var button = form.querySelector('button[type="submit"]');
  var progressWrap = form.querySelector('.music-discogs-progress');
  var progress = progressWrap.querySelector('progress');
  var status = progressWrap.querySelector('[role="status"]');
  var locale = String(document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  var messages = {
    ru: { busy: 'Загружаем…', missing: 'Профиль не найден или коллекция закрыта.', unavailable: 'Discogs временно не ответил. Попробуйте позже.', saveError: 'Не удалось сохранить пакет релизов.', reading: 'Читаем публичную коллекцию Discogs…', loaded: 'Загружена страница {page} из {pages}. Винила: {count}', none: 'В публичной коллекции не найдено виниловых релизов.', adding: 'Добавляем в общую базу: {count} из {total}', done: 'Готово: {count} пластинок добавлено или обновлено. Треклисты, BPM и Camelot догрузятся автоматически.', failed: 'Импорт не удался. Попробуйте ещё раз.' },
    en: { busy: 'Loading…', missing: 'Profile not found or the collection is private.', unavailable: 'Discogs is temporarily unavailable. Please try again later.', saveError: 'Could not save this batch of releases.', reading: 'Reading the public Discogs collection…', loaded: 'Loaded page {page} of {pages}. Vinyl releases: {count}', none: 'No vinyl releases were found in this public collection.', adding: 'Adding to the shared catalog: {count} of {total}', done: 'Done: {count} records added or updated. Tracklists, BPM and Camelot will be enriched automatically.', failed: 'Import failed. Please try again.' },
    es: { busy: 'Cargando…', missing: 'No se encontró el perfil o la colección es privada.', unavailable: 'Discogs no está disponible temporalmente. Inténtalo más tarde.', saveError: 'No se pudo guardar este lote de lanzamientos.', reading: 'Leyendo la colección pública de Discogs…', loaded: 'Página {page} de {pages} cargada. Vinilos: {count}', none: 'No se encontraron vinilos en esta colección pública.', adding: 'Añadiendo al catálogo común: {count} de {total}', done: 'Listo: {count} discos añadidos o actualizados. Los tracklists, BPM y Camelot se completarán automáticamente.', failed: 'La importación ha fallado. Inténtalo de nuevo.' },
    ja: { busy: '読み込み中…', missing: 'プロフィールが見つからないか、コレクションが非公開です。', unavailable: 'Discogsは一時的に利用できません。後でもう一度お試しください。', saveError: 'リリースを保存できませんでした。', reading: '公開Discogsコレクションを読み込んでいます…', loaded: '{pages}ページ中{page}ページを読み込みました。レコード: {count}', none: '公開コレクションにレコードが見つかりませんでした。', adding: '共有カタログに追加中: {total}件中{count}件', done: '完了: {count}件のレコードを追加または更新しました。トラックリスト、BPM、Camelotは自動的に補完されます。', failed: 'インポートに失敗しました。もう一度お試しください。' },
    zh: { busy: '正在加载…', missing: '未找到该用户，或收藏为私密状态。', unavailable: 'Discogs暂时不可用，请稍后再试。', saveError: '无法保存这批发行。', reading: '正在读取公开Discogs收藏…', loaded: '已加载第{page}/{pages}页。黑胶: {count}', none: '该公开收藏中没有找到黑胶发行。', adding: '正在加入公共目录: {count}/{total}', done: '完成: 已添加或更新{count}张唱片。曲目表、BPM与Camelot将自动补全。', failed: '导入失败，请重试。' },
  };
  var copy = messages[locale] || messages.ru;
  var idleButtonText = button.textContent;

  function message(key, values) {
    return String(copy[key] || messages.ru[key] || '').replace(/\{(\w+)\}/g, function (_, name) {
      return values && values[name] != null ? String(values[name]) : '';
    });
  }

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
    button.textContent = busy ? message('busy') : idleButtonText;
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
        ? message('missing')
        : message('unavailable'));
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
    if (!response.ok || !body.ok) throw new Error(body.message || message('saveError'));
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
    setStatus(message('reading'), 0, 1);
    try {
      var first = await collectionPage(username, 1);
      var pages = Math.max(1, Number(first.pagination && first.pagination.pages) || 1);
      var releases = (first.releases || []).filter(isVinyl);
      setStatus(message('loaded', { page: 1, pages: pages, count: releases.length }), 1, pages);

      for (var page = 2; page <= pages; page += 1) {
        var data = await collectionPage(username, page);
        releases = releases.concat((data.releases || []).filter(isVinyl));
        setStatus(
          message('loaded', { page: page, pages: pages, count: releases.length }),
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
      if (!vinyls.length) throw new Error(message('none'));

      var saved = 0;
      for (var offset = 0; offset < vinyls.length; offset += 20) {
        var batch = vinyls.slice(offset, offset + 20);
        var result = await sendBatch(batch);
        saved += Number(result.releases_saved) || 0;
        setStatus(
          message('adding', { count: Math.min(offset + batch.length, vinyls.length), total: vinyls.length }),
          Math.min(offset + batch.length, vinyls.length),
          vinyls.length
        );
      }

      setStatus(
        message('done', { count: saved }),
        vinyls.length,
        vinyls.length,
        'success'
      );
    } catch (error) {
      setStatus(error && error.message ? error.message : message('failed'), 0, 1, 'error');
    } finally {
      setBusy(false);
    }
  });
})();
