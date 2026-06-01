# Vertax Native iOS

Native SwiftUI app target for Vertax Mobile.

This app is built from the root `ios-handoff/` package and is intentionally independent from the existing Vertax web codebase.

## Build

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj -scheme Vertax -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Source

- App entry: `Vertax/VertaxApp.swift`
- Design system: `Vertax/DesignSystem`
- Domain logic: `Vertax/Domain`
- Components: `Vertax/Components`
- Navigation: `Vertax/Navigation`
- Screens: `Vertax/Screens`

The current app runs offline on `Record.sample`. Real Discogs / Vertax API wiring should replace the isolated seams described in `ios-handoff/AGENTS.md`.
