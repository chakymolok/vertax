import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const catalog = require('./api/catalog');
const discogsIngest = require('./api/discogs-ingest');
const { mergeDiscogsPayload } = require('./lib/redis-cache');
const { normalizePublicRelease, releaseSlug } = require('./lib/public-catalog');

const release = normalizePublicRelease(
  {
    discogsId: '5675416',
    artist: 'Calibre',
    title: 'Bellamee',
    label: 'Signature',
    catno: 'SIG001',
    year: 2014,
    genres: ['Electronic'],
    styles: ['Drum n Bass'],
    coverUrl: 'https://example.com/bellamee.jpg',
  },
  [
    {
      position: 'A1',
      artist_original: 'Calibre',
      title_original: 'Bellamee',
      duration: '5:12',
      bpm: 174,
      camelot: '9A',
      source: 'beatport',
    },
  ],
  { ingested_from: 'smoke' }
);

assert.ok(release, 'release should normalize');
assert.equal(release.discogs_id, '5675416');
assert.equal(release.tracks[0].bpm, 174);
assert.equal(release.tracks[0].camelot, '9A');
release.slug = releaseSlug(release);
release.updated_at = '2026-05-19T12:00:00.000Z';
release.ingested_at = '2026-05-01T12:00:00.000Z';

const detailHtml = catalog.renderReleasePage(release);
assert.match(detailHtml, /Calibre — Bellamee: BPM и Camelot треков/);
assert.match(
  detailHtml,
  /<link rel="canonical" href="https:\/\/vertax\.live\/music\/calibre-bellamee-5675416">/
);
assert.match(detailHtml, /"@type":"MusicAlbum"/);
assert.match(detailHtml, /174/);
assert.match(detailHtml, /9A/);
assert.match(detailHtml, /Открыть VERTAX/);
assert.match(detailHtml, /Запустить в Telegram/);
assert.match(detailHtml, /Discogs/);
assert.match(detailHtml, /<time datetime="2026-05-19T12:00:00.000Z">/);
const structured = JSON.parse(
  detailHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]
);
assert.equal(structured['@graph'][0].dateModified, release.updated_at);
assert.equal(structured['@graph'][1].track[0].duration, 'PT5M12S');
assert.equal(structured['@graph'][2]['@type'], 'BreadcrumbList');
assert.equal(
  structured['@graph'][2].itemListElement[2].item,
  'https://vertax.live/music/' + release.slug
);
assert.ok(
  detailHtml.includes('<p class="music-source">' + structured['@graph'][0].description + '</p>')
);
assert.match(
  detailHtml,
  /hreflang="en" href="https:\/\/vertax\.live\/en\/music\/calibre-bellamee-5675416"/
);
assert.match(
  detailHtml,
  /hreflang="es" href="https:\/\/vertax\.live\/es\/music\/calibre-bellamee-5675416"/
);
assert.match(
  detailHtml,
  /hreflang="ja" href="https:\/\/vertax\.live\/ja\/music\/calibre-bellamee-5675416"/
);
assert.match(
  detailHtml,
  /hreflang="zh-Hans" href="https:\/\/vertax\.live\/zh\/music\/calibre-bellamee-5675416"/
);

const englishDetailHtml = catalog.renderReleasePage(release, 'en');
assert.match(englishDetailHtml, /<html lang="en">/);
assert.match(englishDetailHtml, /Calibre — Bellamee: track BPM and Camelot/);
assert.match(
  englishDetailHtml,
  /canonical" href="https:\/\/vertax\.live\/en\/music\/calibre-bellamee-5675416"/
);
assert.match(englishDetailHtml, /Record tracklist/);

const spanishDetailHtml = catalog.renderReleasePage(release, 'es');
assert.match(spanishDetailHtml, /<html lang="es">/);
assert.match(spanishDetailHtml, /Tracklist del disco/);

const japaneseDetailHtml = catalog.renderReleasePage(release, 'ja');
assert.match(japaneseDetailHtml, /<html lang="ja">/);
assert.match(japaneseDetailHtml, /トラックリスト/);

const chineseDetailHtml = catalog.renderReleasePage(release, 'zh');
assert.match(chineseDetailHtml, /<html lang="zh-CN">/);
assert.match(chineseDetailHtml, /唱片曲目表/);
const unsafeHtml = catalog.renderReleasePage(
  Object.assign({}, release, {
    cover_url: 'javascript:alert(1)',
    discogs_url: 'javascript:alert(2)',
  })
);
assert.doesNotMatch(unsafeHtml, /javascript:/);

const queuedRelease = normalizePublicRelease(
  {
    discogsId: '10003',
    artist: 'Queued Artist',
    title: 'Queued Release',
    label: 'Queued Label',
  },
  [],
  { ingested_from: 'smoke' }
);
queuedRelease.slug = releaseSlug(queuedRelease);
const queuedHtml = catalog.renderReleasePage(queuedRelease);
assert.match(queuedHtml, /Треклист ожидает загрузки/);
assert.match(queuedHtml, /noindex, follow/);

const catalogHtml = catalog.renderCatalogPage({
  page: 1,
  limit: 24,
  q: '',
  total: 1,
  page_count: 1,
  releases: [release],
});
assert.match(catalogHtml, /Каталог винила с BPM и Camelot/);
assert.match(catalogHtml, /href="\/music\/calibre-bellamee-5675416"/);
assert.match(catalogHtml, /id="music-discogs-import"/);
assert.match(catalogHtml, /Добавить публичную коллекцию Discogs/);
assert.match(catalogHtml, /src="\/js\/music-import\.js"/);
assert.match(catalogHtml, /index, follow/);

const englishCatalogHtml = catalog.renderCatalogPage(
  {
    page: 1,
    limit: 24,
    q: '',
    total: 1,
    page_count: 1,
    releases: [release],
  },
  'en'
);
assert.match(englishCatalogHtml, /Vinyl records, BPM and Camelot/);
assert.match(englishCatalogHtml, /action="\/en\/music"/);
assert.match(englishCatalogHtml, /href="\/en\/music\/calibre-bellamee-5675416"/);

const searchHtml = catalog.renderCatalogPage({
  page: 1,
  limit: 24,
  q: 'Calibre',
  total: 1,
  page_count: 1,
  releases: [release],
});
assert.match(searchHtml, /noindex, follow/);

const notFoundHtml = catalog.renderNotFoundPage();
assert.match(notFoundHtml, /Пластинка не найдена/);
assert.match(notFoundHtml, /noindex, follow/);

const vercelConfig = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const sitemapPaths = ['/sitemap.xml', '/pages-sitemap.xml', '/music-sitemap.xml'];
for (const path of sitemapPaths) {
  assert.equal(
    vercelConfig.rewrites.find((route) => route.source === path)?.destination,
    '/api/catalog?format=sitemap',
    'All sitemap URLs must reach the same existing function'
  );
  assert.equal(
    existsSync(new URL('.' + path, import.meta.url)),
    false,
    'No static sitemap may shadow the route'
  );
  assert.equal(
    existsSync(new URL('./public' + path, import.meta.url)),
    false,
    'Build must remove obsolete static sitemaps'
  );
}
assert.deepEqual(
  readFileSync(new URL('./robots.txt', import.meta.url), 'utf8').match(/^Sitemap:.*$/gm),
  ['Sitemap: https://vertax.live/sitemap.xml']
);

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

// Exercise the HTTP handler without contacting or mutating production Redis.
const originalFetch = globalThis.fetch;
const redisEnvKeys = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];
const originalRedisEnv = Object.fromEntries(redisEnvKeys.map((key) => [key, process.env[key]]));
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
const records = new Map([
  ['vertax:public:release:' + release.discogs_id, JSON.stringify(release)],
  ['vertax:release:' + queuedRelease.discogs_id, JSON.stringify(queuedRelease)],
]);
const sets = {
  'vertax:public:releases': [release.discogs_id],
  'vertax:candidates:all': [queuedRelease.discogs_id],
};
let brokenCommand = '';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://redis.test');
  const [command, ...args] = JSON.parse(options.body);
  if (command === brokenCommand) return new Response('', { status: 503 });
  let result;
  if (command === 'SMEMBERS') result = sets[args[0]] || [];
  else if (command === 'MGET') result = args.map((key) => records.get(key) || null);
  else throw new Error('Unexpected catalog command: ' + command);
  return new Response(JSON.stringify({ result }));
};

try {
  const sitemap = await catalog.renderSitemap();
  assert.equal(
    (sitemap.match(/<url>/g) || []).length,
    12,
    'Homepage, about, and five locales for catalog and hydrated release'
  );
  assert.match(sitemap, /<urlset /);
  assert.doesNotMatch(sitemap, /<sitemapindex|<loc>[^<]*sitemap\.xml<\/loc>/);
  assert.match(sitemap, /<url><loc>https:\/\/vertax\.live\/<\/loc><\/url>/);
  assert.match(sitemap, /<url><loc>https:\/\/vertax\.live\/about<\/loc><\/url>/);
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locations).size, locations.length, 'No duplicate page URLs');
  assert.doesNotMatch(sitemap, /https:\/\/vertax\.live\/(en|es|ja|zh)\/about/);
  assert.match(sitemap, /<loc>https:\/\/vertax\.live\/music<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vertax\.live\/en\/music<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vertax\.live\/es\/music<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vertax\.live\/ja\/music<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/vertax\.live\/zh\/music<\/loc>/);
  assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(sitemap, /hreflang="x-default"/);
  assert.match(sitemap, /<lastmod>2026-05-19T12:00:00.000Z<\/lastmod>/);
  assert.doesNotMatch(sitemap, /queued-release/, 'Pending pages must not enter the sitemap');
  records.set(
    'vertax:public:release:' + release.discogs_id,
    JSON.stringify({ ...release, updated_at: 'invalid', ingested_at: null })
  );
  assert.doesNotMatch(
    await catalog.renderSitemap(),
    /<lastmod>/,
    'Unknown dates must not become today'
  );
  records.set('vertax:public:release:' + release.discogs_id, JSON.stringify(release));

  const catalogResponse = mockResponse();
  await catalog({ method: 'GET', url: '/api/catalog', query: {} }, catalogResponse);
  assert.equal(catalogResponse.statusCode, 200);
  assert.match(catalogResponse.headers['content-type'], /text\/html/);
  assert.match(catalogResponse.body, /Пластинки, BPM и Camelot/);

  const englishCatalogResponse = mockResponse();
  await catalog(
    { method: 'GET', url: '/api/catalog?lang=en', query: { lang: 'en' } },
    englishCatalogResponse
  );
  assert.equal(englishCatalogResponse.statusCode, 200);
  assert.match(englishCatalogResponse.body, /<html lang="en">/);
  assert.match(englishCatalogResponse.body, /Vinyl records, BPM and Camelot/);

  const missingResponse = mockResponse();
  await catalog(
    {
      method: 'GET',
      url: '/api/catalog?path=missing-release-999999',
      query: { path: 'missing-release-999999' },
    },
    missingResponse
  );
  assert.equal(missingResponse.statusCode, 404);
  assert.match(missingResponse.body, /Пластинка не найдена/);

  const sitemapResponse = mockResponse();
  await catalog(
    {
      method: 'GET',
      url: '/api/catalog?format=sitemap',
      query: { format: 'sitemap' },
    },
    sitemapResponse
  );
  assert.equal(sitemapResponse.statusCode, 200);
  assert.match(sitemapResponse.headers['content-type'], /application\/xml/);
  for (const path of sitemapPaths) {
    const route = vercelConfig.rewrites.find((item) => item.source === path);
    const query = Object.fromEntries(
      new URL(route.destination, 'https://vertax.live').searchParams
    );
    for (const method of ['GET', 'HEAD']) {
      const response = mockResponse();
      await catalog({ method, url: path, query }, response);
      assert.equal(response.statusCode, 200);
      assert.match(response.headers['content-type'], /application\/xml/);
      assert.equal(response.body, method === 'GET' ? sitemap : '');
    }
  }

  const detailResponse = mockResponse();
  await catalog({ method: 'GET', url: '/api/catalog?path=' + release.slug }, detailResponse);
  assert.equal(detailResponse.statusCode, 200);
  assert.match(
    detailResponse.body,
    /<tbody>.*174.*9A/s,
    'Track data must be present without executing JavaScript'
  );

  const aliasResponse = mockResponse();
  await catalog(
    { method: 'GET', url: '/api/catalog?path=old-name-' + release.discogs_id },
    aliasResponse
  );
  assert.equal(aliasResponse.statusCode, 308);
  assert.equal(aliasResponse.headers.location, '/music/' + release.slug);

  for (const command of ['SMEMBERS', 'MGET']) {
    brokenCommand = command;
    for (const path of [
      '/api/catalog',
      '/api/catalog?format=sitemap',
      ...(command === 'MGET' ? ['/api/catalog?path=' + release.slug] : []),
    ]) {
      for (const method of ['GET', 'HEAD']) {
        const outage = mockResponse();
        await catalog({ method, url: path }, outage);
        assert.equal(
          outage.statusCode,
          503,
          `${path} must not return an empty 200 or false 404 on ${command} failure`
        );
        assert.equal(outage.headers['cache-control'], 'no-store');
        assert.equal(outage.headers['retry-after'], '300');
        if (method === 'HEAD') assert.equal(outage.body, '');
      }
    }
  }
  brokenCommand = '';
  // An actually empty, healthy database still returns a valid catalog and sitemap.
  sets['vertax:public:releases'] = [];
  sets['vertax:candidates:all'] = [];
  const emptyResponse = mockResponse();
  await catalog({ method: 'GET', url: '/api/catalog' }, emptyResponse);
  assert.equal(emptyResponse.statusCode, 200);
  assert.equal((await catalog.renderSitemap()).match(/<url>/g).length, 7);

  for (const key of redisEnvKeys) delete process.env[key];
  const unconfigured = mockResponse();
  await catalog({ method: 'GET', url: '/api/catalog?format=sitemap' }, unconfigured);
  assert.equal(unconfigured.statusCode, 503);
} finally {
  globalThis.fetch = originalFetch;
  for (const key of redisEnvKeys) {
    if (originalRedisEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalRedisEnv[key];
  }
}

const statsResponse = mockResponse();
await catalog(
  {
    method: 'GET',
    url: '/api/catalog?format=stats',
    query: { format: 'stats' },
    headers: {},
  },
  statsResponse
);
const statsBody = JSON.parse(statsResponse.body);
assert.equal(statsResponse.statusCode, 200);
assert.equal(statsBody.ok, true);
assert.equal(typeof statsBody.unique_releases_total, 'number');
assert.equal(typeof statsBody.track_cache_entries, 'number');

const cronUnauthorizedResponse = mockResponse();
await catalog(
  {
    method: 'GET',
    url: '/api/catalog?task=sync',
    query: { task: 'sync' },
    headers: {},
  },
  cronUnauthorizedResponse
);
assert.equal(cronUnauthorizedResponse.statusCode, 401);
assert.deepEqual(JSON.parse(cronUnauthorizedResponse.body), {
  ok: false,
  error: 'unauthorized',
});

const bulkIngestResponse = mockResponse();
await discogsIngest(
  {
    method: 'POST',
    url: '/api/discogs-ingest',
    headers: {},
    body: {
      vinyls: [
        {
          discogsId: '10001',
          artist: 'Catalog Artist',
          title: 'Queued Release',
          tracklist: [],
        },
        {
          discogsId: '10002',
          artist: 'Catalog Artist',
          title: 'Known Release',
          tracklist: [
            {
              position: 'A1',
              title: 'Known Track',
              bpm: 132,
              camelot: '4A',
            },
          ],
        },
      ],
    },
  },
  bulkIngestResponse
);
const bulkIngestBody = JSON.parse(bulkIngestResponse.body);
assert.equal(bulkIngestResponse.statusCode, 200);
assert.equal(bulkIngestBody.mode, 'bulk');
assert.equal(bulkIngestBody.releases_seen, 2);
assert.equal(bulkIngestBody.releases_saved, 2);
assert.equal(bulkIngestBody.releases[0].track_count, 0);
assert.equal(bulkIngestBody.releases[1].track_count, 1);

const protectedAdminTrack = mergeDiscogsPayload(
  {
    matched: true,
    artist_original: 'Calibre',
    title_original: 'Bellamee',
    bpm: 175,
    camelot: '9A',
    key_name: 'E Minor',
    bpm_source: 'admin',
    key_source: 'admin',
    meta_status: 'admin',
  },
  {
    artist_original: 'Calibre',
    title_original: 'Bellamee',
    bpm: 174,
    camelot: '8A',
    key_name: 'A Minor',
    bpm_source: 'beatport',
    key_source: 'beatport',
    original_bpm: 87,
    halftime_corrected: true,
  }
);
assert.equal(protectedAdminTrack.bpm, 175);
assert.equal(protectedAdminTrack.camelot, '9A');
assert.equal(protectedAdminTrack.bpm_source, 'admin');
assert.equal(protectedAdminTrack.key_source, 'admin');
assert.equal(protectedAdminTrack.original_bpm, undefined);
assert.equal(protectedAdminTrack.halftime_corrected, false);

console.log('catalog smoke ok');
