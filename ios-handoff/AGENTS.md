# AGENTS.md — Build instructions for Codex

> **Task:** Build the **Vertax iOS** app (native SwiftUI) from this package.
> This folder is the source of truth for the **mobile** app. Do **not** touch or
> depend on the existing `vertax.live` web app — this is a parallel codebase.

You are assembling a runnable SwiftUI app from a complete design system + domain
layer + components + screen scaffolds. Most of the hard parts (tokens, harmonic
math, scoring, navigation, Live Set Mode, Discogs import, Settings) are already
written. Your job is to wire them into an Xcode app target, flesh out the screen
bodies to match the prototype, and keep everything on tokens.

---

## 0. Read these first
- `README.md` — package contents + brand constants.
- `ARCHITECTURE.md` — navigation map, state ownership, per-screen states, and
  notes for Live Set Mode, Discogs import and Settings.
- **`prototype/Vertax iOS Prototype.html`** (in this package) — the **visual &
  behavioural source of truth**. Every screen, animation and state is implemented
  there. When in doubt about layout, spacing, copy or interaction, match the
  prototype exactly. Open it in a browser and click through it.

## 1. Project setup
1. Create a new **iOS App** target named `Vertax`, **SwiftUI** lifecycle,
   **minimum iOS 16.0**. No third-party dependencies.
2. Add every `.swift` file from this package, preserving the folder groups
   (DesignSystem / Domain / Components / Navigation / Screens).
3. Replace the generated `App` struct with:

```swift
@main
struct VertaxApp: App {
    @StateObject private var theme  = VertaxTheme()
    @StateObject private var crate  = CrateStore()
    @StateObject private var setS   = SetStore()
    @StateObject private var router = AppRouter()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(theme)
                .environmentObject(crate)
                .environmentObject(setS)
                .environmentObject(router)
                .preferredColorScheme(theme.preferredScheme)
                .tint(theme.accent)
        }
    }
}
```

4. Build & run. It must compile and launch into onboarding on `Record.sample`
   data with no network. Fix any compile errors before adding features.

## 2. What's DONE vs what you must finish
**Done (use as-is, do not rewrite):**
- `DesignSystem/*` — all tokens (color, type, metrics, motion, theme).
- `Domain/*` — `Camelot`, `Record` (+ `Record.sample`), `SetTransition`,
  `AnalyzeEngine`, `Stores` (CrateStore/SetStore/AppRouter), `LiveSession`,
  `DiscogsImport`.
- `Components/*` — VxCard, VxChip, VxKeyBadge, VxBpmText, VxButton, VxSegmented,
  VxVerdictPill, VxRecordRow, VxBar, VxCover, VxScoreRing, VxWaveform, VxTabBar.
- `Navigation/RootView.swift` — TabView + per-tab NavigationStack + sheets +
  onboarding/live-set covers.
- `Screens/LiveSetView.swift`, `Screens/ImportView.swift`,
  `Screens/SettingsView.swift` — fully built, match the prototype.

**To finish (these are structural scaffolds — flesh out the bodies to match the
prototype 1:1):** in `Screens/Screens.swift`:
- `CrateView` — wired; verify chips/search/empty match prototype.
- `ReleaseView` — wired; add the harmonic-neighbours strip + tracklist exactly.
- `FindView` — state machine done; fill `FindIdle` (recents + "Import from
  Discogs" card — **no label-scan**), `FindResult` full result card.
- `BuildView` — uses `.onMove` reorder; verify transition labels + suggested-next.
- `DigView` — Analyze state machine + score animation done; flesh `GapsBody`
  (tempo histogram + Camelot map) from the prototype.
- Sub-views marked "see prototype" are intentionally stubbed.

## 3. Non-negotiable conventions
1. **Tokens only.** No literal colors, font sizes, paddings or radii in views.
   If a value is missing, add it to the DesignSystem, don't inline it.
2. **Lime is a signal, never a large fill.** Active tab, dots, BPM/Key,
   compatibility, status only. For accent-colored *text*, use
   `theme.accentText(scheme)` (raw lime is unreadable on the light theme).
3. **Math owns the score.** Compatibility/fit come from `AnalyzeEngine` and
   `SetTransition`/`LiveCompat`. Verdict copy only narrates the number — never
   let copy invent or change a score.
4. **Monospaced = technical data** (BPM, Camelot, catalog #, labels). Never for
   long-form text.
5. **Progressive disclosure.** Detail lives in push views and sheets; keep cards
   calm and uncluttered. Bottom sheets for contextual actions.
6. **Offline-first.** Every screen must run on `Record.sample` with no network.

## 4. Feature checklist (acceptance — compare against the prototype)
- [ ] **Onboarding** 3 steps → Import from Discogs / Add manually / Continue with demo.
- [ ] **Tab bar** Crate / Find / Build / Dig switches; lime active tab.
- [ ] **Crate** live search + multi-select filter chips (OR within a kind, AND
      across kinds), tempo-sorted, empty state; tap a record → Release (push).
- [ ] **Release** cover + technical block (Tempo / Camelot / Fit-crate) + cue
      waveform + tracklist + harmonic neighbours + notes + sticky Add-to-set bar.
- [ ] **Find** idle (recents + Discogs import card) → loading → result (BPM /
      Camelot / key / confidence / source) → not-found.
- [ ] **Build** drag-to-reorder, live `SetTransition` label into each row,
      tempo-flow + harmonic %, suggested next, **Start Live** entry.
- [ ] **Dig / Analyze** input → 4-step loading checklist → animated count-up score
      ring + verdict + factor bars + matches.  **Dig / Gaps** tempo + Camelot coverage.
- [ ] **Live Set Mode** big NOW PLAYING (BPM/Camelot/sleeve) + swipe/Next, setlist
      with NEXT compat cue, suggestions, From-Set/Freestyle, timer, Prev/Undo/End.
- [ ] **Discogs import** paste profile/username → staged load → summary → Go to crate.
- [ ] **Settings** (gear in Crate header): Appearance (accent/theme/density),
      Language, Collection & Data (import/export/backup), Privacy, Support/About.
- [ ] **Tweaks** are a debug affordance; Settings is the shippable surface — you
      may drop the live-tweak wiring and keep fixed presets for release.

## 5. Wiring real data (after the UI matches)
Everything is stubbed to `Record.sample` so the app runs offline. Replace these
seams with the real Vertax backend / Discogs API — they are isolated on purpose:
- `Record.sample` — the demo crate. Swap for persisted/fetched records.
- `DiscogsImporter.run(into:)` — the line `let recs = Record.sample` is the only
  fetch point; replace with the real Discogs collection fetch + mapping to
  `Record` (artist/title/label/catalog/year/bpm/keyCode/genre). Keep the staged
  `ImportState` UX.
- `FindView.lookup(_:)` — demo BPM/Key DB; swap for the real lookup service.
- `Sleeve.map` — placeholder A/B-side positions; populate from real release data.
- Persistence: back `CrateStore` / `SetStore` with SwiftData or a JSON store on
  disk; keep the published API the same so views don't change.

## 6. Definition of done
- App compiles, launches offline, and every item in §4 matches the prototype's
  layout, copy, states and interactions.
- No literal style values in views; everything reads from tokens / `VertaxTheme`.
- No references to the web app; no label-scan UI anywhere.
- Light and dark themes both render correctly; accent is swappable in Settings.

When unsure, the prototype wins. Build it to feel like the prototype.
