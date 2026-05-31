# Vertax Product Documentation

## Overview

Vertax is a web tool for vinyl DJs, diggers, and record collectors. It helps users find and organize vinyl releases, manage a local record collection, enrich tracks with BPM and Key metadata, and build DJ sets by BPM, Camelot compatibility, genre, and flow.

The main app lives at `/`. The SEO landing page lives at `/about`. The `/vk` route is reserved for a future VK Mini App version.
The private admin dashboard lives at `/admin`.

## Positioning

Vertax is a practical vinyl DJ companion:

- Dig records.
- Manage a vinyl collection.
- Find BPM and Key for tracks that usually do not have that data printed.
- Build vinyl-only DJ sets with better harmonic and tempo flow.
- Keep the tool close inside Telegram Mini App and future Mini App environments.

Core product phrase:

> Vinyl DJ tool for BPM, Key, Discogs import and DJ set building.

## Audience

- Vinyl DJs preparing club, radio, podcast, or home-listening sets.
- Drum and bass, jungle, UK bass, ambient, breaks, and electronic music diggers.
- Collectors who use Discogs but want a faster set-preparation layer.
- DJs who play vinyl-only and need BPM, Key, Camelot, and tracklist notes outside a digital DJ library.
- Users opening the app from Telegram, VK, MAX, or mobile WebViews.

## Core Problems

Vinyl preparation has several recurring pains:

- BPM is usually not printed on records.
- Key is usually not printed either.
- Discogs is good for cataloging releases, but not enough for DJ flow preparation.
- Collection data, notes, shelves, photos, and memory are often fragmented.
- After a live set, it is hard to reconstruct exactly what was played.
- Harmonic vinyl set building takes time because track metadata is incomplete.

## Product Surface

### `/`

The main Vertax application. This route must remain the working app and must not be moved to `/app`.

Main capabilities:

- Discogs release search.
- Vinyl-only release filtering.
- Release recognition and candidate confirmation.
- Tracklist loading and editing.
- Manual vinyl and track metadata editing.
- BPM/Key enrichment.
- BPM and Camelot normalization.
- Local collection management.
- Discogs collection import.
- Set builder.
- "Will this record fit?" compatibility check against the local collection.
- "Что докопать" local collection gaps analysis: Camelot/BPM gaps, metadata coverage, and rule-based digging briefs.
- "Что докопать" release candidates: seeded server-side records matched into local collection gaps.
- AI DJ breakdown for compatibility results, generated only on demand.
- Live set mode.
- Backup and restore.
- Language selection and app-level i18n overlay.
- Telegram/VK/MAX WebView fallback behavior.

### `/about`

SEO landing page and public explanation of Vertax.

Current intent:

- Explain the project.
- Index key search phrases.
- Link to Telegram Mini App.
- Present ecosystem links and contact placeholders.
- Support RU, EN, ZH, and JA landing-page copy.

### `/vk`

Reserved route for VK Mini App.

Current intent:

- Keep a stable URL for future VK work.
- Avoid breaking the current `/` app.
- Provide a simple placeholder with links to `/` and `/about`.

### `/admin`

Private dashboard for the project owner.

Current intent:

- See candidate database size and quality.
- See genre-family, BPM bucket, and label coverage.
- Check automated seed state.
- Inspect recent candidate releases with update dates.
- See Redis BPM/Key cache size and temporary server-side collection index usage.

Authentication is private: Telegram admin identity or `ADMIN_TOKEN` fallback.
The dashboard is not a public analytics product. Because Vertax is local-first,
user counts only include users who touched server-side flows.

## Main User Flows

### Add A Record

1. User opens the app.
2. User searches Discogs by artist, release, catalog number, or track.
3. Vertax filters toward vinyl releases.
4. User selects a release candidate.
5. Vertax loads release details and tracklist.
6. User confirms, edits, or manually completes metadata.
7. Record is saved locally in IndexedDB.

### Import Discogs Collection

1. User enters a Discogs username.
2. Vertax loads public collection pages.
3. User chooses replace or merge.
4. Optional enrichment can load tracklists and BPM/Key.
5. Imported records are saved locally.

### Find BPM And Key

1. Vertax attempts metadata lookup by artist and track title.
2. Primary server-side GetSongBPM proxy is `/api/bpm`.
3. Additional metadata sources include AcousticBrainz, MusicBrainz, Deezer patches, Beatport lookup/cache, and manual entry.
4. Results are cached locally and, where relevant, server-side.
5. User can manually edit BPM, Key, and Camelot.

### Build A Set

1. User opens "Build set".
2. Vertax shows source selection.
3. User chooses one of two paths:
   - from records: select releases, then use the existing record-based builder;
   - from tracks: select individual tracks from records that are already in the collection.
4. In track mode, the generated set is a manual list of the selected tracks.
   Sorting by BPM or Camelot reorders the list and must not drop tracks because
   they fail strict harmonic/tempo rules.
5. User chooses mode:
   - best flow;
   - tempo-safe;
   - Camelot-safe;
   - Camelot filter;
   - custom/manual flow in extended patches.
6. Vertax generates or reorders an ordered track list.
7. User can edit BPM, Camelot, side/position, reorder, export, save, or enter Live Mode.

### Check If A Record Fits

1. User opens "Подойдёт ли пластинка?".
2. User enters a release title or catalog number.
3. Vertax builds or refreshes a temporary collection index under an anonymous local UUID.
4. Vertax finds candidate releases in Discogs. If several versions are plausible, the user chooses the exact release.
5. Vertax loads release metadata, cover art, tracklist, Discogs rating, marketplace signals, styles, genres, notes, and video titles when available.
6. Vertax enriches release tracks with BPM and Camelot from Redis/Beatport/manual fallback.
7. Vertax compares the release to the user's collection using math:
   - BPM compatibility;
   - Camelot compatibility;
   - genre-family affinity;
   - match density;
   - metadata coverage.
8. Vertax shows compatibility score, purchase signal, Discogs price/rating, best matches, unmatched tracks, and missing BPM/Key tracks.
9. User may manually fill missing BPM/Key and recalculate.
10. User may request an AI DJ breakdown.

The AI DJ breakdown does not decide compatibility. It explains the already-computed result and may discuss the release context, labels/artists already present in the user's collection, Discogs notes, styles, and possible set use cases. It must not invent web facts or Discogs-owner comments that are not in the provided data.

### Find What To Dig Next

1. User opens "Что докопать".
2. Vertax analyzes the local collection already loaded in memory.
3. Vertax flattens records into tracks and counts BPM/Camelot coverage.
4. Vertax shows a Camelot heatmap, BPM histogram, weak zones, and short rule-based digging briefs.
5. User can click "Найти кандидатов".
6. Vertax refreshes a temporary collection index and asks `/api/candidates` for seeded release candidates grouped by gap.
7. Candidate cards appear inside the relevant gap cards, not as a separate shop window.
8. User can analyze a candidate with the existing "Подойдёт ли пластинка?" flow, save it to wishlist, hide it, or mark it as already owned.
9. Empty and tiny collections show onboarding instead of confident recommendations.

This is a local-first helper for crate direction. The gap analysis remains client-side and non-AI. Candidate selection is mathematical and uses the server-side candidate database; AI is not involved.

Stage 2 prepared the server-side candidate release database. Stage 3 connects collection gaps with concrete release candidates from that database.

Stage 4A automates candidate database growth by periodically seeding selected Discogs labels through a protected admin endpoint. This only grows the shared candidate database; it does not send digests, alerts, or user notifications.

Candidate seed genres follow the BPM groups shown in the app, including hip-hop/trip-hop/slow breaks, house and techno, electro/breaks, dubstep/grime/UKG, footwork/juke, DnB/jungle, and leftfield contexts. When seed enrichment finds BPM/Camelot, that metadata also improves the shared lookup cache for future recognition and analysis.

### Backup And Restore

1. User opens backup.
2. Vertax exports local IndexedDB data to a JSON file.
3. User stores the file manually.
4. Restore can replace or merge the current collection.

## Data Ownership

The primary collection lives locally in the user's browser via IndexedDB. Vertax should treat local user data as the source of truth for the app experience.

Server-side cache is used for shared metadata acceleration, candidate releases,
compatibility calculations, and admin/proposal workflows. It is not the user's
primary collection storage.

For compatibility analysis, Vertax temporarily stores a normalized collection index on the server under an anonymous local UUID. This index is used only for compatibility math and expires after inactivity. The Redis key is `collection_index:{user_id}:{collection_hash}` with a sliding 30-day TTL.

For "Что докопать" recommendations, wishlist, hidden, and owned candidate
statuses stay local on the device in `localStorage`. Hidden/owned IDs may be
sent as exclusions in one request, but the server does not persist those
statuses.

AI DJ verdicts are also temporary cached explanations. Their Redis key includes prompt version and language:

```text
ai_verdict:{prompt_version}:{lang}:{release_id}:{collection_hash}
```

They use a 30-day TTL and can be regenerated when prompt logic changes.

## Product Principles

- Keep `/` stable and working.
- Do not require login for the core local collection workflow.
- Prefer graceful degradation inside WebViews.
- Prefer local-first behavior for user data.
- Keep vinyl-specific constraints visible: side, position, same-record warning, BPM, Key, Camelot.
- Manual correction must remain easy because metadata sources are imperfect.
- The app should work in bad network conditions after the first successful load.
- AI should support the current app language and must remain subordinate to math-based compatibility.

## Current Constraints

- Vercel Hobby has a serverless function limit. The project should stay at or below 12 functions unless deployment changes.
- Some external services may be unavailable or rate-limited.
- Gemini/Groq AI providers may be unavailable, out of quota, or missing keys; the app must fail gracefully.
- The app currently does not perform general web search for release research. Any richer public web context should be added through an explicit search API and cached separately.
- Prompt/confirm dialogs are not reliable in Telegram/VK/MAX WebViews; use in-app modals.
- The current client architecture is vanilla JS with global state and patch installers. Changes should be careful and localized.
- The only permanent app-level BPM/Key attribution footer should be the global
  `.vertax-global-footer` from `index.html`. Do not add duplicate in-view
  footers.
