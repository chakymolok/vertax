# Vertax iOS App

Vertax iOS is a Capacitor wrapper around the existing Vertax web application.

The root web app remains the main product surface for web, Telegram, VK, MAX, and Vercel. The iOS folder is intentionally separate:

```text
mobile/vertax-ios/
```

This keeps App Store packaging, Xcode settings, signing, icons, and native shell concerns away from the working web app.

## Build Flow

```bash
cd mobile/vertax-ios
npm run sync
npm run open
```

`npm run sync` runs the root build first:

```bash
cd ../.. && npm run build
```

Then Capacitor syncs the generated `public/` bundle into the native iOS project.

## API Origin

Inside the iOS shell the app does not run from `https://vertax.live`; it runs from a native WebView origin. Because of that, relative `/api/*` URLs would otherwise point at the native shell and fail.

The shared `vertaxApiUrl()` helper detects the Capacitor/iOS origin and sends API requests to:

```text
https://vertax.live
```

For special builds this can be overridden before the app boots:

```js
window.VERTAX_API_ORIGIN = 'https://example.com';
```

## Current App Identity

- App name: `Vertax`
- Bundle ID: `com.nineteenninetyfourlab.vertax`
- Capacitor config: `mobile/vertax-ios/capacitor.config.json`
- Native iOS project: `mobile/vertax-ios/ios`

## Product Rules

- Do not move the current web app from `/`.
- Do not fork product logic into the iOS wrapper.
- Keep collection storage backward compatible.
- Keep server APIs shared with the web app.
- Add native permissions only when a feature needs them.

## App Store Checklist

- Apple Developer account and signing team configured in Xcode.
- Production icons and launch screen.
- Privacy policy page.
- App Store screenshots for required devices.
- Review external account/API wording if Discogs, Telegram, or external services are referenced.
- Test poor-network and offline startup behavior on a real device.
