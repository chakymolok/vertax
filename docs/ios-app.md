# Vertax iOS App

Vertax iOS now has two separate mobile experiments:

```text
mobile/vertax-native-ios/   native SwiftUI app target
mobile/vertax-ios/          older Capacitor wrapper experiment
```

The native SwiftUI app is the current direction for App Store work. The existing Vertax web app remains a separate web product and should not be moved, rewritten, or used as the mobile app source.

## Native SwiftUI Target

Source:

```text
ios-handoff/
```

Runnable Xcode project:

```text
mobile/vertax-native-ios/Vertax.xcodeproj
```

Build command, once full Xcode with iOS Simulator SDK is selected:

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj \
  -scheme Vertax \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Current app identity:

- App name: `Vertax`
- Bundle ID: `com.nineteenninetyfourlab.vertax`
- Minimum target: iOS 16
- Runtime data: `Record.sample`, offline-first
- Design source: `ios-handoff/prototype/Vertax iOS Prototype.html`

## Source Layout

```text
Vertax/
  VertaxApp.swift
  DesignSystem/
  Domain/
  Components/
  Navigation/
  Screens/
  Assets.xcassets/
```

`ios-handoff/AGENTS.md` is the build instruction source of truth. Keep visual values on the design tokens and keep scoring/math separate from verdict copy.

## Current Verification

On this machine only Command Line Tools are active, not full Xcode. Because of that, `xcodebuild` cannot access the iOS Simulator SDK here.

Checks that do pass locally:

```bash
plutil -lint mobile/vertax-native-ios/Vertax.xcodeproj/project.pbxproj
find mobile/vertax-native-ios/Vertax -name '*.swift' -print | sort | \
  xargs -I{} sh -c 'swiftc -parse "$1" >/dev/null || exit 1' sh {}
```

Before TestFlight, run the full `xcodebuild` command above on a machine where `/Applications/Xcode.app` is selected:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## App Store Checklist

- Apple Developer account and signing team configured in Xcode.
- Production icon and launch screen.
- Privacy policy URL.
- App Store screenshots for required devices.
- Real device testing for offline launch, Live Set Mode readability, and import flows.
- Replace demo `Record.sample` seams with real persistence/API wiring only after the UI foundation is stable.
