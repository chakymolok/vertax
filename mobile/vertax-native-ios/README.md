# Vertax Native iOS

Vertax for iPhone is a SwiftUI crate, BPM/Camelot lookup, set builder and live set tracker for vinyl DJs. The iOS target builds separately from the web app and uses the existing Vertax API for online metadata.

## Build

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj -scheme Vertax -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Run the end-to-end tests on a disposable iPhone simulator. Each test gets an isolated app data suite. Debug simulator tests intercept requests with local fixtures for metadata, offline and error responses. The backup test uses a temporary JSON file in Files:

```bash
xcodebuild -project Vertax.xcodeproj -scheme Vertax \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro Max' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
```

Run the local model checks on macOS from this directory:

```bash
swiftc Vertax/Domain/{Record,Camelot,LibraryBackup}.swift \
  Tests/LibraryBackupTests.swift -o /tmp/vertax-library-backup-tests
/tmp/vertax-library-backup-tests

swiftc Vertax/Domain/{Record,Camelot,SetPlanner,CrateDig,VertaxAPI}.swift \
  Tests/CrateDigTests.swift -o /tmp/vertax-crate-dig-tests
/tmp/vertax-crate-dig-tests

swiftc Vertax/Domain/LiveProgress.swift Tests/LiveProgressTests.swift -o /tmp/vertax-live-progress-tests
/tmp/vertax-live-progress-tests
```

The app target bundles `Assets.xcassets` (including the AppIcon) and `PrivacyInfo.xcprivacy`. See [App Store release notes](APP-STORE.md) for listing copy and [Release readiness](RELEASE-READINESS.md) for checks and open publication items.

## Source

- App entry: `Vertax/VertaxApp.swift`
- Design system: `Vertax/DesignSystem`
- Domain logic: `Vertax/Domain`
- Components: `Vertax/Components`
- Navigation: `Vertax/Navigation`
- Screens: `Vertax/Screens`

The crate, draft, named sets, wishlist and preferences are local. Settings can export a versioned JSON backup or merge a supported iPhone or web file. Onboarding can load an optional demo crate. Discogs edition search, public collection import, online tracklists and remote BPM/Key lookup require network access. Dig compares tracks and vinyl pressings against your crate on-device, and Gaps identifies useful tempo and Camelot targets without an internet connection.
