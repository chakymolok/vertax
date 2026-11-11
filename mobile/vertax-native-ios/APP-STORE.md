# Vertax 1.0 for iPhone

This is a listing draft for the current native app, not a submission-ready build. See [Web to iPhone](WEB-TO-IOS.md) for scope and [Release readiness](RELEASE-READINESS.md) for local verification and submission blockers.

## Listing draft

- Name: Vertax
- Subtitle: Vinyl DJ crate & set builder
- Primary category: Music
- Keywords: vinyl,DJ,Camelot,BPM,key,records,Discogs,crate,harmonic,mixing,setlist
- Support URL (proposed; verify before submission): https://vertax.live/about#contact
- Bundle ID: `com.nineteenninetyfourlab.vertax`
- Version and build in source: `1.0 (1)`. Check App Store Connect for an existing build before assigning a number.

**Description**

Organize your records, look up track tempos and keys, and build a set you can take to the decks.

- Import vinyl from a public Discogs collection, search for an edition, or add an entry by hand.
- Search for BPM and Camelot key by artist and track title. Edit the values and sleeve position in your crate, or double or halve a tempo.
- Check a track or vinyl pressing against your crate. See compatible pairs and fill missing BPM or Camelot for the current analysis without changing your crate.
- Find thin spots in the tempos and Camelot keys you already play.
- Build a set from records or tracks, or preview one by genre and estimated play time. Save named sets, pick up your running order in Live Mode after closing the app, or export a tracklist as TXT. Live Mode is a cue sheet for physical records; it does not play audio.
- Export a local backup or merge a Vertax backup from iPhone or web.

Your crate stays on your device. Saved entries, the set builder, TXT export and Live Mode are available offline. Discogs import, full pressing tracklists and online metadata lookups require a connection.

## Русская карточка

- Название: Vertax
- Подзаголовок: Виниловый ящик и DJ-сеты
- Ключевые слова: винил,пластинки,диджей,сет,BPM,Camelot,тональность,Discogs,коллекция

Собери ящик для виниловых сетов. Импортируй пластинки из публичной коллекции Discogs или добавь запись вручную. Найди BPM и Camelot по артисту и названию трека. Исправь темп, тональность и сторону пластинки прямо в ящике.

Проверь, с чем сочетается трек или целая пластинка. Vertax покажет пары из твоей коллекции и треки без BPM или Camelot. Недостающие значения можно ввести для текущего анализа, не меняя коллекцию. Собери сет вручную или по жанру и примерной длительности, сохрани треклист в TXT и следи за списком в Live Mode.

Ящик, черновик сета, ход выступления и вишлист хранятся на устройстве. В Live Mode можно вернуться к текущему треку после закрытия приложения. Этот режим помогает следить за порядком пластинок и не воспроизводит аудио. Интернет нужен для импорта из Discogs, загрузки трек-листов и поиска метаданных.

## Review notes

**Notes for App Review**

No login or network is required to try the local workflow. Choose English on the first screen, tap Continue twice, then select Continue with demo crate. Open Build, tap Build from crate, and choose Start Live. Mark a track played, tap the down chevron to pause, and choose Resume Live to return to that position.

Online lookup and Discogs import are separate from the demo. Add an online review example only after the publisher verifies provider permission and confirms a currently working public example.

## Before submission

1. The owner has no App Store Connect account yet. Select the publisher and enroll in the Apple Developer Program before registering an app and configuring distribution signing. The project team ID `SC89VBYYY6` may be a Personal Team. Paid membership and ownership or availability of the bundle ID are unverified. Once the publisher and bundle ID are confirmed, validate a signed Release archive, upload it and test the processed build on a physical iPhone via TestFlight.
2. Review and publish a public privacy policy, then add its verified URL in the app and App Store Connect. Confirm the App Privacy answers against actual hosting logs, third-party processing, cache retention and whether data is linked to a user. The required-reason manifest covers app-local UserDefaults use; it is not a Data Not Collected determination.
3. Resolve the provider checks below with the publisher before submission. Keep the listing scoped to verified native features.
4. Set the App Review contact, age rating and export-compliance answers from verified owner information. Confirm countries and regions, and any region-specific declarations, before sending to App Review. Use manual release until the owner approves the distribution configuration.

## Store Screenshots

No final screenshot set is checked in. The prior simulator regression has raw QA images for Crate, Build, Live Mode, Gaps, and other flows; see [Release readiness](RELEASE-READINESS.md). Curate and verify final captures for the listing locales and device sizes. Prefer the offline demo for screenshots that do not depend on provider approval. The proposed support link points to a contact section in the local site source; its public availability has not been checked in this pass. The privacy policy still needs an owner-approved publisher, contact, and public URL.

Apple references: [Membership comparison](https://developer.apple.com/support/compare-memberships/), [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds), [App privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Screenshot sizes](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Provider rights review

See [the provider review](PROVIDER-REVIEW.md) for data flows, confirmed gaps and the questions to resolve with the publisher. This is not confirmation of provider authorization.

- Discogs categorizes release metadata and tracklists as CC0 and treats account collections, usernames, marketplace data and contributed imagery as restricted. It also specifies link attribution, limits stale display and caching, and restricts commercial use of restricted data. Native release search renders text and links, and the crate backup carries local entries without the source profile username. Confirm that the publisher's intended offline retention, export, public-profile import and any commercial distribution are permitted. [Discogs API terms](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- Beatport calls for approved API access, express permission to use its content in a product or service, and a link to the associated content. Native Find renders the validated Beatport link when the existing endpoint supplies it. A successful response from the Vertax server establishes connectivity. The project's approved access and permission to cache and distribute that metadata on iOS remain unverified. [Beatport API terms](https://support.beatport.com/hc/en-us/articles/4414997837716-Terms-and-Conditions)
- Apple may request authorization for third-party service content under guideline 5.2.2. Keep a record of the applicable provider permissions with the review materials. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
