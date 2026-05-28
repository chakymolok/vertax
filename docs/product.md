# Vertax Product Documentation

## Overview

Vertax is a web tool for vinyl DJs, diggers, and record collectors. It helps users find and organize vinyl releases, manage a local record collection, enrich tracks with BPM and Key metadata, and build DJ sets by BPM, Camelot compatibility, genre, and flow.

The main app lives at `/`. The SEO landing page lives at `/about`. The `/vk` route is reserved for a future VK Mini App version.

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
2. Vertax routes to source selection when relevant.
3. User chooses current session, whole collection, or selected records.
4. User chooses mode:
   - best flow;
   - tempo-safe;
   - Camelot-safe;
   - Camelot filter;
   - custom/manual flow in extended patches.
5. Vertax generates an ordered track list.
6. User can edit, reorder, export, save, or enter Live Mode.

### Backup And Restore

1. User opens backup.
2. Vertax exports local IndexedDB data to a JSON file.
3. User stores the file manually.
4. Restore can replace or merge the current collection.

## Data Ownership

The primary collection lives locally in the user's browser via IndexedDB. Vertax should treat local user data as the source of truth for the app experience.

Server-side cache is used for shared metadata acceleration and admin/proposal workflows, not as the user's primary collection storage.

## Product Principles

- Keep `/` stable and working.
- Do not require login for the core local collection workflow.
- Prefer graceful degradation inside WebViews.
- Prefer local-first behavior for user data.
- Keep vinyl-specific constraints visible: side, position, same-record warning, BPM, Key, Camelot.
- Manual correction must remain easy because metadata sources are imperfect.
- The app should work in bad network conditions after the first successful load.

## Current Constraints

- Vercel Hobby has a serverless function limit. The project should stay at or below 12 functions unless deployment changes.
- Some external services may be unavailable or rate-limited.
- Prompt/confirm dialogs are not reliable in Telegram/VK/MAX WebViews; use in-app modals.
- The current client architecture is vanilla JS with global state and patch installers. Changes should be careful and localized.

