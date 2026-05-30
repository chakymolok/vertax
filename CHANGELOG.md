# CHANGELOG

This file documents the cumulative patches applied to VERTAX-01 / RUNT-01.
Each entry corresponds to an `installRunt*` / `installVertax*` function in
`js/handlers.js` that was added incrementally on top of the base app.

All installers are called sequentially from `installRuntAndVertaxExtensions()`
in `js/app.js` immediately after `window.laisoBuck` is set.

---

## Base app — VERTAX-01 core

**File:** `js/handlers.js` lines 205–2481, `js/render.js`, `js/api.js`, `js/state.js`

Initial working version:
- Add vinyl via Discogs catalogue number or free-text search
- View / edit tracklist with BPM and key
- Fetch BPM+key from GetSongBPM → AcousticBrainz cascade
- Generate DJ set (best-flow mode)
- Save / load collection from IndexedDB
- Telegram WebApp + VK Bridge integration

---

## Extensions (in install order)

### installRuntBpmX2LiveToggle
**What it does:** BPM ×2 / ÷2 buttons now show/hide dynamically based on
whether a track has a valid BPM. Wraps `window.laisoBuck.render` to
re-evaluate button visibility after every render.

**Handlers affected:** none (DOM side-effect on render)

---

### installRuntSetManualMetaControls
**What it does:** Adds manual BPM/Key edit controls directly on the set
screen (per-track override without navigating to the tracklist view).

**Handlers affected:** none (adds new `data-action` targets via render wrap)

---

### installRuntSetDndAndAddTrackModal (patch-6)
**What it does:** Adds touch-friendly drag-and-drop reordering of tracks on
the set screen. Also adds an "Add track" modal to the set screen.

**Handlers affected:** adds `runt-set-reorder`, `runt-open-add-track-modal`

---

### installRuntCompactSetCards
**What it does:** Injects compact card layout for the set screen (smaller
track cards showing only key info). Wraps `viewSet`.

**Handlers affected:** wraps `window.viewSet`

---

### installRuntManualMetadataHandlers (patch-8)
**What it does:** Replaces `track-manual-meta` with a version that walks
through all unresolved tracks sequentially after each manual entry.
Also wraps `bpm-x2` and `bpm-divide-2` to call `syncGeneratedSet()`
immediately so the generated set updates without a separate re-generate.

**Handlers affected:** `track-manual-meta`, `bpm-x2`, `bpm-divide-2`

---

### installRuntCollectionQuickActions
**What it does:** Adds quick-action buttons to each collection card (fetch
metadata, copy to session, remove). Rendered as an inline panel below
the card.

**Handlers affected:** adds `collection-quick-fetch`, `collection-copy-to-session`

---

### installRuntDiscogsDuplicatePicker
**What it does:** When adding a vinyl from Discogs, if a duplicate
`discogsId` already exists in the collection, shows a picker to resolve
it (update existing vs add new).

**Handlers affected:** wraps `add-vinyl-confirm`

---

### installRuntManualMetaValidation (RUNT-01 validation layer)
**What it does:** Validates BPM (40–220, numeric) and Key (Camelot / note
shorthand) before saving. Replaces `track-save` handler to run validation
before persisting. Exposes `window.runtValidateBpm`, `window.runtValidateKey`.

**Handlers affected:** `track-manual-meta`, `track-save`

---

### installRuntAddTrackFromCollection (patch-15)
**What it does:** Enables "Add track from collection" flow — browse the
saved collection and add individual tracks to the current session vinyl
without re-importing the whole record.

**Handlers affected:** adds `runt15-add-from-collection`, `runt15-confirm-add`

---

### installRuntScopeAndFetchingControls (patch-16)
**What it does:** Multiple fixes bundled together:
1. BPM ×2 / ÷2 now use `runtApplyX2` / `runtApplyDivide2` helpers that
   guard against invalid states.
2. Manual BPM/Key entry on the fetching screen proceeds through all
   unresolved tracks in sequence.
3. Set construction can now use either "session only" or "whole collection"
   as the source pool.
4. Generated sets respect the selected source scope.
5. Deduplication: no same-title+artist track twice, no same vinyl
   back-to-back in a generated set.

**Handlers affected:** `bpm-x2`, `bpm-divide-2`, `track-manual-meta`,
`set-generate`, adds `runt16-scope-toggle`

---

### installRuntGeneratedSetCache (patch-16.1)
**What it does:** Remembers the generated set per mode + source scope
during the current session so switching modes does not silently discard
a built set.

**Handlers affected:** wraps `set-generate`

---

### installRuntCollectionPickModal (patch-17)
**What it does:** "Build set from collection" entry point — opens a modal
to pick which vinyls from the collection to include in the pool before
generating.

**Handlers affected:** adds `runt17-pick-collection-modal`,
`runt17-toggle-vinyl`, `runt17-confirm-pick`

---

### installRuntCollectionBpmPanel
**What it does:** Adds a BPM distribution panel to the collection view
showing a histogram of BPMs across all tracks.

**Handlers affected:** none (render extension)

---

### installRuntLiveMode (patch-19)
**What it does:** Adds "Play Set / Live Mode" — a full-screen playback
view that walks through the generated set track by track, marks tracks as
played, and keeps the screen awake via WakeLock API.

**Handlers affected:** adds `runt19-start-live`, `runt19-mark-played`,
`runt19-next-track`, `runt19-exit-live`

---

### installRuntLiveSuggestions
**What it does:** While in Live Mode, suggests the next best track from
the pool based on Camelot compatibility with the currently playing track.

**Handlers affected:** none (render extension inside Live Mode)

---

### installRuntDiagnosticsPanel (patch-25)
**What it does:** Moves the "Diagnostics" panel from a popup/modal into a
regular inline section on the tracklist view. Shows fetch status,
confidence, and conflict info per track.

**Handlers affected:** replaces `runt-open-diagnostics` modal with
inline section navigation

---

### installRuntSourceSelectionPage (patch-26)
**What it does:** Moves the set source picker (session / collection /
pick vinyls) from a modal into a dedicated full-page view `runt26-source`.

**Handlers affected:** adds `runt26-goto-source`, `runt26-set-source`

---

### installRuntBackButtonCopy (patch-27)
**What it does:** Removes per-view page titles from the header to free
vertical space. Improves the back button to always show a contextual
label ("← Назад к сету" etc.) instead of a generic arrow.

**Handlers affected:** wraps `viewSet`, `viewTracklist` (render extension)

---

### installRuntSourceEntryButtons (patch-28)
**What it does:** Replaces the "Build set" button flow so it goes to the
source-selection page first instead of directly opening a modal.
Adds `runt28-open-source` handler. Overrides `go-set` to redirect to
`openSourceSection()` instead of navigating directly to `set` view.

**Handlers affected:** `go-set` *(fully replaced)*, adds `runt28-open-source`

---

### installRuntSourceSelectionHardFix (patch-30)
**What it does:** Hard-fixes edge cases in source controls: removes tracks
that were erroneously kept after vinyl deletion, re-wires the logo to
navigate home, fixes "Remove" action for collection vinyls in the source
picker.

**Handlers affected:** `runt30-remove-vinyl`, extends `go-home`

---

### installRuntAscendingTempoMode (patch-32)
**What it does:** Implements "Tempo-safe" set mode — generates a set
ordered by ascending BPM (lowest to highest) instead of Camelot-flow.
Wraps `set-generate` to intercept the `tempo-safe` mode before the
default algorithm runs. Also adds a hint label on the set options panel.

**Handlers affected:** wraps `set-generate`

---

### installVertaxBackupFeature
**What it does:** Full backup/restore feature — export the entire
collection + sets as a JSON file, import from a previously exported file.
Adds the `backup` view. Uses `navigator.share` where available (mobile),
falls back to blob download.

**Handlers affected:** adds `backup-download`, `backup-import`,
`backup-restore-confirm`

---

## Auto-installed IIFEs (not in the installers list)

### installSmartSuggestionsForSet
**What it does:** When a generated set has 1–3 tracks, suggests the next
best track from the pool inline on the set screen (Camelot + BPM match).

### installVertaxSetBuilderUX  *(last to run)*
**What it does:** Final set-generation UX layer. Fully replaces
`set-generate` with a version that validates pool size, handles all four
set modes (best-flow / tempo-safe / camelot-safe / camelot-filter),
shows appropriate warnings, and gates on minimum track count.
Also wraps `viewSet` to inject additional UI controls.

**Handlers affected:** `set-generate` *(fully replaced — supersedes
patch-32's wrap)*

### installVertaxCompactSetTouchDnd
**What it does:** Touch-drag-and-drop for compact set cards on mobile.
Uses a ghost-card visual while dragging.

---

## Refactoring notes (TODO)

The incremental patch pattern is no longer needed now that all installers
run synchronously from `installRuntAndVertaxExtensions`. Future work:

1. **Remove `window.laisoBuck` guards** — `window.laisoBuck` is always
   set before any installer runs. All `if (!window.laisoBuck) return`
   guards are dead code.

2. **Merge final handler versions into base** — `go-set` (patch-28),
   `set-generate` (installVertaxSetBuilderUX) and `bpm-x2/bpm-divide-2`
   (patch-16) have been fully replaced. The intermediate `on()` calls
   in the base section are dead code.

3. **Split handlers.js by domain** — suggested split:
   - `js/handlers-base.js` — navigation, vinyl CRUD, tracklist
   - `js/handlers-set.js` — set generation, live mode, source selection
   - `js/handlers-fetch.js` — BPM/key fetching, manual metadata
   - `js/handlers-backup.js` — backup/restore

4. **Replace `window.prompt` in manual meta flows** — `prompt()` is
   broken in Telegram/VK WebView. Use the existing modal infrastructure.

---

## Stage 4B + housekeeping pass (this session)

### New: marketplace refresh batches (4B)

- `release.marketplace.refreshed_at` timestamp added.
  - Set on initial ingest in `normalizeReleaseCandidate()`.
  - Used as freshness key by the new refresh batch.
- `refreshMarketplaceBatch({ limit, older_than_hours })` in
  `lib/release-candidates.js`. Linear scan up to `limit*6` records,
  picks oldest stale, calls `loadMarketplace()` (Discogs only), saves
  via direct SET (no re-indexing — marketplace doesn't affect indexes).
- Admin endpoint: `POST /api/admin/maintenance` action `refresh_marketplace`.
- GitHub Action: `.github/workflows/refresh-marketplace.yml`. Schedule
  Sundays 04:00 UTC. Inputs: `limit` (25), `older_than_hours` (168 = 1w),
  `batches` (1). Loops sequentially with 5s rest between batches.

### Tightened: strict vinyl-only candidate filter

`looksLikeVinylFormat()` now requires `formats[].name === 'Vinyl'` when
formats array is present (no more accepting CD-LPs because they contain
the word "Album"). Text fallback rejects flac/wav/mp3/digital alongside cd.
`ingestReleaseCandidate` rejects non-vinyl at intake; `seedCandidates`
counts them in new `skipped_non_vinyl` field. Use `{ allow_non_vinyl: true }`
to override.

### New: Beatport track previews

`api/beatport-lookup.js` → `mapTrack()` captures `sample_url` and
`sample_duration_ms`. `lib/release-candidates.js` → `normalizeTrackFromCache()`
forwards both. Direct CDN MP3 URL (no embed/iframe needed).

UI integration is open: render a play button on the track row when
`sample_url` is non-null; fall back to `beatport_url` link otherwise.

### Refactor: shared metadata predicates

`js/state.js` adds `vertaxMetaHasAny / vertaxMetaIsEmpty / vertaxMetaIsFull /
vertaxMetaHasKey / vertaxMetaSource`. Deezer BPM patch and Beatport BPM
patch in `js/app.js` now delegate their local `metadataEmpty` / `metadataFull` /
`hasMeta` / `hasFullMeta` / `sourceName` to these. No behavior change —
just deduplicated logic.

### Docs

- `docs/architecture.md` gets sections: **Stage 4B Marketplace Refresh**,
  **Stage 4F Beatport Track Previews**, **AI Verdict Prompt Versioning**,
  **Shared Metadata Predicates**.

### Roadmap status

- 4A automatic candidate seed → already in place (`seed-candidates.yml`).
- **4B marketplace refresh → DONE this session.**
- 4C admin digest preview → not started.
- 4D opt-in Telegram digest → not started.
- 4E price alerts → not started; may be skipped depending on wishlist usage.
- 4F Beatport previews → backend ready; UI integration pending.

### Deferred to next session

- `!important` cleanup in `themes.css` (256) and `display.css` (228).
  Wants visual regression smoke before mass removal.
- AI verdict cache GC: stale `ai_verdict:v3:*` and earlier are still in
  Redis. Optional admin action to scan/delete.
- UI integration of `sample_url` (play button on track rows).
