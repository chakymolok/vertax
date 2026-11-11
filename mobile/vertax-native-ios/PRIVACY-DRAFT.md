# Vertax for iPhone privacy policy draft

Owner review is required before publication. Confirm the publisher identity, privacy contact, retention/deletion process, hosting logs and provider practices. See the [provider review](PROVIDER-REVIEW.md). This draft applies to the iPhone app.

## On-device data

The iPhone app stores your crate, named sets, draft set, wishlist, recent successful track searches and preferences locally. It does not sync these to a Vertax account. While using Live Mode, the device also keeps the cue order, played position, mode and timing so you can resume after leaving the app. Ending Live Mode removes its progress. Settings can clear library data, Live Mode progress and recent track searches.

A Vertax JSON backup includes the crate, including saved release and track metadata, named sets, draft and wishlist. It does not include Live Mode progress. A TXT export contains the current draft's tracklist, not your whole crate or Live Mode progress. The app writes these files to the location you choose in Files, or you can share the tracklist through the system share sheet. Depending on your device settings, chosen Files provider or sharing destination, copies may be stored or synced by iCloud or another service. Clearing app data does not remove exported copies or device backups.

## Online features

When you look up a track, the app sends the artist and title, and a label when available, to Vertax. The service checks a shared metadata cache and uses Beatport on a cache miss. Successful entries can retain the queried artist and title, the normalized lookup identifier and track metadata without an automatic expiry. Cached misses expire after seven days. When you search Discogs, import a public collection or view an imported tracklist, the app sends the search text or catalog number, public username or release ID to Vertax, which forwards the request to Discogs. Vertax does not request your Discogs password.

Checking a vinyl release sends the selected public Discogs release ID to Vertax. To find BPM and Camelot, the app may then send artist, title and label terms from that public release. Vertax uses the existing metadata lookup service described above. The iPhone app compares the results with your crate on the device. Gap analysis is also on-device; if you open the public catalog from Gaps, no crate or gap parameters are included in the link.

These requests do not send the crate, manual edits, set order, Live Mode progress, wishlist, collection hash or an app-generated user ID. The app's native API requests do not use cookies. Hosting receives the connection IP address and technical request details. Hosting and provider log fields and retention have not yet been confirmed. The iPhone app does not include advertising, cross-app tracking or third-party analytics SDKs.

When you open a Discogs, Beatport, catalog or support link, the website you visit can apply its own privacy policy and use browser cookies. That browsing is separate from the app's native API requests.

## Contact

[Owner to confirm the publisher's legal name, monitored privacy contact and request/deletion process before publishing. The general support link is not a confirmed privacy contact.]
