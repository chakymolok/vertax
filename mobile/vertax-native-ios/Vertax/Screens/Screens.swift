import SwiftUI

// MARK: - Screen skeletons
// These are STRUCTURAL ports of the prototype: correct state machines, data
// wiring, navigation and component usage. Visual polish (exact paddings, hero
// blocks, sticky bars) follows the prototype 1:1 — fill in against the tokens.
// Every screen is runnable today on Record.sample.

// =====================================================================
// CRATE
// =====================================================================
public struct CrateView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var router: AppRouter
    @State private var query = ""
    @State private var chips: Set<CrateFilter> = []

    public init() {}
    public var body: some View {
        let records = crate.filtered(query: query, chips: chips)
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: VxSpace.m) {
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text("\(crate.records.count) RECORDS · 7 LABELS")
                        .font(VxFont.labelMono)
                        .tracking(VxTracking.labelMono)
                        .foregroundStyle(VxColor.textTertiary)
                    Text("Crate")
                        .font(VxFont.largeTitle)
                        .tracking(VxTracking.largeTitle)
                        .foregroundStyle(VxColor.text)
                }
                Spacer()
                HStack(spacing: VxSpace.s) {
                    MiniIconButton(system: "play.fill", highlighted: true) { router.showLiveSet = true }
                    MiniIconButton(system: "gearshape") { router.sheet = .settings }
                    MiniIconButton(system: "plus") { router.sheet = .discogsImport }
                }
            }
            .padding(.horizontal, VxSpace.xl)
            .padding(.top, VxSpace.xs)
            .padding(.bottom, VxSpace.m)

            VStack(spacing: 11) {
                VxSearchField(text: $query, placeholder: "Search artist, label, cat #")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        Button { chips.removeAll() } label: { VxChip("All", active: chips.isEmpty) }.buttonStyle(.plain)
                        ForEach(CrateFilter.all) { f in
                            Button { toggle(f) } label: { VxChip(f.label, active: chips.contains(f), mono: true) }.buttonStyle(.plain)
                        }
                    }
                }
            }.padding(.horizontal, VxSpace.xl)

            if records.isEmpty {
                VxEmptyState(system: "magnifyingglass", title: "No records match",
                             message: "Try clearing filters or searching a different label.")
            } else {
                ScrollView {
                    SectionHead(title: "Sorted by tempo", count: "\(records.count) shown")
                    LazyVStack(spacing: 0) {
                        ForEach(records) { r in
                            VxRecordRow(r) { router.openRelease(r) }
                            Divider().overlay(VxColor.hairline)
                        }
                    }.padding(.horizontal, VxSpace.xl)
                }
            }
        }
    }
    private func toggle(_ f: CrateFilter) { if chips.contains(f) { chips.remove(f) } else { chips.insert(f) } }
}

// =====================================================================
// FIND — state machine
// =====================================================================
public enum FindState: Equatable {
    case idle, loading
    case result(BpmKeyLookup)
    case notFound(String)
}
public struct BpmKeyLookup: Equatable, Hashable {
    public let artist, title, label, catalog, key, musicalKey, genre, source: String
    public let bpm, confidence: Int
}
public struct FindView: View {
    @State private var query = ""
    @State private var state: FindState = .idle
    public init() {}
    public var body: some View {
        VStack(spacing: 0) {
            VxScreenHeader(kicker: "FIND · BPM / KEY", title: "Find")
            VxSearchField(text: $query, placeholder: "Artist, title or catalog #", onSubmit: run)
                .padding(.horizontal, VxSpace.xl)
            ScrollView {
                switch state {
                case .idle:        FindIdle(onPick: { query = $0; run() })
                case .loading:     FindLoading()
                case .notFound(let q): VxEmptyState(system: "magnifyingglass", title: "No reliable match",
                                                    message: "Couldn't confirm BPM & key for “\(q)”. Try the catalog number or add it manually.")
                case .result(let r): FindResult(lookup: r) { state = .idle; query = "" }
                }
            }.padding(.top, VxSpace.l)
        }
    }
    private func run() {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        state = .loading
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            if let hit = Self.lookup(query) { state = .result(hit) } else { state = .notFound(query) }
        }
    }
    // Demo database — swap for the real Vertax API.
    static func lookup(_ q: String) -> BpmKeyLookup? {
        let s = q.lowercased()
        let db = [
            BpmKeyLookup(artist:"Nilo Reign", title:"Halflight", label:"Proxima", catalog:"PRX114", key:"8A", musicalKey:"A min", genre:"Deep DnB", source:"Beatport", bpm:172, confidence:96),
            BpmKeyLookup(artist:"Komatic", title:"Northwall", label:"Halftone", catalog:"HLF005", key:"9A", musicalKey:"E min", genre:"UK Bass", source:"GetSongBPM", bpm:174, confidence:92),
            BpmKeyLookup(artist:"Senan", title:"Driftwood Dub", label:"Bunker Dub", catalog:"BNK012", key:"4A", musicalKey:"F min", genre:"Halftime", source:"AcousticBrainz", bpm:86, confidence:81),
        ]
        return db.first { "\($0.artist) \($0.title) \($0.catalog)".lowercased().contains(s) }
    }
}

// =====================================================================
// BUILD — reorderable set
// =====================================================================
public struct BuildView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var router: AppRouter
    public init() {}
    public var body: some View {
        let records = set.records(in: crate)
        VStack(spacing: 0) {
            HStack {
                VxScreenHeader(kicker: "SET · \(records.count) RECORDS · ~\(records.count*4) MIN", title: "Warehouse")
                Spacer()
                // PRIMARY ENTRY into Live Set Mode
                VxButton("Start Live", icon: "play.fill") { router.showLiveSet = true }
                    .frame(width: 130).padding(.trailing, VxSpace.xl)
            }
            List {
                ForEach(Array(records.enumerated()), id: \.element.id) { i, r in
                    BuildRow(index: i, record: r, transition: i > 0 ? SetTransition(from: records[i-1], to: r) : nil)
                        .listRowInsets(EdgeInsets(top: 5, leading: VxSpace.xl, bottom: 5, trailing: VxSpace.xl))
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .onTapGesture { router.openRelease(r) }
                }
                .onMove { set.move(from: $0, to: $1) }   // native drag-to-reorder
            }
            .listStyle(.plain).environment(\.editMode, .constant(.active))
            .scrollContentBackground(.hidden)
        }
    }
}

// =====================================================================
// DIG — Analyze (state machine) + Gaps
// =====================================================================
public enum DigMode: Hashable { case analyze, gaps }
public enum AnalyzeState: Equatable {
    case idle, loading(step: Int)
    case result(AnalyzeResult)
    public static func == (l: AnalyzeState, r: AnalyzeState) -> Bool {
        switch (l, r) { case (.idle,.idle): true; case let (.loading(a),.loading(b)): a==b; case (.result,.result): true; default: false }
    }
}
public struct DigView: View {
    @EnvironmentObject var crate: CrateStore
    @State private var mode: DigMode = .analyze
    @State private var state: AnalyzeState = .idle
    static let steps = ["Fetching Discogs release","Reading tracklist & key","Matching against your crate","Scoring harmonic fit"]
    public init() {}
    public var body: some View {
        VStack(spacing: 0) {
            VxScreenHeader(kicker: mode == .analyze ? "DIG · WORTH IT?" : "DIG · WHAT TO DIG", title: "Dig")
            VxSegmented(selection: $mode, options: [(.analyze,"Analyze"),(.gaps,"Gaps")]).padding(.horizontal, VxSpace.xl)
            ScrollView {
                if mode == .analyze { AnalyzeBody(state: $state, run: runAnalyze) }
                else { GapsBody() }
            }.padding(.top, VxSpace.l)
        }
    }
    private func runAnalyze(_ target: Record) {
        state = .loading(step: 0)
        for s in 1...Self.steps.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(s) * VxMotion.analyzeStepInterval) {
                if case .loading = state { state = .loading(step: s) }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.25) {
            state = .result(AnalyzeEngine.analyze(target: target, against: crate.records))
        }
    }
}

// =====================================================================
// RELEASE detail
// =====================================================================
public struct ReleaseView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var router: AppRouter
    let record: Record
    public init(record: Record) { self.record = record }
    public var body: some View {
        let fitCount = crate.records.filter { $0.id != record.id && record.camelot.relation(to: $0.camelot) != nil }.count
        ScrollView {
            VStack(alignment: .leading, spacing: VxSpace.l) {
                // header
                HStack(spacing: 15) {
                    VxCover(seed: record.coverSeed, catalog: record.catalog, size: 92, radius: 14)
                    VStack(alignment: .leading, spacing: 4) {
                Text(record.artist).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
                        Text(record.title).font(VxFont.title).foregroundStyle(VxColor.text)
                        HStack(spacing: 6) {
                            VxChip(record.genre, mono: true)
                            VxChip(record.year, mono: true)
                            VxChip("★ \(String(format: "%.1f", record.rating))", mono: true)
                        }
                    }
                }
                // technical block
                VxCard {
                    HStack {
                        techCell(label: "Tempo") { VxBpmText(record.bpm, size: 30) }
                        Divider().frame(height: 40).overlay(VxColor.hairline)
                        techCell(label: record.camelot.musicalKey) { Text(record.keyCode).font(VxFont.bpm(30)).foregroundStyle(VxColor.text) }
                        Divider().frame(height: 40).overlay(VxColor.hairline)
                        techCell(label: "Fit crate") { Text("\(fitCount)").font(VxFont.bpm(30)).foregroundStyle(VxColor.text) }
                    }
                }
                // cue preview
                VxCard { VxWaveform(bars: 54, seed: 11, height: 30, lime: true, playhead: 19) }
                SectionHead(title: "Tracklist", count: "4 tracks")
                VxCard(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(releaseTracks(for: record)) { track in
                            ReleaseTrackRow(track: track, highlightedKey: record.keyCode)
                            if track.id != releaseTracks(for: record).last?.id {
                                Divider().overlay(VxColor.hairline)
                            }
                        }
                    }
                }
                SectionHead(title: "Mixes well into", count: "\(fitCount) in crate")
                HStack(spacing: VxSpace.s) {
                    ForEach(harmonicNeighbours(for: record, in: crate.records)) { item in
                        HarmonicNeighbourCell(item: item)
                    }
                }
                // notes
                SectionHead(title: "Notes")
                VxCard { Text(record.notes).font(VxFont.subhead).foregroundStyle(VxColor.textSecondary) }
            }
            .padding(VxSpace.xl)
        }
        .background(VxColor.bg)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                VxButton(set.orderedIDs.contains(record.id) ? "In your set" : "Add to set",
                         icon: set.orderedIDs.contains(record.id) ? "checkmark" : "plus",
                         style: set.orderedIDs.contains(record.id) ? .dark : .primary) { set.add(record.id) }
            }.padding(.horizontal, VxSpace.xl).padding(.vertical, 12).background(.ultraThinMaterial)
        }
        .navigationTitle("").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) {
            Button { router.sheet = .recordActions(record) } label: { Image(systemName: "ellipsis") }
        } }
    }
    @ViewBuilder private func techCell<C: View>(label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 6) { content(); Text(label).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary) }
            .frame(maxWidth: .infinity)
    }
    private func releaseTracks(for record: Record) -> [ReleaseTrack] {
        [
            .init(position: "A1", title: record.title, bpm: record.bpm, key: record.keyCode),
            .init(position: "A2", title: "\(record.title) — Reprise", bpm: record.bpm, key: record.keyCode),
            .init(position: "B1", title: "Undertow", bpm: max(1, record.bpm - 2), key: record.camelot.stepped(by: -1).code),
            .init(position: "B2", title: "Undertow — Dub", bpm: max(1, record.bpm / 2), key: record.camelot.stepped(by: -1).code),
        ]
    }
    private func harmonicNeighbours(for record: Record, in crate: [Record]) -> [HarmonicNeighbour] {
        let keys: [(String, String)] = [
            (record.keyCode, "same"),
            (record.camelot.stepped(by: 1).code, "+1"),
            (record.camelot.stepped(by: -1).code, "−1"),
            (record.camelot.relative.code, "rel"),
        ]
        return keys.map { key, label in
            HarmonicNeighbour(key: key, relation: label, count: crate.filter { $0.keyCode == key && $0.id != record.id }.count)
        }
    }
}

// =====================================================================
// Shared small pieces referenced above (header, search, empty, sheets,
// onboarding, find/analyze sub-bodies). Kept compact; expand against the
// prototype as needed.
// =====================================================================

struct VxScreenHeader: View {
    let kicker: String; let title: String
    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 5) {
                Text(kicker).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                Text(title).font(VxFont.largeTitle).tracking(VxTracking.largeTitle).foregroundStyle(VxColor.text)
            }
            Spacer()
        }.padding(.horizontal, VxSpace.xl).padding(.top, 4).padding(.bottom, 10)
    }
}

struct MiniIconButton: View {
    @EnvironmentObject var theme: VertaxTheme
    let system: String
    var highlighted = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(highlighted ? theme.accent : VxColor.text)
                .frame(width: VxSize.iconButton, height: VxSize.iconButton)
                .background(highlighted ? theme.accentDim : VxColor.card)
                .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous)
                        .strokeBorder(highlighted ? theme.accentLine : VxColor.hairline, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .vxPressable()
    }
}

struct SectionHead: View {
    let title: String
    var count: String? = nil
    var body: some View {
        HStack {
            Text(title)
                .font(VxFont.bodyStrong)
                .foregroundStyle(VxColor.text)
            Spacer()
            if let count {
                Text(count)
                    .font(VxFont.caption)
                    .foregroundStyle(VxColor.textSecondary)
            }
        }
        .padding(.top, VxSpace.m)
        .padding(.bottom, VxSpace.xs)
    }
}

struct ReleaseTrack: Identifiable, Equatable {
    let id = UUID()
    let position: String
    let title: String
    let bpm: Int
    let key: String
}

struct ReleaseTrackRow: View {
    let track: ReleaseTrack
    let highlightedKey: String
    var body: some View {
        HStack(spacing: VxSpace.m) {
            Text(track.position)
                .font(VxFont.labelMono)
                .tracking(VxTracking.labelMono)
                .foregroundStyle(VxColor.textTertiary)
                .frame(width: 24, alignment: .leading)
            Text(track.title)
                .font(VxFont.subhead)
                .foregroundStyle(VxColor.text)
                .lineLimit(1)
            Spacer()
            Text("\(track.bpm)")
                .font(VxFont.bpm(14))
                .foregroundStyle(VxColor.text)
            VxKeyBadge(track.key, highlighted: track.key == highlightedKey)
        }
        .padding(.horizontal, VxSpace.m)
        .padding(.vertical, VxSpace.s)
    }
}

struct HarmonicNeighbour: Identifiable {
    var id: String { "\(key)-\(relation)" }
    let key: String
    let relation: String
    let count: Int
}

struct HarmonicNeighbourCell: View {
    let item: HarmonicNeighbour
    var body: some View {
        VxCard(padding: VxSpace.s) {
            VStack(spacing: VxSpace.xs) {
                Text(item.key)
                    .font(VxFont.bpm(17))
                    .foregroundStyle(item.relation == "same" ? VxColor.lime : VxColor.cyan)
                Text("\(item.relation) · \(item.count)")
                    .font(VxFont.caption)
                    .foregroundStyle(VxColor.textTertiary)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct DigSuggestion: View {
    let title: String
    let subtitle: String
    var body: some View {
        VxCard {
            HStack(spacing: VxSpace.m) {
                Image(systemName: "flame")
                    .foregroundStyle(VxColor.lime)
                    .frame(width: 34, height: 34)
                    .background(VxColor.lime.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text(title)
                        .font(VxFont.bodyStrong)
                        .foregroundStyle(VxColor.text)
                    Text(subtitle)
                        .font(VxFont.caption)
                        .foregroundStyle(VxColor.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(VxColor.textTertiary)
            }
        }
    }
}

struct VertaxMark: View {
    var body: some View {
        ZStack {
            Circle().fill(VxColor.cardElevated)
            Circle().strokeBorder(VxColor.hairline, lineWidth: 1)
            Circle().fill(VxColor.lime).frame(width: 12, height: 12)
            Circle().fill(VxColor.bg).frame(width: 4, height: 4)
        }
        .frame(width: 26, height: 26)
    }
}

struct HeroRecord: View {
    @EnvironmentObject var theme: VertaxTheme
    var body: some View {
        ZStack {
            Circle()
                .fill(Color(rgb: 0x0C0F0E))
                .overlay(Circle().strokeBorder(VxColor.hairline, lineWidth: 1))
                .shadow(color: .black.opacity(0.35), radius: 24, y: 18)
            Circle()
                .strokeBorder(VxColor.hairline, lineWidth: 1)
                .frame(width: 132, height: 132)
            Circle()
                .fill(theme.accent)
                .frame(width: 72, height: 72)
            Circle()
                .fill(VxColor.bg)
                .frame(width: 8, height: 8)
        }
        .frame(width: 188, height: 188)
    }
}

struct VxSearchField: View {
    @Binding var text: String
    var placeholder: String
    var onSubmit: (() -> Void)? = nil
    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass").foregroundStyle(VxColor.textTertiary)
            TextField(placeholder, text: $text).font(.system(size: 16)).onSubmit { onSubmit?() }
            if !text.isEmpty { Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(VxColor.textTertiary) }.buttonStyle(.plain) }
        }
        .padding(.horizontal, 12).frame(height: 40)
        .background(VxColor.card)
        .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
    }
}

struct VxEmptyState: View {
    @EnvironmentObject var theme: VertaxTheme
    let system: String; let title: String; let message: String
    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: system).font(.system(size: 24)).foregroundStyle(theme.accent)
                .frame(width: 60, height: 60).background(VxColor.card)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
                .padding(.bottom, 16)
            Text(title).font(VxFont.title).foregroundStyle(VxColor.text)
            Text(message).font(VxFont.subhead).foregroundStyle(VxColor.textSecondary).multilineTextAlignment(.center).padding(.top, 7)
        }.padding(26).frame(maxWidth: .infinity).padding(.top, 24)
    }
}

// — Find sub-bodies —
struct FindIdle: View {
    @EnvironmentObject var router: AppRouter
    var onPick: (String) -> Void
    // RECENT lookups + an "Import from Discogs" card (router.sheet = .discogsImport).
    // No label-scan entry — that feature does not exist in Vertax.
    private let recent = ["Komatic Northwall", "Dovetail Undertow", "Senan Driftwood Dub"]
    var body: some View {
        VStack(alignment: .leading, spacing: VxSpace.m) {
            SectionHead(title: "Recent")
            VxCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(recent, id: \.self) { item in
                        Button { onPick(item) } label: {
                            HStack(spacing: VxSpace.m) {
                                Image(systemName: "clock")
                                    .foregroundStyle(VxColor.textTertiary)
                                    .frame(width: 38, height: 38)
                                    .background(VxColor.cardElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
                                VStack(alignment: .leading, spacing: VxSpace.xs) {
                                    Text(item.replacingOccurrences(of: " ", with: " — ", options: [], range: item.range(of: " ")))
                                        .font(VxFont.body)
                                        .foregroundStyle(VxColor.text)
                                        .lineLimit(1)
                                    Text("Tap to look up again")
                                        .font(VxFont.caption)
                                        .foregroundStyle(VxColor.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.up.forward")
                                    .foregroundStyle(VxColor.textTertiary)
                            }
                            .padding(VxSpace.m)
                        }
                        .buttonStyle(.plain)
                        if item != recent.last { Divider().overlay(VxColor.hairline) }
                    }
                }
            }
            Button { router.sheet = .discogsImport } label: {
                VxCard {
                    HStack(spacing: VxSpace.m) {
                        Image(systemName: "square.and.arrow.down")
                            .foregroundStyle(VxColor.lime)
                            .frame(width: 40, height: 40)
                            .background(VxColor.lime.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
                        VStack(alignment: .leading, spacing: VxSpace.xs) {
                            Text("Import from Discogs")
                                .font(VxFont.bodyStrong)
                                .foregroundStyle(VxColor.text)
                            Text("Pull a whole collection by profile link")
                                .font(VxFont.caption)
                                .foregroundStyle(VxColor.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(VxColor.textTertiary)
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, VxSpace.xl)
    }
}
struct FindLoading: View {
    var body: some View { VxCard { HStack(spacing: 10) { ProgressView(); Text("Checking Beatport, GetSongBPM…").font(VxFont.subhead).foregroundStyle(VxColor.textSecondary) } }.padding(.horizontal, VxSpace.xl) } }
struct FindResult: View { let lookup: BpmKeyLookup; var onReset: () -> Void
    @EnvironmentObject var theme: VertaxTheme
    var body: some View {
        VStack(spacing: 12) {
            VxCard {
                VStack(alignment: .leading, spacing: VxSpace.l) {
                    HStack {
                        VStack(alignment: .leading, spacing: VxSpace.xs) {
                            Text(lookup.artist)
                                .font(VxFont.caption)
                                .foregroundStyle(VxColor.textSecondary)
                            Text(lookup.title)
                                .font(VxFont.title)
                                .foregroundStyle(VxColor.text)
                        }
                        Spacer()
                        VxChip(lookup.genre, mono: true)
                    }
                    HStack {
                        techStat(VxBpmText(lookup.bpm, size: 26), "Tempo")
                        techStat(Text(lookup.key).font(VxFont.bpm(26)), "Camelot")
                        techStat(Text(lookup.musicalKey.components(separatedBy: " ").first ?? "").font(VxFont.bpm(26)), "Key")
                    }
                }
            }
            VxCard {
                VStack(alignment: .leading, spacing: VxSpace.m) {
                    HStack {
                        Text("Confidence")
                            .font(VxFont.bodyStrong)
                            .foregroundStyle(VxColor.text)
                        Spacer()
                        Text("\(lookup.confidence)%")
                            .font(VxFont.bpm(13))
                            .foregroundStyle(lookup.confidence >= 90 ? theme.accent : VxColor.amber)
                    }
                    VxBar(value: lookup.confidence, accent: lookup.confidence >= 90 ? .lime : .amber)
                    HStack {
                        Text("Source")
                            .font(VxFont.caption)
                            .foregroundStyle(VxColor.textTertiary)
                        Spacer()
                        VxChip(lookup.source, mono: true)
                    }
                    HStack {
                        Text("Label · Cat")
                            .font(VxFont.caption)
                            .foregroundStyle(VxColor.textTertiary)
                        Spacer()
                        Text("\(lookup.label) · \(lookup.catalog)")
                            .font(VxFont.mono(12))
                            .foregroundStyle(VxColor.textSecondary)
                    }
                }
            }
            HStack(spacing: VxSpace.m) {
                VxButton("Save to crate", icon: "plus", style: .dark) {}
                VxButton("Use in set", icon: "slider.horizontal.3") {}
            }
            Button("New search", action: onReset)
                .font(VxFont.caption)
                .foregroundStyle(VxColor.textTertiary)
                .buttonStyle(.plain)
        }.padding(.horizontal, VxSpace.xl)
    }
    @ViewBuilder private func techStat<C: View>(_ c: C, _ l: String) -> some View {
        VStack(spacing: 5) { c.foregroundStyle(VxColor.text); Text(l).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary) }.frame(maxWidth: .infinity)
    }
}

// — Build row —
struct BuildRow: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    let index: Int; let record: Record; let transition: SetTransition?
    var body: some View {
        VxCard(padding: 9) {
            HStack(spacing: 11) {
                Text("\(index+1)").font(VxFont.bpm(13)).foregroundStyle(VxColor.textTertiary).frame(width: 15)
                VxCover(seed: record.coverSeed, catalog: record.catalog, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(record.artist) — \(record.title)").font(VxFont.body).foregroundStyle(VxColor.text).lineLimit(1)
                    Text(transition?.text ?? "Opener · first record")
                        .font(VxFont.caption)
                        .foregroundStyle(transition.map { $0.tone == .warn ? VxColor.amber : theme.accentText(scheme) } ?? VxColor.textSecondary)
                }
                Spacer(minLength: 6)
                Text("\(record.bpm)").font(VxFont.bpm(14)).foregroundStyle(VxColor.text)
                VxKeyBadge(record.keyCode, highlighted: record.keyCode == "8A")
            }
        }
    }
}

// — Analyze sub-body —
struct AnalyzeBody: View {
    @EnvironmentObject var theme: VertaxTheme
    @Binding var state: AnalyzeState
    var run: (Record) -> Void
    let targets = Record.sample.prefix(2)
    var body: some View {
        VStack(spacing: 12) {
            switch state {
            case .idle:
                ForEach(Array(targets)) { t in
                    Button { run(t) } label: { VxRecordRow(t) }.buttonStyle(.plain)
                }
            case .loading(let step):
                VxCard { VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(DigView.steps.enumerated()), id: \.offset) { i, s in
                        HStack(spacing: 11) {
                            ZStack {
                                Circle().strokeBorder(i < step ? .clear : VxColor.hairlineStrong, lineWidth: 1.5)
                                    .background(Circle().fill(i < step ? theme.accent : .clear)).frame(width: 22, height: 22)
                                if i < step { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(VxColor.limeInk) }
                                else if i == step { ProgressView().scaleEffect(0.6) }
                            }.frame(width: 22, height: 22)
                            Text(s).font(VxFont.subhead).foregroundStyle(i <= step ? VxColor.text : VxColor.textTertiary)
                        }
                    }
                } }
            case .result(let res):
                VxCard { HStack(spacing: 16) {
                    VxScoreRing(value: res.score, color: res.verdict == .strong ? theme.accent : res.verdict == .partial ? VxColor.amber : VxColor.textTertiary)
                    VStack(alignment: .leading, spacing: 10) {
                        VxVerdictPill(res.verdict)
                        Text(res.verdictText).font(VxFont.bodyStrong).foregroundStyle(VxColor.text)
                    }
                } }
                VxCard { VStack(spacing: 16) {
                    ForEach(res.bars) { f in
                        VStack(spacing: 7) {
                            HStack { Text(f.title).font(VxFont.subhead).foregroundStyle(VxColor.text); Text(f.subtitle).font(VxFont.caption).foregroundStyle(VxColor.textSecondary); Spacer(); Text("\(f.value)").font(VxFont.bpm(12.5)).foregroundStyle(VxColor.textSecondary) }
                            VxBar(value: f.value, accent: f.accent)
                        }
                    }
                } }
            }
        }.padding(.horizontal, VxSpace.xl)
    }
}

struct GapsBody: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    private let buckets: [(String, ClosedRange<Int>)] = [
        ("84–90", 84...90), ("160–166", 160...166), ("166–170", 166...170),
        ("170–174", 170...174), ("174–178", 174...178), ("178+", 178...220),
    ]
    var body: some View {
        VStack(alignment: .leading, spacing: VxSpace.m) {
            VxCard {
                VStack(alignment: .leading, spacing: VxSpace.l) {
                    HStack {
                        Text("Tempo coverage")
                            .font(VxFont.bodyStrong)
                            .foregroundStyle(VxColor.text)
                        Spacer()
                        Text("RECORDS / BPM")
                            .font(VxFont.labelMono)
                            .tracking(VxTracking.labelMono)
                            .foregroundStyle(VxColor.textTertiary)
                    }
                    HStack(alignment: .bottom, spacing: VxSpace.s) {
                        ForEach(bucketData(), id: \.label) { item in
                            VStack(spacing: VxSpace.s) {
                                GeometryReader { proxy in
                                    VStack {
                                        Spacer()
                                        RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous)
                                            .fill(item.isCore ? theme.accent : VxColor.cardElevated)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous)
                                                    .strokeBorder(item.isGap ? theme.accentLine : VxColor.hairline, style: StrokeStyle(lineWidth: item.isGap ? 1.5 : 1, dash: item.isGap ? [4, 4] : []))
                                            )
                                            .frame(height: max(8, proxy.size.height * CGFloat(item.height) / 100))
                                    }
                                }
                                .frame(height: 92)
                                Text(item.label)
                                    .font(VxFont.mono(8.5))
                                    .foregroundStyle(item.isGap ? theme.accent : VxColor.textTertiary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            }
            VxCard {
                VStack(alignment: .leading, spacing: VxSpace.m) {
                    HStack {
                        Text("Camelot map")
                            .font(VxFont.bodyStrong)
                            .foregroundStyle(VxColor.text)
                        Spacer()
                        Text("A · MINOR ROW")
                            .font(VxFont.labelMono)
                            .tracking(VxTracking.labelMono)
                            .foregroundStyle(VxColor.textTertiary)
                    }
                    HStack(spacing: VxSpace.xs) {
                        ForEach(1...12, id: \.self) { n in
                            let key = "\(n)A"
                            let count = crate.records.filter { $0.keyCode == key }.count
                            VStack(spacing: VxSpace.xs) {
                                RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous)
                                    .fill(count == 0 ? .clear : theme.accent.opacity(min(0.9, 0.18 + Double(count) * 0.18)))
                                    .overlay(RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous).strokeBorder(count == 0 ? theme.accentLine : VxColor.hairline, style: StrokeStyle(lineWidth: count == 0 ? 1.5 : 1, dash: count == 0 ? [4, 4] : [])))
                                    .frame(height: 30)
                                Text(key)
                                    .font(VxFont.mono(8))
                                    .foregroundStyle(VxColor.textTertiary)
                            }
                        }
                    }
                }
            }
            SectionHead(title: "Dig here next")
            VStack(spacing: VxSpace.s) {
                DigSuggestion(title: "174–178 · 9A", subtitle: "Thin bridge after your 170–174 core")
                DigSuggestion(title: "11A · cold keys", subtitle: "Useful harmonic exit from 12A and 10A")
                DigSuggestion(title: "Halftime · 84–90", subtitle: "Strong opener pool, still easy to expand")
            }
        }
        .padding(.horizontal, VxSpace.xl)
    }
    private func bucketData() -> [(label: String, height: Int, isCore: Bool, isGap: Bool)] {
        let counts = buckets.map { label, range in (label, crate.records.filter { range.contains($0.bpm) }.count) }
        let maxCount = max(1, counts.map(\.1).max() ?? 1)
        return counts.map { label, count in
            let height = count == 0 ? 8 : max(18, Int(Double(count) / Double(maxCount) * 100))
            return (label, height, label == "170–174", count == 0)
        }
    }
}

// — Sheets & onboarding (skeletons) —
struct RecordActionsSheet: View {
    @EnvironmentObject var set: SetStore
    @Environment(\.dismiss) var dismiss
    let record: Record
    var body: some View {
        VStack(alignment: .leading, spacing: VxSpace.l) {
            HStack(spacing: VxSpace.m) {
                VxCover(seed: record.coverSeed, catalog: record.catalog, size: 42)
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text("\(record.artist) — \(record.title)")
                        .font(VxFont.bodyStrong)
                        .foregroundStyle(VxColor.text)
                    Text("\(record.label) · \(record.catalog)")
                        .font(VxFont.caption)
                        .foregroundStyle(VxColor.textSecondary)
                }
            }
            VxButton(set.orderedIDs.contains(record.id) ? "Already in set" : "Add to set", icon: "slider.horizontal.3", style: .dark) {
                set.add(record.id)
                dismiss()
            }
            VxButton("Find similar to dig", icon: "flame", style: .dark) { dismiss() }
            VxButton("Edit notes & tags", icon: "tag", style: .dark) { dismiss() }
            VxButton("Save to wishlist", icon: "heart", style: .dark) { dismiss() }
            VxButton("Cancel", style: .ghost) { dismiss() }
        }
        .padding(VxSpace.l)
    }
}
// SettingsSheet lives in Screens/SettingsView.swift

struct OnboardingView: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var router: AppRouter
    @State private var step = 0
    var body: some View {
        ZStack {
            VxColor.bg.ignoresSafeArea()
            VStack(spacing: VxSpace.xl) {
                HStack {
                    VertaxMark()
                    Text("VERTAX")
                        .font(VxFont.mono(15))
                        .tracking(1)
                        .foregroundStyle(VxColor.text)
                    Spacer()
                    Text("DIG·PLAY·SHARE")
                        .font(VxFont.labelMono)
                        .tracking(VxTracking.labelMono)
                        .foregroundStyle(VxColor.textTertiary)
                }
                Spacer()
                onboardingContent
                Spacer()
                HStack(spacing: VxSpace.s) {
                    ForEach(0..<3, id: \.self) { i in
                        Capsule()
                            .fill(i == step ? theme.accent : VxColor.hairlineStrong)
                            .frame(width: i == step ? 18 : 6, height: 6)
                    }
                }
                if step < 2 {
                    VxButton("Continue") { step += 1 }
                } else {
                    VStack(spacing: VxSpace.m) {
                        VxButton("Import from Discogs", icon: "square.and.arrow.down") { router.sheet = .discogsImport }
                        VxButton("Add a record manually", icon: "plus", style: .dark) { router.showOnboarding = false }
                    }
                }
                VxButton("Skip — just look around", style: .ghost) { router.showOnboarding = false }
            }.padding(.horizontal, VxSpace.xxl).padding(.bottom, VxSpace.xxl).padding(.top, VxSpace.m)
        }
    }
    @ViewBuilder private var onboardingContent: some View {
        if step == 0 {
            VStack(spacing: VxSpace.l) {
                HeroRecord()
                Text("A smart crate for\nvinyl DJs.")
                    .font(VxFont.largeTitle)
                    .tracking(VxTracking.largeTitle)
                    .foregroundStyle(VxColor.text)
                    .multilineTextAlignment(.center)
                Text("Vertax knows your collection — what you own, what fits the record in your hand, and what to dig next.")
                    .font(VxFont.subhead)
                    .foregroundStyle(VxColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
            }
        } else if step == 1 {
            VStack(spacing: VxSpace.l) {
                Text("THE SMART PART")
                    .font(VxFont.labelMono)
                    .tracking(VxTracking.labelMono)
                    .foregroundStyle(theme.accent)
                Text("Math decides the fit.\nVertax explains it.")
                    .font(VxFont.title)
                    .foregroundStyle(VxColor.text)
                    .multilineTextAlignment(.center)
                VxCard {
                    HStack(spacing: VxSpace.l) {
                        VxScoreRing(value: 86, color: theme.accent)
                        VStack(alignment: .leading, spacing: VxSpace.s) {
                            VxVerdictPill(.strong)
                            Text("Fills your 170–174 / 8A bridge.")
                                .font(VxFont.bodyStrong)
                                .foregroundStyle(VxColor.text)
                        }
                    }
                }
            }
        } else {
            VStack(spacing: VxSpace.l) {
                Text("Start your crate")
                    .font(VxFont.largeTitle)
                    .tracking(VxTracking.largeTitle)
                    .foregroundStyle(VxColor.text)
                Text("Bring your records in — or look around first with a demo.")
                    .font(VxFont.subhead)
                    .foregroundStyle(VxColor.textSecondary)
                    .multilineTextAlignment(.center)
                VxCard {
                    Text("Import from Discogs, add manually, or continue with the sample crate.")
                        .font(VxFont.subhead)
                        .foregroundStyle(VxColor.textSecondary)
                }
            }
        }
    }
}
