# iPhone provider and privacy review

Reviewed 2026-11-09 against the local native and proxy source and the public documents linked below. This is an engineering inventory, not legal advice, a provider approval, or a finding that the integration is permitted or prohibited. No production configuration, cache, credentials, or user records were changed.

## Confirmed in code

| Path | Data sent and retained |
| --- | --- |
| Native metadata transport | [VertaxAPI](Vertax/Domain/VertaxAPI.swift) uses a single ephemeral session for Find, public Discogs import, edition and tracklist loads, and release analysis. Cookies, credential storage and the URL response cache are disabled. The app sends GET requests to Vertax without an app account, user ID, collection hash, or personal crate. The host still receives an IP address and ordinary network/request metadata. |
| Discogs edition search, import and release details | The client sends `q` or `catno`, a public `username` and pagination, or a release `id`, respectively. [The Discogs proxy](../../api/discogs.js) calls the official API with a server-side token and forwards the upstream JSON; iOS decodes a subset. The proxy sets `Cache-Control: no-store` and does not implement its own response cache. This says nothing about hosting or upstream logs. Import sends the parsed username, not the pasted profile URL or a password. |
| Local Discogs data and backups | [Stores](Vertax/Domain/Stores.swift) persist release and saved-track records without an automatic expiry or refresh policy. The native JSON [backup](Vertax/Domain/LibraryBackup.swift) contains those saved records, along with local sets and wishlist references; it does not include a separate field for the source profile username. Importing a public profile still copies the association implicit in which releases were imported. The native display uses generated covers and does not render Discogs images or marketplace prices. The system or a chosen Files provider can back up or sync local files independently of Vertax. |
| BPM/Camelot lookup | The client sends `artist`, `title` and optional `label` to [the Beatport lookup proxy](../../api/beatport-lookup.js). For release analysis those terms come from the selected public pressing. The proxy checks the shared Redis cache and in-process cache and queries `api.beatport.com/v4` when needed. [Cache writes](../../lib/redis-cache.js) use a normalized artist/title/label identity. Successful Redis track records have **no configured TTL** and can include the artist and title as entered in the lookup. A lookup miss is cached for seven days. The in-process success cache has no explicit expiry and lasts at most for the process lifetime. Neither cache is a user account history, but lookup terms and metadata can persist. Saving a result locally can also put that metadata in a backup. |
| Offline and external paths | Gap analysis, scoring, backup import/export processing, set operations, and manual edits run locally; the native app does not call the web collection-index, candidates, or AI endpoints. Explicit browser links to Discogs, Beatport, and Vertax catalog/support are separate from the native URLSession and can follow their own cookie and privacy practices. Clearing the library in Settings does not erase previously exported files, device backups, server caches, or logs. |

## Attribution check

- Settings > About contains the Discogs non-affiliation and trademark notice. The Discogs attribution beside Crate, Wishlist, saved release tracks, and the set source picker uses the exact release URL when a Discogs ID is known. Release detail attributes its header and its online tracklist.
- Both edition searches link each result to its own Discogs release page. The analysis header links its selected pressing; local Discogs pairs and gap examples link back to the corresponding release when known.
- This is not a coverage certification. Build and Live use separate compact rows and do not provide per-entry attribution. A legacy or manually created entry without a source ID cannot provide a reliable source link. Confirm the required presentation for those surfaces and for backup-derived records.
- Find and release analysis link to the matching Beatport page when the response supplies a validated URL. The saved record schema does not retain that URL, so saved, offline, or older cached results cannot always show a functional Beatport source link. Confirm the required behavior and handling of records without a link before distribution; do not invent a URL.

## Public sources and questions

### Discogs

[Discogs API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use), last updated May 27, 2025. The terms distinguish listed CC0 catalog metadata from restricted data such as a profile username and collection, user-contributed images and marketplace data. They address retention for only as long as needed, display when the source has newer data by more than six hours, commercial restrictions and attribution. The six-hour language concerns how stale displayed data is relative to Discogs, not a stated TTL for every copy.

- Is it acceptable for a native app to save a user-initiated, offline snapshot of a public collection without keeping the source username, including when the public profile is someone else's? Is there a permission or consent requirement for that distinction?
- May the app let the user export and restore that snapshot via Files, including to a provider the user chooses? Does the answer differ for release/track metadata, the set of imported release IDs, or user notes and overrides?
- What refresh, offline display and retention rules should apply to the snapshot and independently saved release/track records? Are source links in the library and detail views sufficient for the compact Build/Live views and exports?
- Which parts of the app must remain free, and would the owner's planned pricing, subscriptions, ads or other commercial use require written approval or changes to the integration?

### Beatport

[Beatport Terms and Conditions, section F](https://support.beatport.com/hc/en-us/articles/4414997837716-Terms-and-Conditions), page updated September 28, 2026. Section F discusses pre-approved licensees and approved domains, express permission for product/service use, written approval for commercial use and a functional link to associated content.

- Who holds the Vertax agreement or written approval? Does it cover the proxy domain and native iOS distribution, the publisher, normalized BPM and Camelot, and the intended free or paid model? A successful credential check does not establish those rights.
- Is shared Redis reuse across web and iOS permitted? Which fields, TTL and refresh/deletion limits apply to cached successes and misses? May users retain BPM/key offline, edit it, and include it in Files backups?
- What source-link and attribution treatment is required when the upstream result lacks a URL or an old saved entry has no link?

### Apple and the publisher

[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy) 5.1.1 calls for a privacy policy in the app and App Store Connect, including retention and deletion. [Section 5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) addresses third-party service rights and evidence on request. [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) distinguishes processing needed to serve a request from off-device data accessible afterward. An ephemeral session, no analytics SDK and the UserDefaults manifest do not determine the App Privacy label.

- Who is the App Store publisher and what privacy contact and request process will it publish? Approve and verify a working policy URL before adding it to Settings and App Store Connect. The support link is not the policy.
- What do hosting, edge/security services, Redis and providers actually retain, for how long, for what purposes, and who can access or link the records? Confirm how requests to delete eligible data are handled. Use that inventory to determine data types, purpose, linkage and tracking in App Store Connect; do not preselect Data Not Collected.
- Keep the applicable approvals for Apple Review. If a provider scope cannot be confirmed, decide what to exclude or redesign in the distributed build before submission without deleting existing users' records.

## Not yet verified

- Written provider approvals, applicable account terms, publisher identity, the final business model and regions.
- Deployed host/CDN/firewall log fields, access, query/IP retention and exports; Discogs/Beatport processing and log retention for this integration; Redis deployment retention, backups and operator policies beyond the TTL calls in source.
- The rules for displaying stale or offline snapshots and exporting them, and complete attribution/source-link coverage across all layouts, legacy records and backup paths.
- The final public privacy URL, App Privacy answers and Apple Review outcome. No agreements were accepted and neither provider was contacted.
