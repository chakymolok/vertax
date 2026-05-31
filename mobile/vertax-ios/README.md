# Vertax iOS

This folder contains the Capacitor iOS wrapper for the existing Vertax web app.

The production web app remains in the repository root. The iOS wrapper uses the root `public/` build output as its web bundle.

## Commands

```bash
cd mobile/vertax-ios
npm run sync
npm run open
```

`npm run sync` rebuilds the root Vertax app and syncs it into the native iOS project.

## App Store Notes

- Bundle ID: `com.nineteenninetyfourlab.vertax`
- App name: `Vertax`
- Source of truth for app UI: root web app files and `public/` build
- Native project: `mobile/vertax-ios/ios`

Before App Store submission, prepare:

- production app icon set;
- launch screen;
- privacy policy URL;
- App Store screenshots;
- Apple Developer Team selection in Xcode;
- camera/audio/photo permissions only if the product truly needs them.
