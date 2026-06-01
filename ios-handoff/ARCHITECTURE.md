# Vertax iOS — Architecture

## Navigation map

```
RootView ( TabView, selection = AppRouter.tab )
├── Crate   ─ NavigationStack(path: router.cratePath)
│              └─ CrateView ──tap──▶ ReleaseView(record)
├── Find    ─ NavigationStack(path: router.findPath)
│              └─ FindView (state machine, see below)
├── Build   ─ NavigationStack(path: router.buildPath)
│              └─ BuildView ──tap──▶ ReleaseView(record)
└── Dig     ─ NavigationStack(path: router.digPath)
               └─ DigView  (Analyze | Gaps)

Modally:
  .sheet(item: router.sheet)      → RecordActionsSheet, etc.
  .fullScreenCover(isPresented)   → OnboardingView (first run)
  .fullScreenCover(isPresented)   → LiveSetView    (router.showLiveSet)
```

Navigation is **push** (`navigationDestination`) for record detail, **sheet** for
contextual actions, **fullScreenCover** for onboarding and Live Set Mode.

## Live Set Mode

A full-screen, club-readable performance view (`LiveSetView` + `LiveSession`).
**List-first, not a turntable emulator** — Vertax helps the DJ hold order,
compatibility and the next move in their head.

- **Layout:** one big **NOW PLAYING** block (huge BPM / Camelot / sleeve position)
  with a swipe/advance affordance. There is intentionally **no separate NEXT
  card** — marking the current played promotes the next track to NOW. The
  upcoming track is surfaced in the setlist's next row, tagged "NEXT" with a
  green/yellow/red `LiveCompat` dot + relation label. Below: "Suggested from Crate".
- **Modes:** `from set` (default — plays the prepared Build order) and
  `freestyle` (plays from the whole crate; suggestions drive the next pick).
- **Advance:** big "Mark played · Next" button (primary) **and** left/right swipe
  on the NOW block. Plus Previous and Undo. End set saves to history.
- **State:** `LiveSession` owns `index`, `playedIDs`, `elapsed`, `mode`. A 1s
  Timer publisher ticks `elapsed`. Suggestions are computed live from the crate.
- **Visual:** near-black (#060807), large numerals, high contrast, lime only for
  active/compat. A darkened blurred cover glow sits behind everything.
- **Entry:** `BuildView` "Start Live" (primary) + Crate header button.

## State ownership

| Concern | Owner | Notes |
|---|---|---|
| Which tab / nav paths / active sheet | `AppRouter` | one per app |
| Records owned + filters | `CrateStore` | `@Published var records`, filter predicate |
| Current set order | `SetStore` | ordered `[Record.ID]`, reorder/add/remove |
| Theme: accent, density, scheme | `VertaxTheme` | drives Tweaks; persisted later |
| Per-screen transient UI | local `@State` | e.g. Find/Dig state machines |

## Screen states (ports of the prototype)

**FindView** — `enum FindState { case idle, loading, result(Lookup), notFound(query) }`
idle → loading (≈1.2s) → result | notFound. result has Save-to-crate / Use-in-set.

**DigView (Analyze)** — `enum AnalyzeState { case idle, loading(step:Int), result(AnalyzeResult) }`
idle → loading (4-step checklist, ≈2.2s) → result (animated score ring + verdict + factor bars + matches).

**DigView (Gaps)** — static coverage (tempo histogram + Camelot map) + dig suggestions.

**BuildView** — list of `SetStore.ordered`; `.onMove`/drag handle reorders;
each row shows the live `SetTransition` INTO it; suggested-next computed from last record.

**CrateView** — search text + multi-select filter chips (grouped by kind: BPM / Key /
Genre / flag). Empty state when no match.

**ReleaseView** — header + technical block (Tempo / Camelot / Fit-crate count) +
cue waveform + tracklist + harmonic neighbours + notes + sticky action bar.

## Data flow for "fit" features

`Record` --(Camelot, bpm, genre)--> `AnalyzeEngine.analyze(target:against:)`
returns `AnalyzeResult{ score, verdict, bars, matches }`. Compatibility is **pure
math** (harmonic + tempo + style); the verdict copy only narrates the number.
Keep that separation — never let copy invent a score.

## Discogs import

`DiscogsImporter` (`ObservableObject`) drives the import sheet: `parseHandle`
extracts a username from a pasted profile URL / @handle / bare name, then `run`
stages a 4-step load (`ImportState`: idle → loading(step) → done(summary)) and
replaces `CrateStore.records`. Today it loads `Record.sample`; swap that one line
for the real Discogs (or Vertax backend) fetch. Entered from onboarding, the
Crate "+" button, and the Find idle screen. No label-scan exists.

## Settings

Reached from the **gear button in the Crate header** (`router.sheet = .settings`).
`SettingsSheet` (Screens/SettingsView.swift) groups: **Appearance** (accent /
theme / density — bound to `VertaxTheme`, the same values Tweaks exposes),
**General** (language via `@AppStorage`, default BPM), **Collection & Data**
(Discogs import, export crate.json via `ShareLink`, backup), **Privacy** (on-device
/ analytics / crash toggles), **Support** (donate `Link`, About). In production the
Tweaks panel can be dropped and these settings become the single source of truth.

## Theming / Tweaks

`VertaxTheme` exposes `accent`, `density`, `preferredScheme`. Bind these to a debug
Tweaks screen (or remove for production and ship fixed presets). Components read
the theme from the environment; colors are adaptive (light/dark) at the token level.
