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

Build command, once an iOS simulator runtime is installed in Xcode:

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj \
  -scheme Vertax \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Compiler-verification command used locally:

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj \
  -target Vertax \
  -sdk iphonesimulator \
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

Full Xcode is selected on this machine:

```bash
xcode-select -p
# /Applications/Xcode.app/Contents/Developer
```

The SwiftUI target compiles with:

```bash
cd mobile/vertax-native-ios
xcodebuild -project Vertax.xcodeproj \
  -target Vertax \
  -sdk iphonesimulator \
  CODE_SIGNING_ALLOWED=NO \
  build
```

The shared scheme is present, but `xcodebuild -scheme Vertax` currently cannot find a runnable destination because no iOS simulator runtime is installed in Xcode yet. Install a simulator runtime in Xcode Settings before visual QA / Run:

- Xcode -> Settings -> Components
- install an iOS Simulator runtime
- open `mobile/vertax-native-ios/Vertax.xcodeproj`
- select the `Vertax` scheme and a simulator

The local CLI build currently keeps `Assets.xcassets` out of the Resources phase because this Xcode installation has no available simulator runtimes and `actool` fails before Swift compilation. Re-enable the asset catalog and app icon setting before TestFlight.

## App Store Checklist

- Apple Developer account and signing team configured in Xcode.
- Production icon and launch screen.
- Privacy policy URL.
- App Store screenshots for required devices.
- Real device testing for offline launch, Live Set Mode readability, and import flows.
- Replace demo `Record.sample` seams with real persistence/API wiring only after the UI foundation is stable.
