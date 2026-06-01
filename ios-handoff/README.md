# Vertax iOS — Handoff Package

Native iOS (SwiftUI) foundation for the **Vertax** vinyl-DJ crate assistant.
This package is the source of truth for the **mobile app** — it is independent
of the existing `vertax.live` webapp and does not touch it.

It mirrors, 1:1, the approved interactive prototype:
**Direction A · Nordic Dark Utility** (dark-first, calm, lime as a micro-signal).

> Target: **iOS 16+**, SwiftUI, no third-party dependencies.
> Architecture: MVVM-lite — value-type domain models + `ObservableObject` stores
> + an `AppRouter` for navigation. All design values are tokens (no magic numbers in views).

## What's inside

```
ios-handoff/
  DesignSystem/      Tokens — the visual contract
    VertaxColor.swift       light+dark color tokens (adaptive)
    VertaxTypography.swift   SF + monospaced type scale
    VertaxMetrics.swift      spacing / radius / sizes / density
    VertaxMotion.swift       animation curves & durations
    Theme.swift              runtime theme (accent, density, scheme) + Tweaks
  Domain/            Pure logic — no UIKit/SwiftUI
    Camelot.swift            Camelot wheel + harmonic relationships
    Record.swift             Record model + sample crate
    SetTransition.swift      transition quality between two records
    AnalyzeEngine.swift      "does it fit my crate?" scoring (math)
    Stores.swift             CrateStore, SetStore, AppRouter
    LiveSession.swift        Live Set Mode session + LiveCompat + Sleeve
    DiscogsImport.swift      paste a profile link → import the collection
  Components/        Reusable SwiftUI views built only from tokens
    Primitives.swift         VxCard, VxChip, VxKeyBadge, VxBpmText,
                             VxButton, VxSegmented, VxVerdictPill, VxListRow
    VxCover.swift            generated record sleeve
    VxScoreRing.swift        animated compatibility ring
    VxWaveform.swift         deterministic waveform
    VxTabBar.swift           Crate / Find / Build / Dig bar
  Navigation/
    RootView.swift           TabView + per-tab NavigationStack + sheets
  Screens/
    Screens.swift            per-screen ViewState enums + view skeletons
    LiveSetView.swift        Live Set Mode — performance screen
    ImportView.swift         Discogs import sheet (idle → loading → done)
    SettingsView.swift       Settings (appearance · language · privacy · data · about)
  ARCHITECTURE.md
```

## How Codex should use this

1. Create a new SwiftUI app target (`VertaxApp`), drop these files in.
2. Inject a single `VertaxTheme` as `@StateObject` at the app root and pass it
   down as `.environmentObject(theme)` (see `RootView`).
3. Build screens against the **Components** — never hardcode colors, paddings or
   fonts. If a value is missing, add it as a token, don't inline it.
4. Wire data from the real Vertax API/IndexedDB later; for now `Record.sample`
   drives every screen so the UI is fully runnable offline. The **Discogs import**
   (`DiscogsImporter`) is the intended entry: paste a profile link/username and it
   pulls the whole collection — currently stubbed to `Record.sample`, swap in the
   real fetch. (There is no label-scan feature — it was removed as out of scope.)
5. **Live Set Mode** is implemented (`Screens/LiveSetView.swift` + `Domain/LiveSession.swift`):
   a club-readable, list-first performance screen. Entered from BuildView
   ("Start Live") and the Crate header; presented as `.fullScreenCover`
   (`AppRouter.showLiveSet`). It is NOT a turntable emulator — it tracks order,
   compatibility, the next move and played history.

## Brand constants

- Wordmark: **VERTAX** · tagline **DIG. PLAY. SHARE.**
- Accent (identity): lime `#C8FF2E` — used ONLY as a signal (active tab, dots,
  BPM/Key highlights, compatibility, status). Never as a large fill.
- Technical data (BPM, Camelot, catalog #, labels) is always **monospaced**.
