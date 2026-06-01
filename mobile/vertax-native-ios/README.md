# Vertax Native iOS

Native SwiftUI app target for Vertax Mobile.

This app is built from the root `ios-handoff/` package and is intentionally independent from the existing Vertax web codebase.

## Build

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj -scheme Vertax -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

If the local Xcode installation has no simulator runtimes installed yet, use the target build for compiler verification:

```bash
xcodebuild -project Vertax.xcodeproj -target Vertax -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

Note: the asset catalog is temporarily kept out of the build phase so command-line verification can pass on machines without installed simulator runtimes. Re-enable `Assets.xcassets` in Resources and `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` before TestFlight / App Store packaging.

## Source

- App entry: `Vertax/VertaxApp.swift`
- Design system: `Vertax/DesignSystem`
- Domain logic: `Vertax/Domain`
- Components: `Vertax/Components`
- Navigation: `Vertax/Navigation`
- Screens: `Vertax/Screens`

The current app runs offline on `Record.sample`. Real Discogs / Vertax API wiring should replace the isolated seams described in `ios-handoff/AGENTS.md`.
