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
- `dig`
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
- `viewDig`
- modal renderers
- Camelot wheel renderers

The code uses HTML strings. All untrusted dynamic values should pass through `esc()`.

### Collection Gaps / Dig View

`state.view = 'dig'` renders the Stage 1 "Что докопать" flow.

Client analysis is handled by `computeDigAnalysis(collection)` in `js/render.js`.

It:

- flattens `state.collection` records into tracks;
- treats `record_count` as the number of saved records/releases;
- treats `track_count` as the number of flattened tracks;
- counts tracks with BPM and normalized Camelot as enriched;
- prefers manual BPM/Camelot override fields over automatic fields when present;
- builds a 24-cell Camelot grid for `1A-12A` and `1B-12B`;
- detects weak and critical Camelot gaps using neighboring Camelot density;
- builds compact BPM bands around common electronic-music tempo zones;
- labels BPM bands with rough genre context such as house/techno, 140, jungle, and drum and bass;
- detects empty BPM bands between dense neighboring tempo zones;
- generates rule-based RU digging briefs.

Digging briefs in dig view are rule-generated and RU-only in Stage 1. Translations will be added after templates stabilize.

Stage 1 created no new API endpoints, no serverless functions, no IndexedDB stores, and no IndexedDB migrations. The base gap view still reads from `state.collection` only.

Stage 3 adds candidate loading on top of the same view:

- `dig-load-candidates` computes the current collection hash and syncs `/api/collection-index`;
- the client sends only top gaps, `collection_hash`, local excluded IDs, and a compact collection profile to `/api/candidates`;
- candidate cards are rendered inside matching gap cards;
- candidate actions are local-only: wishlist, hidden, and owned live in `localStorage` under `vertax_candidate_status`;
- hidden and owned IDs are sent as one-request exclusions, but the server does not persist those statuses.

### Release Candidate Database

Stage 2 added a persistent Redis database of candidate releases. Stage 3 adds the user-facing `/api/candidates` endpoint that reads this database and groups candidates by collection gaps.

Full release records:

```text
vertax:release:{discogs_id}
```

Index sets:

```text
vertax:candidates:all
vertax:candidates:by_label:{label_slug}
vertax:candidates:by_genre_family:{family}
vertax:candidates:by_camelot:{camelot}
vertax:candidates:by_bpm_bucket:{range}
```

Candidate releases and candidate indexes have no TTL. They are a permanent curated database, separate from temporary `collection_index:*` and `ai_verdict:*` caches.

`lib/release-candidates.js` owns:

- Discogs release and label ingestion;
- automated seed state under `vertax:seed:label:{label_id}`;
- release normalization;
- track enrichment through existing Beatport/Redis helpers;
- `bpmBucket()` using 5 BPM buckets such as `170-174`;
- `genreFamily()` mapping aligned with the BPM bands in the dig UI.
- `saveReleaseCandidate()`;
- `indexReleaseCandidate()`;
- `candidateStats()`;
- `candidateSeedStates()`;
- `exportCandidates()`.

Admin seeding runs through:

```text
POST /api/admin/maintenance { "action": "seed_candidates" }
POST /api/admin/maintenance { "action": "candidate_stats" }
POST /api/admin/maintenance { "action": "candidate_seed_state" }
POST /api/admin/maintenance { "action": "export_candidates" }
```

The seed flow accepts `release_ids` or `label_id` batches. Label seeds update `vertax:seed:label:{label_id}` and the `vertax:seed:labels` set so automated jobs can continue from the last offset.

### Automated Candidate Seed

Stage 4A uses GitHub Actions, not Vercel Cron, to grow the candidate database safely.

Files:

- `.github/workflows/seed-candidates.yml` runs weekly and supports `workflow_dispatch`.
- `config/candidate-labels.json` stores enabled Discogs label IDs, priorities, genre families, and `max_batches_per_run`.
- `scripts/seed-candidates.mjs` reads the config, loads seed state through `candidate_seed_state`, then calls `seed_candidates` batches sequentially.
- manual runs can filter by `LABEL_FILTER` or `GENRE_FILTER`; explicit filters can target disabled labels too, while scheduled runs use only `enabled: true`.

Safety limits:

- no tokens are committed;
- the workflow requires `VERTAX_BASE_URL` and `VERTAX_ADMIN_TOKEN` GitHub secrets;
- each label is capped by `max_batches_per_run`;
- `LIMIT` is clamped to 25;
- batches run sequentially with a 2-second pause;
- one failing label does not stop the whole run.

The workflow does not refresh marketplace data separately, send Telegram digests, send user notifications, or call Beatport directly. All enrichment still happens behind the protected backend endpoint.

The seed config now uses the same family language as the BPM analysis:

```text
downtempo_halftime
hiphop_trip_hop_breaks
disco_slow_house
house_and_techno
electro_breaks
dubstep_grime_ukg
footwork_juke
jungle_fast_breaks
dnb_jungle
fast_dnb_breakcore
hardcore_footwork
leftfield
```

`house_and_techno` means house and techno as a broad BPM-zone family, not tech house. Seeded tracks that resolve BPM/Camelot are also upserted into the shared permanent Beatport/Discogs metadata cache, not only into `vertax:release:*`.

### Candidate Recommendations

`api/candidates.js` accepts:

- `X-User-Id`, the anonymous local UUID;
- `collection_hash`, pointing to `collection_index:{user_id}:{collection_hash}`;
- up to eight client-computed gaps;
- local `excluded_ids` and `owned_ids`;
- optional `collection_profile` with top labels, artists, and genre families.

The endpoint never accepts or stores the full collection. It loads the temporary collection index with `getCollectionIndex()`, which also refreshes the sliding 30-day TTL.

`lib/candidate-recommendations.js` owns:

- reading Redis candidate indexes;
- matching Camelot gaps through `vertax:candidates:by_camelot:*`, BPM buckets, and genre family indexes;
- matching BPM gaps through `vertax:candidates:by_bpm_bucket:*` plus nearby Camelot sets;
- expansion scopes such as exact gap, without family, and Camelot-only/BPM-only;
- mathematical candidate scoring through the same `trackCompatibility()` logic used by release analysis;
- grouping candidates into `strong`, `probable`, and `explore`.

No AI is used for candidate selection. Candidate release records and indexes remain permanent and have no TTL.

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

Compatibility analysis adds temporary Redis collection indexes:

- key: `collection_index:{user_id}:{collection_hash}`;
- TTL: 30 days;
- TTL behavior: sliding, refreshed on index lookup and repeated index sync;
- purpose: compute release-to-collection compatibility without sending the full collection on every request.

AI DJ verdicts are cached separately:

- key: `ai_verdict:{prompt_version}:{lang}:{release_id}:{collection_hash}`;
- TTL: 30 days;
- purpose: avoid repeated AI calls for the same release, collection hash, prompt version, and UI language;
- generated only after the user clicks `AI DJ-разбор`.

The 30-day TTL is only for temporary collection indexes. It must not be applied to `vertax:beatport:track:*` or other shared track metadata caches.

### Compatibility Analysis Data Flow

Client helpers in `js/api.js`:

- `vertaxFlattenCollectionForAnalysis()` flattens local collection tracks.
- `vertaxCollectionHash()` hashes only stable analysis fields.
- `vertaxSyncCollectionIndex()` posts to `/api/collection-index`.
- `vertaxAnalyzeRelease()` posts to `/api/analyze-release`.
- `vertaxGetDjVerdict()` posts to `/api/analyze-release` with `action: "ai_verdict"` and current UI language.

Server helpers in `lib/compatibility-analysis.js`:

- normalize collection tracks into a minimal index;
- preserve release ID and track position when present;
- include artist, title, BPM, Camelot, genre, label, record title, and position;
- build buckets for future large-collection filtering;
- load Discogs candidates/releases;
- enrich release tracks through Redis/Beatport/manual fallback;
- calculate compatibility score by math;
- calculate stricter purchase signal;
- build collection profile for AI context:
  - BPM min/max/median;
  - top genres;
  - top genre families;
  - top labels;
  - top artists.

The collection remains local-first. The Redis collection index is temporary compute cache, not the source of truth.

### Compatibility Scoring

The score is mathematical and does not use AI:

- Camelot compatibility must be non-zero.
- BPM compatibility must be non-zero.
- Genre-family affinity adjusts the score when both genres are known.
- Unknown genre does not penalize a track.
- `compatibility_score` is based on harmonic overlap and collection density.
- Discogs rating affects `purchase_score`, not `compatibility_score`.
- `purchase_score` is capped when musical compatibility is weak so Discogs rating cannot make a poor musical fit look like a strong buying signal.
- `recommended` currently requires at least `70/100`, enough overlap, and non-low confidence.

AI may explain these results but must not recalculate them or override `recommended`.

## Serverless API

Current API functions:

- `api/discogs.js` - Discogs proxy for search, release, and collection.
- `api/bpm.js` - GetSongBPM proxy using `GETSONGBPM_KEY`.
- `api/beatport-lookup.js` - Beatport metadata lookup and cache.
- `api/collection-index.js` - temporary per-user normalized collection index for compatibility analysis.
- `api/analyze-release.js` - Discogs release lookup, BPM/Camelot enrichment, mathematical compatibility scoring, and `action: "ai_verdict"` AI explanation mode.
- `api/candidates.js` - matches seeded release candidates into "Что докопать" gap cards using the temporary collection index.
- `api/discogs-ingest.js` - ingest local vinyl track metadata into shared cache/proposal flow.
- `api/telegram-webhook.js` - Telegram admin callback webhook.
- `api/admin/proposals.js` - list, approve, and reject metadata proposals.
- `api/admin/maintenance.js` - import backup, rebuild Beatport cache, seed release candidates, seed state, candidate stats, and candidate export.

Vercel Hobby currently allows no more than 12 Serverless Functions. The admin consolidation reduced the API function count to 9; adding `/api/candidates` brings it to 10.

## Server Libraries

- `lib/redis-cache.js` - Redis REST commands, Beatport cache, track proposals, import/export helpers.
- `lib/compatibility-analysis.js` - release-to-collection scoring, Discogs release context, temporary collection index.
- `lib/release-candidates.js` - persistent candidate release database, indexes, manual seed, stats, and export.
- `lib/candidate-recommendations.js` - gap-to-candidate lookup, candidate scoring, and response grouping.
- `lib/ai-verdict.js` - Gemini/Groq AI DJ breakdown, prompt-versioned multilingual cache.
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
- `GEMINI_API_KEY` optional for AI DJ breakdown
- `GEMINI_MODEL` optional, defaults to `gemini-2.0-flash`
- `GROQ_API_KEY` optional fallback for AI DJ breakdown
- `GROQ_MODEL` optional, defaults to `llama-3.3-70b-versatile`

AI provider behavior:

- Gemini is tried first when `GEMINI_API_KEY` exists.
- If Gemini is missing, unavailable, or out of quota, Groq can be used when `GROQ_API_KEY` exists.
- AI errors must be shown as short human-readable UI messages, not raw provider logs.
- AI answers are generated in the current app language: RU, EN, ZH, or JA.

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

## Stage 4B — Marketplace Refresh

Candidate releases carry a `marketplace` object with current Discogs price and stock data.
Because prices/stock change daily but BPM/Camelot is static, marketplace data has a
dedicated refresh path that does NOT re-enrich tracks through Beatport.

### Shape

`release.marketplace`:

```
{
  lowest_price: number | null,
  currency: 'EUR' | 'USD' | null,
  num_for_sale: number | null,
  median_price: number | null,
  average_price: number | null,
  price_source: 'discogs_lowest_price' | 'discogs_marketplace_stats' | 'discogs_price_suggestions' | null,
  refreshed_at: ISO-8601 timestamp     // ← used to find stale records
}
```

`refreshed_at` is set on initial ingest (`normalizeReleaseCandidate`) and on every
`refreshMarketplaceBatch` pass. It is intentionally separate from the record-level
`updated_at` (which moves on any save).

### Refresh path

- Function: `refreshMarketplaceBatch({ limit, older_than_hours })` in `lib/release-candidates.js`.
- Admin action: `POST /api/admin/maintenance { action: 'refresh_marketplace', limit, older_than_hours }`.
- Schedule: `.github/workflows/refresh-marketplace.yml` runs Sundays 04:00 UTC.
- Defaults: `limit = 25`, `older_than_hours = 168` (1 week).
- The batch picks oldest stale records first, calls `loadMarketplace()` (Discogs only),
  saves with `SET` (no re-indexing — marketplace fields don't affect label/genre/camelot/bpm indexes).
- ~1.1s pause between releases to stay under Discogs token rate limit (60 req/min).

### Vinyl-only filter

`looksLikeVinylFormat(item)` in `lib/release-candidates.js` is STRICT:

1. If `formats[]` array is present, require at least one entry with `name === 'Vinyl'` (case-insensitive).
2. If `formats[]` is missing (legacy data), fall back to text scan that rejects `cd|file|flac|wav|mp3|cassette|cdr|dvd|digital` and requires `vinyl|12"|lp`.

`ingestReleaseCandidate` rejects non-vinyl releases at ingest, returning
`{ ok: false, error: 'not_vinyl' }`. `seedCandidates` counts these in
`skipped_non_vinyl`. To bypass for special cases, pass `{ allow_non_vinyl: true }`.

## Stage 4F — Beatport Track Previews

Beatport tracks now carry `sample_url` (CDN MP3, ~30s preview, no auth) plus
`sample_duration_ms`. Captured in `api/beatport-lookup.js` → `mapTrack()` and
propagated through `lib/release-candidates.js` → `normalizeTrackFromCache()`.

UI can render a play button per track whenever `sample_url` is present.
The URL is a direct CDN link — no embed iframe needed. Fallback when missing:
link to `beatport_url`.

## AI Verdict Prompt Versioning

`lib/ai-verdict.js` uses `AI_PROMPT_VERSION` constant (currently `v4`) as part
of the Redis cache key:

```
ai_verdict:<version>:<lang>:<release_id>:<collection_hash>
```

**To bump the prompt:**

1. Edit `buildPrompt()` in `lib/ai-verdict.js`.
2. Increment `AI_PROMPT_VERSION` (`v4` → `v5`).
3. All previous verdicts become unreachable — Redis will GC them naturally
   after TTL (30 days). To force-clear, add an action in `api/admin/maintenance.js`
   that SCANs `ai_verdict:v4:*` and DELs the keys.

**Languages supported:** ru, en, zh, ja (others fall back to ru). Adding a
language requires updating `languageInstruction()` map.

**Providers:** Gemini Flash (primary, via `GEMINI_API_KEY`) → fallback to
Groq (`GROQ_API_KEY`). Both fail → returns 503 `ai_unavailable`. There is
no third fallback by design — math result still works without AI.

## Shared Metadata Predicates

`js/state.js` exposes `vertaxMetaHasAny / vertaxMetaIsEmpty / vertaxMetaIsFull /
vertaxMetaHasKey / vertaxMetaSource` for use across Deezer/Beatport BPM
patches in `app.js`. The patches keep local wrappers (`metadataEmpty`,
`metadataFull`, `hasMeta`, `hasFullMeta`, `sourceName`) that delegate to these
shared functions — wrappers retained so internal patch code doesn't need
rewriting.
