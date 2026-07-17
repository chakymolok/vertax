import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('./api/catalog');
const discogsIngest = require('./api/discogs-ingest');
const { mergeDiscogsPayload } = require('./lib/redis-cache');
const {
  normalizePublicRelease,
  releaseSlug,
} = require('./lib/public-catalog');

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

const detailHtml = catalog.renderReleasePage(release);
assert.match(detailHtml, /Calibre — Bellamee: BPM и Camelot треков/);
assert.match(detailHtml, /<link rel="canonical" href="https:\/\/vertax\.live\/music\/calibre-bellamee-5675416">/);
assert.match(detailHtml, /"@type":"MusicAlbum"/);
assert.match(detailHtml, /174/);
assert.match(detailHtml, /9A/);
assert.match(detailHtml, /Открыть VERTAX/);
assert.match(detailHtml, /Запустить в Telegram/);
assert.match(detailHtml, /Discogs/);
const unsafeHtml = catalog.renderReleasePage(Object.assign({}, release, {
  cover_url: 'javascript:alert(1)',
  discogs_url: 'javascript:alert(2)',
}));
assert.doesNotMatch(unsafeHtml, /javascript:/);

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
assert.match(catalogHtml, /index, follow/);

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

const sitemap = await catalog.renderSitemap();
assert.match(sitemap, /<loc>https:\/\/vertax\.live\/music<\/loc>/);

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

const catalogResponse = mockResponse();
await catalog({ method: 'GET', url: '/api/catalog', query: {} }, catalogResponse);
assert.equal(catalogResponse.statusCode, 200);
assert.match(catalogResponse.headers['content-type'], /text\/html/);
assert.match(catalogResponse.body, /Пластинки, BPM и Camelot/);

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
