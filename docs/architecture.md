# Vertax Architecture

## Stack

- Frontend: vanilla JavaScript SPA.
- Styling: CSS source files bundled into one minified file.
- Build: Node scripts plus esbuild transform.
- Persistence: IndexedDB.
- Backend: Vercel Serverless Functions in `api/`.
- Cache/admin storage: Upstash/Vercel KV-compatible Redis REST API.
- Mini App support: Telegram WebApp SDK, VK Bridge adapter, MAX WebApp fallback.
- Deployment output: static `public/` directory plus Vercel `api/`.

## Routes

- `/` - main application.
- `/about` - SEO landing page.
- `/vk` - future VK Mini App placeholder.

The main app must remain on `/`.

## Build Pipeline

Build command:

```bash
npm run build
```

The command runs:

```bash
node scripts/build-assets.js && node scripts/build-public.js
```

`scripts/build-assets.js` concatenates source files in a fixed order and minifies them with esbuild:

JS order:

1. `js/db.js`
2. `js/state.js`
3. `js/api.js`
4. `js/render.js`
5. `js/handlers.js`
6. `js/app.js`
7. `js/app-i18n.js`

CSS order:

1. `css/base.css`
2. `css/layout.css`
3. `css/components.css`
4. `css/themes.css`
5. `css/display.css`
6. `css/app-i18n.css`

Outputs:

- `dist/app.js`
- `dist/app.css`
- `dist/build-report.json`

`scripts/build-public.js` recreates `public/` and copies deployable files:

- `index.html`
- `sw.js`
- `about/`
- `vk/`
- `assets/`
- `dist/`
- `fonts/`
- `js/about.js`
- `css/about.css` as `/about.css`

Raw `css/` is intentionally not copied to `public/`.

## Frontend Entry

`index.html` contains:

- viewport configured for mobile WebViews;
- CSP meta tag;
- Yandex.Metrika inline snippet;
- `#laiso-app`;
- global footer attribution for BPM/Key sources;
- deferred `dist/app.js`.

The rendered app root is:

```html
<div id="laiso-app">
  <div class="laiso-container" id="laiso-root">
    <div id="laiso-main"></div>
    <div id="laiso-overlay"></div>
  </div>
</div>
```

`render()` in `js/render.js` writes the current view into `#laiso-main` and overlays into `#laiso-overlay`.

## Client State

Global state lives in `js/state.js`:

- `state.view` - current screen.
- `state.modal` - modal state.
- `state.toast` - toast state.
- `state.vinyls` - current session records.
- `state.collection` - saved collection.
- `state.sets` - saved sets.
- `state.ui` - all transient UI state.

Important views include:

- `home`
- `add`
- `match`
- `tracklist`
- `edit-track`
- `fetching`
- `set`
- `collection`
- `discogs-import`
- `backup`
- `about`
- `live-set`
- `runt26-source`

## Persistence

IndexedDB is defined in `js/db.js`.

Database:

- name: `laiso-buck-db`
- version: `2`

Object stores:

- `vinyls`
- `sets`
- `settings`
- `bpm_cache`

Persistence helpers:

- `persistVinyl`
- `deleteVinylFromDb`
- `persistSet`
- `deleteSetFromDb`
- `dbGetAll`
- `dbPut`
- `dbDelete`
- `dbClear`

Do not change store names or key shapes without a migration and fallback.

## Rendering Layer

`js/render.js` contains the base screen renderers:

- `viewHome`
- `viewAdd`
- `viewDiscogsImport`
- `viewMatch`
- `viewTracklist`
- `viewEditTrack`
- `viewFetching`
- `viewSet`
- `viewCollection`
- `viewAbout`
- modal renderers
- Camelot wheel renderers

The code uses HTML strings. All untrusted dynamic values should pass through `esc()`.

## Event Handling

`js/handlers.js` defines:

- `handlers` map;
- `on(action, handler)`;
- action handlers for all `data-action` UI events.

`js/app.js` installs global delegated listeners:

- `click` for `data-action`;
- `input` for bound fields and search controls;
- `change` for select/toggle style controls;
- `keydown` for modal shortcuts.

Most UI commands are declared with `data-action`.

## Extension/Patch System

The codebase has a base app plus many incremental extension installers. `installRuntAndVertaxExtensions()` in `js/app.js` runs these installers in order after `window.laisoBuck` is exposed.

Examples:

- `installRuntBpmX2LiveToggle`
- `installRuntSetDndAndAddTrackModal`
- `installRuntManualMetaValidation`
- `installRuntScopeAndFetchingControls`
- `installRuntLiveMode`
- `installRuntDiagnosticsPanel`
- `installRuntSourceSelectionPage`
- `installRuntSourceEntryButtons`
- `installRuntSourceSelectionHardFix`
- `installRuntAscendingTempoMode`
- `installVertaxBackupFeature`

These installers often wrap `render`, `window.laisoBuck.render`, `viewSet`, or existing handlers. Order matters.

Before editing an action or view, search for later wrappers that override it.

## Metadata Lookup

Client-side metadata flow lives mostly in `js/api.js` and extension patches in `js/app.js`.

Sources:

- Discogs for release and collection data.
- GetSongBPM through `/api/bpm`.
- AcousticBrainz and MusicBrainz.
- Beatport through `/api/beatport-lookup`.
- Deezer JSONP patch.
- Manual input through in-app modals.

Discogs requests go through a client-side queue:

- `DISCOGS_REQUEST_INTERVAL_MS`
- `createRateLimitedQueue`
- `runDiscogsRequest`

This avoids uncontrolled parallel requests and helps with rate limits.

## BPM/Key Cache

Local BPM cache store:

- `bpm_cache`
- TTL: `BPM_CACHE_TTL_MS`, currently 30 days.

Cache behavior should preserve backwards compatibility with existing records.

Server-side Beatport/track cache lives in Redis through `lib/redis-cache.js`.

## Serverless API

Current API functions:

- `api/discogs.js` - Discogs proxy for search, release, and collection.
- `api/bpm.js` - GetSongBPM proxy using `GETSONGBPM_KEY`.
- `api/beatport-lookup.js` - Beatport metadata lookup and cache.
- `api/discogs-ingest.js` - ingest local vinyl track metadata into shared cache/proposal flow.
- `api/cache-export.js` - protected cache export.
- `api/cache-refresh.js` - cache refresh helper.
- `api/telegram-webhook.js` - Telegram admin callback webhook.
- `api/admin/approve.js` - approve metadata proposal.
- `api/admin/reject.js` - reject metadata proposal.
- `api/admin/proposals.js` - list proposals.
- `api/admin/import-backup.js` - import backup into shared cache/admin flow.
- `api/admin/rebuild.js` - rebuild Beatport cache.

Vercel Hobby currently allows no more than 12 Serverless Functions. Adding an endpoint requires removing or combining another endpoint unless the deployment plan changes.

## Server Libraries

- `lib/redis-cache.js` - Redis REST commands, Beatport cache, track proposals, import/export helpers.
- `lib/beatport-auth.js` - Beatport token acquisition and refresh.
- `lib/telegram-auth.js` - Telegram Mini App auth validation and admin notifications.
- `lib/vk-auth.js` - VK launch param validation and admin check.

## Environment Variables

Required or used by code:

- `DISCOGS_TOKEN` or `DISCOGS_PERSONAL_ACCESS_TOKEN`
- `GETSONGBPM_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `BEATPORT_USERNAME`
- `BEATPORT_PASSWORD`
- `BEATPORT_CLIENT_ID` optional
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_ADMIN_USER_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_TOKEN`
- `EXPORT_TOKEN`
- `VK_APP_SECRET` optional for VK auth
- `VK_ADMIN_USER_ID` optional for VK admin

## Service Worker

`sw.js` uses two caches:

- `vertax-static-v2` for app shell.
- `vertax-images-v1` for record covers.

Static assets:

- `/`
- `/index.html`
- `/dist/app.css`
- `/dist/app.js`
- `/fonts/ShareTechMono-Regular.woff2`

The service worker intentionally skips `/api/*` and raw `api.discogs.com` requests.

## CSP

CSP is declared in HTML meta tags. The main app currently allows inline scripts/styles because the app has inline Yandex.Metrika, inline style usage, and legacy HTML-string rendering.

Do not tighten CSP to nonce-only without auditing inline scripts, inline styles, and generated HTML.

## Testing And CI

Local checks:

```bash
npm run build
npm run smoke
npm test
npm run css:audit
npm run lint
```

CI:

- `.github/workflows/smoke.yml`
- runs `npm ci`, `npm run build`, and `npm run smoke`.

Smoke test:

- `smoke.mjs`
- uses Playwright;
- should prefer `data-testid` selectors over visible Russian text.

