const crypto = require('crypto');
const {
  getPublicRelease,
  listAllPublicReleases,
  listPublicReleases,
  releaseSlug,
  syncPublicCatalogBatch,
} = require('../lib/public-catalog');

const SITE_URL = 'https://vertax.live';
const TELEGRAM_APP_URL = 'https://t.me/vertaksbot/app';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function safeHttpUrl(value, fallback) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback;
  } catch (_) {
    return fallback;
  }
}

function queryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function requestUrl(req) {
  return new URL(req.url || '/', SITE_URL);
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendHtml(res, status, html, cacheControl) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    cacheControl || 'public, s-maxage=3600, stale-while-revalidate=86400'
  );
  res.end(html);
}

function sendXml(res, status, xml) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(xml);
}

function sendJson(res, status, body) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isCronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '');
  const authorization = String(req.headers && req.headers.authorization || '');
  const expected = 'Bearer ' + secret;
  if (!secret || authorization.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

function redirect(res, location) {
  setCommonHeaders(res);
  res.statusCode = 308;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.end();
}

function dotMark() {
  let dots = '';
  for (let index = 0; index < 36; index += 1) {
    const accent = index === 5 || index === 14 || index === 30;
    dots += '<i' + (accent ? ' class="accent"' : '') + '></i>';
  }
  return '<span class="music-dotmark" aria-hidden="true">' + dots + '</span>';
}

function pageHeader() {
  return (
    '<header class="music-header">' +
      '<a class="music-brand" href="/" aria-label="VERTAX — открыть приложение">' +
        dotMark() +
        '<span><strong>VERTAX-01</strong><small>DIG. PLAY. SHARE.</small></span>' +
      '</a>' +
      '<nav aria-label="Основная навигация">' +
        '<a href="/music">Каталог</a>' +
        '<a href="/about">О проекте</a>' +
        '<a class="music-nav-cta" href="' + TELEGRAM_APP_URL + '" target="_blank" rel="noopener noreferrer">Открыть в Telegram</a>' +
      '</nav>' +
    '</header>'
  );
}

function pageFooter() {
  return (
    '<footer class="music-footer">' +
      '<div><strong>VERTAX-01</strong><span>Инструмент для виниловых DJ: коллекция, BPM, Camelot и сборка сетов.</span></div>' +
      '<div class="music-footer-links">' +
        '<a href="/">Веб-приложение</a>' +
        '<a href="' + TELEGRAM_APP_URL + '" target="_blank" rel="noopener noreferrer">Telegram Mini App</a>' +
        '<a href="/about">О проекте</a>' +
      '</div>' +
    '</footer>'
  );
}

function documentShell(options) {
  const title = options.title;
  const description = options.description;
  const canonical = options.canonical;
  const image = options.image || SITE_URL + '/assets/og-vertax.svg';
  const robots = options.robots || 'index, follow';
  const jsonLd = options.jsonLd
    ? '<script type="application/ld+json">' + safeJson(options.jsonLd) + '</script>'
    : '';
  return (
    '<!doctype html>' +
    '<html lang="ru">' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<meta name="description" content="' + escapeHtml(description) + '">' +
      '<meta name="robots" content="' + escapeHtml(robots) + '">' +
      '<meta name="theme-color" content="#0b0d0c">' +
      '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
      '<link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg">' +
      '<link rel="preload" href="/fonts/ShareTechMono-Regular.woff2" as="font" type="font/woff2" crossorigin>' +
      '<link rel="stylesheet" href="/music.css">' +
      '<meta property="og:type" content="' + escapeHtml(options.ogType || 'website') + '">' +
      '<meta property="og:site_name" content="VERTAX">' +
      '<meta property="og:url" content="' + escapeHtml(canonical) + '">' +
      '<meta property="og:title" content="' + escapeHtml(title) + '">' +
      '<meta property="og:description" content="' + escapeHtml(description) + '">' +
      '<meta property="og:image" content="' + escapeHtml(image) + '">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta name="twitter:title" content="' + escapeHtml(title) + '">' +
      '<meta name="twitter:description" content="' + escapeHtml(description) + '">' +
      '<meta name="twitter:image" content="' + escapeHtml(image) + '">' +
      jsonLd +
    '</head>' +
    '<body>' +
      '<div class="music-shell">' +
        pageHeader() +
        '<main>' + options.body + '</main>' +
        pageFooter() +
      '</div>' +
      '<noscript><img src="https://mc.yandex.ru/watch/109258707" class="music-metrika" alt=""></noscript>' +
      '<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=109258707","ym");ym(109258707,"init",{clickmap:true,accurateTrackBounce:true,trackLinks:true});</script>' +
    '</body>' +
    '</html>'
  );
}

function formatMeta(release) {
  return [
    release.label,
    release.catalog_number,
    release.year,
    (release.genres || []).concat(release.styles || []).slice(0, 3).join(' / '),
  ].filter(Boolean);
}

function releaseDescription(release) {
  const tracks = release.tracks || [];
  const bpmCount = tracks.filter((track) => track.bpm).length;
  const camelotCount = tracks.filter((track) => track.camelot).length;
  return [
    release.artist + ' — ' + release.title + '.',
    'Треклист пластинки' + (release.label ? ' на ' + release.label : '') + '.',
    bpmCount ? 'BPM определён для ' + bpmCount + ' треков.' : '',
    camelotCount ? 'Camelot определён для ' + camelotCount + ' треков.' : '',
    'Данные для подготовки винилового DJ-сета в VERTAX.',
  ].filter(Boolean).join(' ');
}

function trackRows(release) {
  return (release.tracks || []).map((track) => {
    const bpm = track.bpm
      ? '<strong class="music-bpm">' + escapeHtml(track.bpm) + '</strong><small>BPM</small>'
      : '<span class="music-empty">—</span>';
    const camelot = track.camelot
      ? '<strong class="music-camelot">' + escapeHtml(track.camelot) + '</strong>'
      : '<span class="music-empty">—</span>';
    return (
      '<tr>' +
        '<td class="music-position">' + escapeHtml(track.position || '—') + '</td>' +
        '<td class="music-track-title">' +
          '<strong>' + escapeHtml(track.title) + '</strong>' +
          (track.artist && track.artist !== release.artist
            ? '<small>' + escapeHtml(track.artist) + '</small>'
            : '') +
        '</td>' +
        '<td class="music-duration">' + escapeHtml(track.duration || '—') + '</td>' +
        '<td class="music-track-bpm">' + bpm + '</td>' +
        '<td class="music-track-key">' + camelot + '</td>' +
      '</tr>'
    );
  }).join('');
}

function musicRecordingSchema(release, track) {
  const recording = {
    '@type': 'MusicRecording',
    name: track.title,
    byArtist: {
      '@type': 'MusicGroup',
      name: track.artist || release.artist,
    },
  };
  if (track.duration) recording.duration = durationToIso(track.duration);
  const properties = [];
  if (track.bpm) properties.push({ '@type': 'PropertyValue', name: 'BPM', value: track.bpm });
  if (track.camelot) properties.push({ '@type': 'PropertyValue', name: 'Camelot', value: track.camelot });
  if (properties.length) recording.additionalProperty = properties;
  return recording;
}

function durationToIso(value) {
  const parts = String(value || '').split(':').map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 2) return 'PT' + parts[0] + 'M' + parts[1] + 'S';
  if (parts.length === 3) return 'PT' + parts[0] + 'H' + parts[1] + 'M' + parts[2] + 'S';
  return undefined;
}

function renderReleasePage(release) {
  const slug = release.slug || releaseSlug(release);
  const canonical = SITE_URL + '/music/' + encodeURIComponent(slug);
  const title = release.artist + ' — ' + release.title + ': BPM и Camelot треков | VERTAX';
  const description = releaseDescription(release);
  const meta = formatMeta(release);
  const discogsUrl = safeHttpUrl(
    release.discogs_url,
    'https://www.discogs.com/release/' + release.discogs_id
  );
  const coverUrl = safeHttpUrl(release.cover_url, null);
  const genres = (release.genres || []).concat(release.styles || []);
  const body =
    '<nav class="music-breadcrumbs" aria-label="Хлебные крошки">' +
      '<a href="/">VERTAX</a><span>/</span><a href="/music">Каталог</a><span>/</span><span>' + escapeHtml(release.title) + '</span>' +
    '</nav>' +
    '<article class="music-release">' +
      '<section class="music-release-head">' +
        '<div class="music-cover">' +
          (coverUrl
            ? '<img src="' + escapeHtml(coverUrl) + '" alt="Обложка ' + escapeHtml(release.artist + ' — ' + release.title) + '" loading="eager" referrerpolicy="no-referrer">'
            : '<span>NO COVER</span>') +
        '</div>' +
        '<div class="music-release-copy">' +
          '<p class="music-eyebrow">VINYL RELEASE · BPM / CAMELOT</p>' +
          '<h1>' + escapeHtml(release.title) + '</h1>' +
          '<p class="music-artist">' + escapeHtml(release.artist) + '</p>' +
          (meta.length
            ? '<ul class="music-meta">' + meta.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
            : '') +
          (genres.length
            ? '<div class="music-tags">' + genres.map((item) => '<span>' + escapeHtml(item) + '</span>').join('') + '</div>'
            : '') +
          '<div class="music-release-actions">' +
            '<a class="music-btn music-btn-primary" href="/" aria-label="Открыть VERTAX">Открыть VERTAX</a>' +
            '<a class="music-btn" href="' + TELEGRAM_APP_URL + '" target="_blank" rel="noopener noreferrer">Запустить в Telegram</a>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="music-tracklist" aria-labelledby="tracklist-title">' +
        '<div class="music-section-head">' +
          '<div><p class="music-eyebrow">TRACKLIST</p><h2 id="tracklist-title">Треки пластинки</h2></div>' +
          '<span>' + escapeHtml((release.tracks || []).length) + ' трек.</span>' +
        '</div>' +
        '<div class="music-table-wrap">' +
          '<table>' +
            '<thead><tr><th>Поз.</th><th>Название</th><th>Время</th><th>BPM</th><th>Camelot</th></tr></thead>' +
            '<tbody>' + trackRows(release) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>' +
      '<aside class="music-about-card">' +
        '<div><p class="music-eyebrow">ABOUT VERTAX</p><h2>От пластинки к готовому сету</h2></div>' +
        '<p>VERTAX помогает виниловым DJ вести коллекцию, определять BPM и Camelot, проверять совместимость треков и собирать DJ-сеты.</p>' +
        '<a href="/about">Узнать о проекте →</a>' +
      '</aside>' +
      '<p class="music-source">Информация о релизе и обложка получены из <a href="' + escapeHtml(discogsUrl) + '" target="_blank" rel="noopener noreferrer">Discogs</a>. BPM и Camelot могут содержать автоматические или проверенные вручную значения.</p>' +
    '</article>';

  const albumSchema = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: release.title,
    url: canonical,
    image: coverUrl || undefined,
    datePublished: release.year || undefined,
    byArtist: {
      '@type': 'MusicGroup',
      name: release.artist,
    },
    recordLabel: release.label || undefined,
    genre: genres.length ? genres : undefined,
    numTracks: (release.tracks || []).length,
    track: (release.tracks || []).map((track) => musicRecordingSchema(release, track)),
    sameAs: [discogsUrl],
  };

  return documentShell({
    title,
    description,
    canonical,
    image: coverUrl,
    ogType: 'music.album',
    jsonLd: albumSchema,
    body,
  });
}

function catalogCard(release) {
  const url = '/music/' + encodeURIComponent(release.slug || releaseSlug(release));
  const meta = formatMeta(release).slice(0, 3);
  const bpmCount = (release.tracks || []).filter((track) => track.bpm).length;
  const camelotCount = (release.tracks || []).filter((track) => track.camelot).length;
  const coverUrl = safeHttpUrl(release.cover_url, null);
  return (
    '<article class="music-card">' +
      '<a class="music-card-cover" href="' + url + '" aria-label="' + escapeHtml(release.artist + ' — ' + release.title) + '">' +
        (coverUrl
          ? '<img src="' + escapeHtml(coverUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
          : '<span>VINYL</span>') +
      '</a>' +
      '<div class="music-card-copy">' +
        '<p class="music-eyebrow">' + escapeHtml(meta.join(' · ')) + '</p>' +
        '<h2><a href="' + url + '">' + escapeHtml(release.title) + '</a></h2>' +
        '<p class="music-card-artist">' + escapeHtml(release.artist) + '</p>' +
        '<div class="music-card-stats">' +
          '<span>' + escapeHtml((release.tracks || []).length) + ' трек.</span>' +
          '<span>BPM ' + escapeHtml(bpmCount) + '</span>' +
          '<span>Camelot ' + escapeHtml(camelotCount) + '</span>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

function pageLink(page, label, current, query) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (query) params.set('q', query);
  const href = '/music' + (params.toString() ? '?' + params.toString() : '');
  return '<a href="' + escapeHtml(href) + '"' + (current ? ' aria-current="page"' : '') + '>' + escapeHtml(label) + '</a>';
}

function renderCatalogPage(result) {
  const page = result.page;
  const query = result.q;
  const canonical = SITE_URL + '/music' + (page > 1 ? '?page=' + page : '');
  const title = page > 1
    ? 'Каталог винила: BPM и Camelot — страница ' + page + ' | VERTAX'
    : 'Каталог винила с BPM и Camelot | VERTAX';
  const description = 'Пластинки и треклисты с определёнными BPM и Camelot. Каталог VERTAX для подготовки виниловых DJ-сетов.';
  const pages = [];
  const first = Math.max(1, page - 2);
  const last = Math.min(result.page_count, page + 2);
  if (page > 1) pages.push(pageLink(page - 1, '←', false, query));
  for (let index = first; index <= last; index += 1) {
    pages.push(pageLink(index, String(index), index === page, query));
  }
  if (page < result.page_count) pages.push(pageLink(page + 1, '→', false, query));

  const body =
    '<section class="music-catalog-hero">' +
      '<p class="music-eyebrow">VERTAX MUSIC DATABASE</p>' +
      '<h1>Пластинки, BPM и Camelot</h1>' +
      '<p>Публичный каталог определённых треклистов из базы VERTAX. Данные помогают оценить темп и гармоническую совместимость пластинок перед сборкой DJ-сета.</p>' +
      '<form class="music-search" action="/music" method="get" role="search">' +
        '<label for="music-q">Поиск по артисту, релизу, лейблу или каталогу</label>' +
        '<div><input id="music-q" name="q" value="' + escapeHtml(query) + '" placeholder="Calibre, Hyperdub, SIGLP010…"><button type="submit">Найти</button></div>' +
      '</form>' +
    '</section>' +
    '<div class="music-catalog-summary"><span>Найдено: ' + escapeHtml(result.total) + '</span><span>Страница ' + escapeHtml(page) + ' / ' + escapeHtml(result.page_count) + '</span></div>' +
    (result.releases.length
      ? '<section class="music-grid" aria-label="Каталог пластинок">' + result.releases.map(catalogCard).join('') + '</section>'
      : '<section class="music-empty-state"><h2>Ничего не найдено</h2><p>Попробуйте изменить запрос или вернуться ко всему каталогу.</p><a href="/music">Показать все пластинки</a></section>') +
    (pages.length ? '<nav class="music-pagination" aria-label="Страницы каталога">' + pages.join('') + '</nav>' : '') +
    '<section class="music-catalog-cta"><div><p class="music-eyebrow">BUILD YOUR SET</p><h2>Эти данные работают внутри VERTAX</h2><p>Добавляйте свои пластинки, исправляйте BPM/Camelot и собирайте совместимые сеты.</p></div><a class="music-btn music-btn-primary" href="' + TELEGRAM_APP_URL + '" target="_blank" rel="noopener noreferrer">Запустить в Telegram</a></section>';

  return documentShell({
    title,
    description,
    canonical,
    robots: query ? 'noindex, follow' : 'index, follow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Каталог винила VERTAX',
      description,
      url: canonical,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: result.total,
        itemListElement: result.releases.map((release, index) => ({
          '@type': 'ListItem',
          position: (page - 1) * result.limit + index + 1,
          url: SITE_URL + '/music/' + encodeURIComponent(release.slug || releaseSlug(release)),
          name: release.artist + ' — ' + release.title,
        })),
      },
    },
    body,
  });
}

function renderNotFoundPage() {
  return documentShell({
    title: 'Пластинка не найдена | VERTAX',
    description: 'Такой страницы пластинки пока нет в публичном каталоге VERTAX.',
    canonical: SITE_URL + '/music',
    robots: 'noindex, follow',
    body:
      '<section class="music-empty-state music-not-found"><p class="music-eyebrow">404</p><h1>Пластинка не найдена</h1><p>Возможно, адрес изменился или релиз ещё не попал в публичный каталог.</p><a class="music-btn music-btn-primary" href="/music">Открыть каталог</a></section>',
  });
}

function extractReleaseId(pathname) {
  const match = String(pathname || '').match(/-(\d+)\/?$/);
  return match ? match[1] : null;
}

async function renderSitemap() {
  const releases = await listAllPublicReleases();
  const urls = [
    {
      loc: SITE_URL + '/music',
      lastmod: new Date().toISOString().slice(0, 10),
    },
  ].concat(releases.map((release) => ({
    loc: SITE_URL + '/music/' + encodeURIComponent(release.slug || releaseSlug(release)),
    lastmod: String(release.updated_at || release.ingested_at || new Date().toISOString()).slice(0, 10),
    image: release.cover_url || null,
    imageTitle: release.artist + ' — ' + release.title,
  })));
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' +
      urls.map((item) =>
        '<url><loc>' + escapeXml(item.loc) + '</loc>' +
        '<lastmod>' + escapeXml(item.lastmod) + '</lastmod>' +
        (item.image
          ? '<image:image><image:loc>' + escapeXml(item.image) + '</image:loc><image:title>' + escapeXml(item.imageTitle) + '</image:title></image:image>'
          : '') +
        '</url>'
      ).join('') +
    '</urlset>'
  );
}

async function catalogHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end();
    return;
  }
  const url = requestUrl(req);
  const task = queryValue(req.query && req.query.task) || url.searchParams.get('task');
  if (task === 'sync') {
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    try {
      const result = await syncPublicCatalogBatch({
        limit: 15,
        missing_only: true,
      });
      sendJson(res, 200, result);
    } catch (error) {
      console.error('Catalog sync failed:', error && error.message ? error.message : error);
      sendJson(res, 500, {
        ok: false,
        error: error && error.message ? error.message : 'catalog_sync_failed',
      });
    }
    return;
  }
  const format = queryValue(req.query && req.query.format) || url.searchParams.get('format');
  if (format === 'sitemap') {
    const xml = await renderSitemap();
    if (req.method === 'HEAD') {
      setCommonHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.end();
      return;
    }
    sendXml(res, 200, xml);
    return;
  }

  const pathValue = queryValue(req.query && req.query.path) || url.searchParams.get('path') || '';
  const path = decodeURIComponent(String(pathValue || '').replace(/^\/+|\/+$/g, ''));
  if (!path) {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const q = url.searchParams.get('q') || '';
    const result = await listPublicReleases({ page, limit: 24, q });
    if (page > result.page_count && result.total) {
      redirect(res, '/music?page=' + result.page_count);
      return;
    }
    const html = renderCatalogPage(result);
    if (req.method === 'HEAD') {
      setCommonHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end();
      return;
    }
    sendHtml(res, 200, html, q ? 'no-store' : undefined);
    return;
  }

  const releaseId = extractReleaseId(path);
  const release = releaseId ? await getPublicRelease(releaseId) : null;
  if (!release || !release.tracks || !release.tracks.length) {
    sendHtml(res, 404, renderNotFoundPage(), 'no-store');
    return;
  }
  const canonicalPath = release.slug || releaseSlug(release);
  if (path !== canonicalPath) {
    redirect(res, '/music/' + encodeURIComponent(canonicalPath));
    return;
  }
  const html = renderReleasePage(release);
  if (req.method === 'HEAD') {
    setCommonHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end();
    return;
  }
  sendHtml(res, 200, html, 'public, s-maxage=86400, stale-while-revalidate=604800');
}

module.exports = async function handler(req, res) {
  try {
    await catalogHandler(req, res);
  } catch (error) {
    console.error('Public catalog failed:', error && error.message ? error.message : error);
    sendHtml(
      res,
      503,
      documentShell({
        title: 'Каталог временно недоступен | VERTAX',
        description: 'Публичный каталог VERTAX временно недоступен.',
        canonical: SITE_URL + '/music',
        robots: 'noindex, follow',
        body:
          '<section class="music-empty-state music-not-found"><p class="music-eyebrow">SERVICE</p><h1>Каталог временно недоступен</h1><p>Приложение продолжает работать. Попробуйте открыть каталог чуть позже.</p><a class="music-btn music-btn-primary" href="/">Открыть VERTAX</a></section>',
      }),
      'no-store'
    );
  }
};

module.exports.renderReleasePage = renderReleasePage;
module.exports.renderCatalogPage = renderCatalogPage;
module.exports.renderNotFoundPage = renderNotFoundPage;
module.exports.renderSitemap = renderSitemap;
