import SwiftUI
import UniformTypeIdentifiers

// MARK: - Screen skeletons
// These are STRUCTURAL ports of the prototype: correct state machines, data
// wiring, navigation and component usage. Visual polish (exact paddings, hero
// blocks, sticky bars) follows the prototype 1:1 — fill in against the tokens.
// Screens run with local storage first; demo data is an explicit user action.

// =====================================================================
// CRATE
// =====================================================================
public struct CrateView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject private var set: SetStore
    @EnvironmentObject private var live: LiveSession
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    @State private var query = ""
    @State private var chips: Set<CrateFilter> = []

    public init() {}
    public var body: some View {
        let records = crate.filtered(query: query, chips: chips)
        let labelCount = Set(crate.records.map { $0.label }.filter { !$0.isEmpty }).count
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: VxSpace.m) {
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text("\(crate.records.count) \(L.t("common.records", lang)) · \(labelCount) \(L.t("common.labels", lang))")
                        .font(VxFont.labelMono)
                        .tracking(VxTracking.labelMono)
                        .foregroundStyle(VxColor.textTertiary)
                    Text(L.t("crate.title", lang))
                        .font(VxFont.largeTitle)
                        .tracking(VxTracking.largeTitle)
                        .foregroundStyle(VxColor.text)
                }
                Spacer()
                HStack(spacing: VxSpace.s) {
                    MiniIconButton(system: "play.fill", highlighted: true) {
                        router.showLiveSet = live.open(set: set, crate: crate)
                    }
                    .disabled(live.progress == nil && !crate.records.contains(where: \.canBuildSet))
                    .accessibilityLabel(L.t(live.progress == nil ? "build.start_live" : "live.resume", lang))
                    .accessibilityIdentifier("crate.live")
                    MiniIconButton(system: "gearshape") { router.sheet = .settings }
                    MiniIconButton(system: "plus") { router.sheet = .addRecord }
                        .accessibilityLabel(L.t("record.add_manual", lang))
                }
            }
            .padding(.horizontal, VxSpace.xl)
            .padding(.top, VxSpace.xs)
            .padding(.bottom, VxSpace.m)

            VStack(spacing: 11) {
                VxSearchField(text: $query, placeholder: L.t("search.crate", lang))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        Button { chips.removeAll() } label: { VxChip(L.t("filter.all", lang), active: chips.isEmpty) }.buttonStyle(.plain)
                        ForEach(CrateFilter.all) { f in
                            Button { toggle(f) } label: {
                                VxChip(f.id == "unpl" ? L.t("crate.unplayed", lang) : f.label, active: chips.contains(f), mono: true)
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }.padding(.horizontal, VxSpace.xl)

            if !crate.records.isEmpty && records.isEmpty {
                VxEmptyState(system: "magnifyingglass", title: L.t("crate.empty_title", lang),
                             message: L.t("crate.no_matches", lang))
            } else if records.isEmpty {
                VStack(spacing: VxSpace.m) {
                    VxEmptyState(system: "square.stack.3d.down.right", title: L.t("crate.empty_title", lang),
                                 message: L.t("crate.empty_body", lang))
                        .frame(maxHeight: 330)
                    VStack(spacing: VxSpace.s) {
                        VxButton(L.t("action.import_discogs", lang), icon: "square.and.arrow.down") {
                            router.sheet = .discogsImport
                        }
                        VxButton(L.t("common.demo", lang), icon: "opticaldisc", style: .dark) {
                            crate.loadDemo()
                        }
                    }
                    .padding(.horizontal, VxSpace.xl)
                }
            } else {
                ScrollView {
                    SectionHead(title: L.t("crate.sorted", lang), count: "\(records.count) \(L.t("common.shown", lang))")
                        .padding(.horizontal, VxSpace.xl)
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
    case notFound, failed
}
public struct FindView: View {
    @State private var query = ""
    @State private var state: FindState = .idle
    @State private var request: Task<Void, Never>?
    @AppStorage("vx_find_recent") private var recent = ""
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    private let api = VertaxAPI()
    public init() {}
    public var body: some View {
        VStack(spacing: 0) {
            VxScreenHeader(kicker: L.t("find.kicker", lang), title: L.t("find.title", lang))
            VxSearchField(text: $query, placeholder: L.t("search.find", lang), onSubmit: run)
                .padding(.horizontal, VxSpace.xl)
            NavigationLink(value: FindRoute.editions) {
                Label(L.t("find.discogs_editions", lang), systemImage: "opticaldisc")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .padding(.horizontal, VxSpace.xl)
            .accessibilityIdentifier("discogs.editions")
            ScrollView {
                switch state {
                case .idle:
                    FindIdle(onPick: { query = $0; run() }, recent: recent.components(separatedBy: "\n").filter { !$0.isEmpty })
                case .loading:     FindLoading()
                case .notFound:
                    VxEmptyState(system: "magnifyingglass", title: L.t("find.not_found", lang),
                                 message: L.t("find.not_found_body", lang))
                    VxButton(L.t("record.add_manual", lang), icon: "plus") { router.sheet = .addRecord }
                        .padding(.horizontal, VxSpace.xl)
                case .failed:
                    VxEmptyState(system: "wifi.slash", title: L.t("network.title", lang),
                                 message: L.t("network.retry", lang))
                    VxButton(L.t("import.retry", lang), icon: "arrow.clockwise", action: run)
                        .padding(.horizontal, VxSpace.xl)
                case .result(let r): FindResult(lookup: r) { state = .idle; query = "" }
                }
            }.padding(.top, VxSpace.l)
        }
        .onDisappear {
            request?.cancel()
            request = nil
            if state == .loading { state = .idle }
        }
    }
    private func run() {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        let parsed = Self.parseLookup(value)
        request?.cancel()
        state = .loading
        request = Task {
            do {
                let hit = try await api.lookupBeatport(artist: parsed.artist, title: parsed.title)
                try Task.checkCancellation()
                state = .result(hit)
                let entry = "\(hit.artist) — \(hit.title)".replacingOccurrences(of: "\n", with: " ")
                let previous = recent.components(separatedBy: "\n").filter { !$0.isEmpty && $0 != entry }
                recent = ([entry] + previous).prefix(5).joined(separator: "\n")
            } catch {
                guard !Task.isCancelled else { return }
                if case VertaxAPIError.notFound = error { state = .notFound }
                else { state = .failed }
            }
        }
    }

    static func parseLookup(_ q: String) -> (artist: String, title: String) {
        let trimmed = q.trimmingCharacters(in: .whitespacesAndNewlines)
        let separators = [" — ", " - ", " – ", " / "]
        for separator in separators {
            if let range = trimmed.range(of: separator) {
                let artist = String(trimmed[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                let title = String(trimmed[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !artist.isEmpty && !title.isEmpty { return (artist, title) }
            }
        }
        let parts = trimmed.split(separator: " ", maxSplits: 1).map(String.init)
        if parts.count == 2 { return (parts[0], parts[1]) }
        return (trimmed, trimmed)
    }
}

// =====================================================================
// BUILD — reorderable set
// =====================================================================
public struct BuildView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject private var live: LiveSession
    @AppStorage("vx_lang") private var lang = "en"
    @State private var showTrackPicker = false
    @State private var showSavedSets = false
    @State private var showSetName = false
    @State private var showTarget = false
    @State private var showSetExport = false
    @State private var confirmQuickBuild = false
    @State private var confirmClearDraft = false
    @State private var exportFailed = false
    @State private var setName = ""
    public init() {}
    public var body: some View {
        let records = set.records(in: crate)
        let canPlay = live.progress != nil || !records.isEmpty
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: VxSpace.m) {
                HStack {
                    VxScreenHeader(kicker: "\(L.t("build.entries", lang)) \(records.count)", title: L.t("build.title", lang))
                    Spacer()
                    VxButton(L.t(live.progress == nil ? "build.start_live" : "live.resume", lang),
                             icon: "play.fill", style: canPlay ? .primary : .dark) {
                        router.showLiveSet = live.open(set: set, crate: crate)
                    }
                    .disabled(!canPlay)
                    .opacity(canPlay ? 1 : 0.45)
                    .accessibilityIdentifier("build.live")
                }
                HStack(spacing: VxSpace.m) {
                    Button {
                        showSavedSets = true
                    } label: {
                        Label(L.t("build.saved", lang), systemImage: "list.bullet.rectangle")
                            .frame(minHeight: 44)
                    }
                    Spacer()
                    Menu {
                        Button { showTarget = true } label: { Label(L.t("plan.title", lang), systemImage: "timer") }
                            .disabled(!crate.records.contains { !$0.isRelease && $0.canBuildSet })
                        if !records.isEmpty {
                            Button { showSetExport = true } label: { Label(L.t("plan.export", lang), systemImage: "doc.text") }
                            ShareLink(item: setText(records)) {
                                Label(L.t("plan.share", lang), systemImage: "square.and.arrow.up")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.title3)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .accessibilityLabel(L.t("plan.actions", lang))
                    .accessibilityIdentifier("set.actions")
                    if !records.isEmpty {
                        Button {
                            setName = ""
                            showSetName = true
                        } label: {
                            Label(L.t("build.save_named", lang), systemImage: "square.and.arrow.down")
                                .frame(minHeight: 44)
                        }
                    }
                }
                if !records.isEmpty {
                    HStack(spacing: VxSpace.s) {
                        VxButton(L.t("build.from_crate", lang), icon: "sparkles") {
                            confirmQuickBuild = true
                        }
                        VxButton(L.t("build.clear", lang), icon: "trash", style: .dark) { confirmClearDraft = true }
                            .accessibilityIdentifier("set.clear")
                    }
                    HStack(spacing: VxSpace.s) {
                        VxButton(L.t("build.source", lang), icon: "music.note.list", style: .dark) { showTrackPicker = true }
                            .accessibilityIdentifier("set.source")
                        Menu {
                            Button("BPM") { set.sort(in: crate, byCamelot: false) }
                            Button("Camelot") { set.sort(in: crate, byCamelot: true) }
                        } label: {
                            Image(systemName: "arrow.up.arrow.down")
                                .frame(width: VxSize.iconButton, height: VxSize.iconButton)
                        }
                        .accessibilityLabel(L.t("build.sort", lang))
                    }
                }
            }
            .padding(.horizontal, VxSpace.xl)
            .padding(.bottom, VxSpace.m)
            if records.isEmpty {
                VStack(spacing: VxSpace.m) {
                    VxEmptyState(
                        system: crate.records.isEmpty ? "square.stack.3d.down.right" : "slider.horizontal.3",
                        title: crate.records.isEmpty ? L.t("build.no_crate_title", lang) : L.t("build.empty_title", lang),
                        message: crate.records.isEmpty ? L.t("build.no_crate_body", lang) : L.t("build.empty_body", lang)
                    )
                    .frame(maxHeight: 330)
                    VStack(spacing: VxSpace.s) {
                        if crate.records.isEmpty {
                            VxButton(L.t("action.import_discogs", lang), icon: "square.and.arrow.down") {
                                router.sheet = .discogsImport
                            }
                            VxButton(L.t("common.demo", lang), icon: "opticaldisc", style: .dark) {
                                crate.loadDemo()
                            }
                        } else {
                            VxButton(L.t("build.from_crate", lang), icon: "sparkles") {
                                set.autoBuild(from: crate.records)
                            }
                            VxButton(L.t("build.source", lang), icon: "music.note.list", style: .dark) {
                                showTrackPicker = true
                            }
                            .accessibilityIdentifier("set.source")
                        }
                    }
                    .padding(.horizontal, VxSpace.xl)
                }
            } else {
                List {
                    ForEach(Array(records.enumerated()), id: \.element.id) { i, r in
                        BuildRow(index: i, record: r, transition: i > 0 ? SetTransition(from: records[i-1], to: r, lang: lang) : nil)
                            .listRowInsets(EdgeInsets(top: 5, leading: VxSpace.xl, bottom: 5, trailing: VxSpace.xl))
                            .listRowBackground(Color.clear).listRowSeparator(.hidden)
                            .onTapGesture { router.openRelease(r) }
                    }
                    .onMove { set.move(from: $0, to: $1, in: crate) }
                    .onDelete { offsets in
                        for offset in offsets {
                            guard records.indices.contains(offset) else { continue }
                            set.remove(records[offset].id)
                        }
                    }
                }
                .listStyle(.plain).environment(\.editMode, .constant(.active))
                .scrollContentBackground(.hidden)
            }
        }
        .sheet(isPresented: $showTrackPicker) { SetTrackPicker() }
        .sheet(isPresented: $showSavedSets) { SavedSetsView() }
        .sheet(isPresented: $showTarget) { TargetSetView() }
        .fileExporter(isPresented: $showSetExport, document: SetTextDocument(text: setText(records)),
                      contentType: .plainText, defaultFilename: setExportName) {
            if case .failure = $0 { exportFailed = true }
        }
        .alert(L.t("plan.export_failed", lang), isPresented: $exportFailed) {
            Button("OK", role: .cancel) {}
        }
        .confirmationDialog(L.t("plan.replace", lang), isPresented: $confirmQuickBuild, titleVisibility: .visible) {
            Button(L.t("plan.replace", lang)) { set.autoBuild(from: crate.records) }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
        .alert(L.t("build.clear_title", lang), isPresented: $confirmClearDraft) {
            Button(L.t("build.clear", lang), role: .destructive) { set.clear() }
                .accessibilityIdentifier("set.clear.confirm")
            Button(L.t("action.cancel", lang), role: .cancel) {}
        } message: {
            Text(L.t("build.clear_body", lang))
        }
        .alert(L.t("build.save_named", lang), isPresented: $showSetName) {
            TextField(L.t("build.name", lang), text: $setName)
            Button(L.t("action.save", lang)) { set.saveNamed(setName, in: crate) }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
    }

    private func setText(_ records: [Record]) -> String {
        SetPlanner.export(records, heading: L.t("plan.export_title", lang), unknown: L.t("plan.unknown", lang))
    }

    private var setExportName: String {
        VertaxLocalStore.testNamespace.map { "vertax-qa-set-\($0.prefix(8))" } ?? "vertax-set"
    }
}

private struct SetTrackPicker: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("vx_lang") private var lang = "en"
    @State private var search = ""
    @State private var mode: Record.Kind = .track
    @State private var selected: [String] = []

    var body: some View {
        let releases = mode == .release
        let tracks = crate.filtered(query: search, chips: []).filter { $0.isRelease == releases && $0.canBuildSet }
        let current = Set(selected)
        let releaseMap = releases ? Record.releaseSelectionMap(in: crate.records) : [:]
        let visibleIDs = Set(tracks.flatMap { releases ? releaseMap[$0.id] ?? [] : [$0.id] })
        let hiddenCount = current.subtracting(visibleIDs).count
        NavigationStack {
          VStack(spacing: 0) {
            Picker(L.t("build.source", lang), selection: $mode) {
                Text(L.t("build.source_tracks", lang)).tag(Record.Kind.track)
                Text(L.t("build.source_releases", lang)).tag(Record.Kind.release)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, VxSpace.l)
            .padding(.bottom, VxSpace.s)
            VxSearchField(text: $search, placeholder: L.t(releases ? "search.crate" : "build.track_search", lang))
                .accessibilityIdentifier("set.track.search")
                .padding(.horizontal, VxSpace.l)
                .padding(.bottom, VxSpace.s)
            List {
                if tracks.isEmpty {
                    Text(L.t(search.isEmpty ? (releases ? "build.no_releases" : "build.no_tracks") : "crate.no_matches", lang))
                        .foregroundStyle(.secondary)
                }
                ForEach(tracks) { track in
                    let ids = releases ? releaseMap[track.id] ?? [] : [track.id]
                    let all = !ids.isEmpty && ids.allSatisfy(current.contains)
                    let partial = !all && ids.contains(where: current.contains)
                    HStack(spacing: VxSpace.s) {
                        Image(systemName: all ? "checkmark.circle.fill" : partial ? "minus.circle" : "circle")
                            .foregroundStyle(all || partial ? Color.accentColor : VxColor.textTertiary)
                            .accessibilityHidden(true)
                        VxRecordRow(track) {
                            selected = all ? selected.filter { !ids.contains($0) } : SetPlanner.selection(selected, adding: ids)
                        }
                        .accessibilityAddTraits(all ? .isSelected : [])
                        .accessibilityValue(partial ? L.t("plan.part_selected", lang) : "")
                        .accessibilityIdentifier("set.track.\(track.id)")
                    }
                    .listRowBackground(VxColor.card)
                }
            }
            .scrollDismissesKeyboard(.interactively)
          }
            .navigationTitle(L.t("build.source", lang))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L.t("action.cancel", lang)) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L.t("action.save", lang) + " (\(selected.count))") {
                        set.orderedIDs = selected
                        dismiss()
                    }
                    .disabled(selected.isEmpty)
                    .accessibilityIdentifier("set.track.save")
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(alignment: .leading, spacing: 0) {
                    if hiddenCount > 0 {
                        Text(String(format: L.t("plan.hidden_count", lang), hiddenCount))
                            .font(.footnote).foregroundStyle(.secondary)
                            .accessibilityIdentifier("set.selection.hidden")
                    }
                    ViewThatFits(in: .horizontal) {
                        HStack {
                            selectShown(tracks, releases: releases, map: releaseMap)
                            Spacer()
                            deselectAll
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            selectShown(tracks, releases: releases, map: releaseMap)
                            deselectAll
                        }
                    }
                }
                .padding(VxSpace.l)
                .background(.bar)
            }
        }
        .onAppear {
            selected = set.orderedIDs
            let current = set.records(in: crate)
            if !current.isEmpty, current.allSatisfy(\.isRelease) { mode = .release }
        }
    }

    private func selectShown(_ tracks: [Record], releases: Bool, map: [String: [String]]) -> some View {
        Button(L.t("build.select_all", lang)) {
            selected = SetPlanner.selection(selected, adding: tracks.flatMap { releases ? map[$0.id] ?? [] : [$0.id] })
        }.disabled(tracks.isEmpty).frame(minHeight: 44)
    }

    private var deselectAll: some View {
        Button(L.t("build.clear_selection", lang)) { selected = [] }
            .disabled(selected.isEmpty).frame(minHeight: 44)
    }
}

// =====================================================================
// DIG — Analyze (state machine) + Gaps
// =====================================================================
public enum DigMode: Hashable { case analyze, gaps }
public enum AnalyzeState: Equatable {
    case idle, loading, noMatch, missingMetadata, failed
    case result(AnalyzeResult)
    public static func == (l: AnalyzeState, r: AnalyzeState) -> Bool {
        switch (l, r) {
        case (.idle,.idle), (.loading,.loading), (.noMatch,.noMatch),
             (.missingMetadata,.missingMetadata), (.failed,.failed), (.result,.result): true
        default: false
        }
    }
}
public struct DigView: View {
    @EnvironmentObject var crate: CrateStore
    @AppStorage("vx_lang") private var lang = "en"
    @State private var mode: DigMode = .analyze
    @State private var state: AnalyzeState = .idle
    @State private var query = ""
    @State private var request: Task<Void, Never>?
    public init() {}
    public var body: some View {
        VStack(spacing: 0) {
            VxScreenHeader(kicker: "", title: L.t("dig.title", lang))
            VxSegmented(selection: $mode, options: [(.analyze,L.t("dig.analyze", lang)),(.gaps,L.t("dig.gaps", lang))]).padding(.horizontal, VxSpace.xl)
            ScrollView {
                if mode == .analyze {
                    VStack(spacing: VxSpace.l) {
                        NavigationLink { ReleaseFitSearch() } label: {
                            HStack {
                                Label(L.t("fit.title", lang), systemImage: "opticaldisc")
                                Spacer(minLength: VxSpace.s)
                                Image(systemName: "chevron.right").accessibilityHidden(true)
                            }
                            .font(.body.weight(.semibold))
                            .padding(VxSpace.m)
                            .frame(minHeight: 48)
                            .background(VxColor.card, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .accessibilityIdentifier("release-fit.open")
                        .padding(.horizontal, VxSpace.xl)
                        AnalyzeBody(query: $query, state: state, canAnalyze: CrateDig.tracks(crate.records).contains(where: \.hasMixMetadata), run: runAnalyze)
                    }
                } else { CrateGapsView() }
            }.padding(.top, VxSpace.l)
        }
        .onDisappear { cancelTrackLookup() }
        .onChange(of: mode) { _ in cancelTrackLookup() }
    }
    private func cancelTrackLookup() {
        request?.cancel()
        if state == .loading { state = .idle }
    }
    private func runAnalyze() {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        let parsed = FindView.parseLookup(value)
        request?.cancel()
        state = .loading
        request = Task {
            do {
                let hit = try await VertaxAPI().lookupBeatport(artist: parsed.artist, title: parsed.title)
                try Task.checkCancellation()
                state = AnalyzeEngine.analyze(target: hit.asRecord(), against: CrateDig.tracks(crate.records))
                    .map(AnalyzeState.result) ?? .missingMetadata
            } catch {
                guard !Task.isCancelled else { return }
                if case VertaxAPIError.notFound = error { state = .noMatch }
                else { state = .failed }
            }
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
    @AppStorage("vx_lang") private var lang = "en"
    @State private var tracklist: [DiscogsTrack] = []
    @State private var tracklistLoaded = false
    @State private var tracklistFailed = false
    @State private var tracklistAttempt = 0
    let record: Record
    public init(record: Record) { self.record = record }
    public var body: some View {
        let record = crate.records.first { $0.id == self.record.id } ?? self.record
        let neighbours = harmonicNeighbours(for: record, in: crate.records)
        let fitCount = neighbours.reduce(0) { $0 + $1.count }
        let discogsID = record.discogsID
        let savedIDs = Set(crate.records.map(\.id))
        let savedTracks = record.isRelease ? crate.records.filter { $0.containingReleaseID == record.id } : []
        let savedPositions = Set(savedTracks.filter { !$0.side.isEmpty }.map { "\($0.side.uppercased())|\($0.title.lowercased())" })
        let onlineTracks = tracklist.enumerated().filter { index, track in
            let position = track.position ?? ""
            return !savedIDs.contains(trackEntry(track, index: index, release: record).id)
                && (position.isEmpty || !savedPositions.contains("\(position.uppercased())|\(track.title.lowercased())"))
        }
        ScrollView {
            VStack(alignment: .leading, spacing: VxSpace.l) {
                // header
                HStack(spacing: 15) {
                    VxCover(seed: record.coverSeed, catalog: record.catalog, size: 92, radius: 14)
                    VStack(alignment: .leading, spacing: 4) {
                Text(record.artist).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
                        Text(record.title).font(VxFont.title).foregroundStyle(VxColor.text)
                        HStack(spacing: 6) {
                            if !record.genre.isEmpty { VxChip(record.genre, mono: true) }
                            if !record.year.isEmpty { VxChip(record.year, mono: true) }
                            if record.rating > 0 { VxChip("★ \(String(format: "%.1f", record.rating))", mono: true) }
                        }
                    }
                }
                if let url = record.discogsURL { DiscogsAttribution(url: url) }
                if let discogsID, let id = Int(discogsID), record.isRelease {
                    NavigationLink { ReleaseFitView(releaseID: id) } label: {
                        Label(L.t("fit.title", lang), systemImage: "opticaldisc")
                            .font(.subheadline.weight(.semibold)).frame(minHeight: 44)
                    }
                }
                // technical block
                VxCard {
                    HStack {
                        techCell(label: L.t("release.tempo", lang)) { VxBpmText(record.bpm, size: 30) }
                        Divider().frame(height: 40).overlay(VxColor.hairline)
                        techCell(label: "Camelot") { Text(record.validCamelot?.code ?? "–").font(VxFont.bpm(30)).foregroundStyle(VxColor.text) }
                        Divider().frame(height: 40).overlay(VxColor.hairline)
                        techCell(label: L.t("edit.side", lang)) { Text(record.side.isEmpty ? "–" : record.side).font(VxFont.bpm(26)).foregroundStyle(VxColor.text) }
                    }
                }
                .onTapGesture { router.sheet = .editRecord(record) }
                if !savedTracks.isEmpty {
                    SectionHead(title: L.t("release.saved_tracks", lang), count: String(savedTracks.count))
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(savedTracks) { track in
                            VxRecordRow(track) { router.openRelease(track) }
                            Divider()
                        }
                    }
                }
                if discogsID != nil {
                    SectionHead(title: L.t("release.tracklist", lang),
                                count: tracklistLoaded && !tracklist.isEmpty ? "\(tracklist.count)" : nil)
                    if tracklistFailed {
                        VxButton(L.t("import.retry", lang), icon: "arrow.clockwise", style: .dark) { tracklistAttempt += 1 }
                    } else if !tracklistLoaded {
                        ProgressView()
                    } else if tracklist.isEmpty {
                        Text(L.t("release.no_tracklist", lang)).foregroundStyle(VxColor.textSecondary)
                    } else if !onlineTracks.isEmpty {
                        VxCard(padding: 0) {
                            LazyVStack(spacing: 0) {
                                ForEach(onlineTracks, id: \.offset) { index, track in
                                    HStack(spacing: VxSpace.xs) {
                                        ReleaseTrackRow(track: track)
                                        let entry = trackEntry(track, index: index, release: record)
                                        let saved = savedIDs.contains(entry.id)
                                        Button {
                                            crate.add(entry)
                                        } label: {
                                            Image(systemName: saved ? "checkmark" : "plus.circle")
                                                .frame(width: VxSize.iconButton, height: VxSize.iconButton)
                                        }
                                        .accessibilityLabel(L.t(saved ? "find.saved_crate" : "find.save_crate", lang))
                                        .disabled(saved)
                                        .padding(.trailing, VxSpace.s)
                                    }
                                    if index != onlineTracks.last?.offset { Divider().overlay(VxColor.hairline) }
                                }
                            }
                        }
                    } else {
                        Text(L.t("release.all_tracks_saved", lang)).foregroundStyle(VxColor.textSecondary)
                    }
                    if let url = record.discogsURL { DiscogsAttribution(url: url) }
                }
                if !neighbours.isEmpty {
                    SectionHead(title: L.t("release.mixes_well", lang), count: "\(fitCount) \(L.t("release.in_crate", lang))")
                    HStack(spacing: VxSpace.s) {
                        ForEach(neighbours) { item in HarmonicNeighbourCell(item: item) }
                    }
                }
                if !record.notes.isEmpty {
                    SectionHead(title: L.t("release.notes", lang))
                    VxCard { Text(record.notes).font(VxFont.subhead).foregroundStyle(VxColor.textSecondary) }
                }
            }
            .padding(VxSpace.xl)
        }
        .background(VxColor.bg)
        .task(id: tracklistAttempt) {
            guard let discogsID else { return }
            tracklistFailed = false
            do {
                let tracks = try await VertaxAPI().discogsTracklist(releaseID: discogsID)
                try Task.checkCancellation()
                tracklist = tracks
                tracklistLoaded = true
            } catch {
                if !Task.isCancelled { tracklistFailed = true }
            }
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                VxButton(set.orderedIDs.contains(record.id) ? L.t("record.in_set", lang) : L.t("record.add_to_set", lang),
                         icon: set.orderedIDs.contains(record.id) ? "checkmark" : "plus",
                         style: set.orderedIDs.contains(record.id) ? .dark : .primary) { set.add(record.id) }
            }.padding(.horizontal, VxSpace.xl).padding(.vertical, 12).background(.ultraThinMaterial)
        }
        .navigationTitle("").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { router.sheet = .editRecord(record) } label: { Image(systemName: "slider.horizontal.3") }
                    .accessibilityLabel(L.t("record.edit_meta", lang))
                    .accessibilityIdentifier("record.edit-meta")
                Button { router.sheet = .recordActions(record) } label: { Image(systemName: "ellipsis") }
                    .accessibilityLabel(L.t("record.actions", lang))
            }
        }
    }
    @ViewBuilder private func techCell<C: View>(label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 6) { content(); Text(label).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary) }
            .frame(maxWidth: .infinity)
    }
    private func trackEntry(_ track: DiscogsTrack, index: Int, release: Record) -> Record {
        let artists = track.artists?.map(\.cleanName).filter { !$0.isEmpty } ?? []
        let position = track.position ?? ""
        let identity = position.isEmpty ? String(index) : position
        return Record(id: "\(release.id)-track-\(identity)-\(track.title)",
                      artist: artists.isEmpty ? release.artist : artists.joined(separator: ", "),
                      title: track.title, label: release.label, catalog: release.catalog, year: release.year,
                      bpm: 0, keyCode: "", side: position, genre: release.genre, rating: 0,
                      played: false, coverSeed: release.coverSeed, notes: "", parentDiscogsID: release.discogsID,
                      kind: .track, parentReleaseID: release.id, durationSeconds: Record.parseDuration(track.duration))
    }
    private func harmonicNeighbours(for record: Record, in crate: [Record]) -> [HarmonicNeighbour] {
        guard let camelot = record.validCamelot else { return [] }
        let keys: [(String, String)] = [
            (camelot.code, "="),
            (camelot.stepped(by: 1).code, "+1"),
            (camelot.stepped(by: -1).code, "−1"),
            (camelot.relative.code, "A/B"),
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
                if !kicker.isEmpty {
                    Text(kicker).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                }
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

struct ReleaseTrackRow: View {
    let track: DiscogsTrack
    var body: some View {
        HStack(spacing: VxSpace.m) {
            Text(track.position ?? "")
                .font(VxFont.labelMono)
                .tracking(VxTracking.labelMono)
                .foregroundStyle(VxColor.textTertiary)
                .frame(minWidth: 24, alignment: .leading)
            Text(track.title)
                .font(VxFont.subhead)
                .foregroundStyle(VxColor.text)
                .lineLimit(2)
            Spacer()
            if let duration = track.duration, !duration.isEmpty {
                Text(duration).font(VxFont.bpm(14)).foregroundStyle(VxColor.textSecondary)
            }
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
                    .foregroundStyle(item.relation == "=" ? VxColor.lime : VxColor.cyan)
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
    var dismissKeyboard = false
    @FocusState private var focused: Bool
    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass").foregroundStyle(VxColor.textTertiary)
            TextField(placeholder, text: $text)
                .font(.system(size: 16))
                .focused($focused)
                .autocorrectionDisabled()
                .submitLabel(onSubmit == nil ? .done : .search)
                .onSubmit { focused = false; onSubmit?() }
            if !text.isEmpty { Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(VxColor.textTertiary) }.buttonStyle(.plain) }
        }
        .padding(.horizontal, 12).frame(height: 40)
        .background(VxColor.card)
        .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
        .onChange(of: dismissKeyboard) { if $0 { focused = false } }
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
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.bottom, 40)
    }
}

// — Find sub-bodies —
struct FindIdle: View {
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    var onPick: (String) -> Void
    let recent: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: VxSpace.m) {
            if !recent.isEmpty {
            SectionHead(title: L.t("find.recent", lang))
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
                                    Text(item)
                                        .font(VxFont.body)
                                        .foregroundStyle(VxColor.text)
                                        .lineLimit(1)
                                    Text(L.t("find.recent_hint", lang))
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
                            Text(L.t("action.import_discogs", lang))
                                .font(VxFont.bodyStrong)
                                .foregroundStyle(VxColor.text)
                            Text(L.t("find.import_hint", lang))
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
    @AppStorage("vx_lang") private var lang = "en"
    var body: some View { VxCard { HStack(spacing: 10) { ProgressView(); Text(L.t("find.loading", lang)).font(VxFont.subhead).foregroundStyle(VxColor.textSecondary) } }.padding(.horizontal, VxSpace.xl) } }
struct FindResult: View { let lookup: BpmKeyLookup; var onReset: () -> Void
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    var body: some View {
        let record = lookup.asRecord()
        let isSaved = crate.records.contains { $0.id == record.id }
        let isInSet = set.orderedIDs.contains(record.id)
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
                        Text(L.t("find.confidence", lang))
                            .font(VxFont.bodyStrong)
                            .foregroundStyle(VxColor.text)
                        Spacer()
                        Text("\(lookup.confidence)%")
                            .font(VxFont.bpm(13))
                            .foregroundStyle(lookup.confidence >= 90 ? theme.accent : VxColor.amber)
                    }
                    VxBar(value: lookup.confidence, accent: lookup.confidence >= 90 ? .lime : .amber)
                    HStack {
                        Text(L.t("find.source", lang))
                            .font(VxFont.caption)
                            .foregroundStyle(VxColor.textTertiary)
                        Spacer()
                        if let url = lookup.sourceURL {
                            Link(destination: url) {
                                Label("Beatport", systemImage: "arrow.up.right")
                                    .font(.footnote)
                                    .frame(minHeight: 44)
                            }
                        } else {
                            VxChip(lookup.source, mono: true)
                        }
                    }
                    HStack {
                        Text(L.t("find.label_cat", lang))
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
                VxButton(isSaved ? L.t("find.saved_crate", lang) : L.t("find.save_crate", lang),
                         icon: isSaved ? "checkmark" : "plus",
                         style: .dark) {
                    crate.add(record)
                }
                VxButton(isInSet ? L.t("record.in_set", lang) : L.t("find.use_set", lang),
                         icon: isInSet ? "checkmark" : "slider.horizontal.3") {
                    crate.add(record)
                    set.add(record.id)
                    router.tab = .build
                }
            }
            Button(L.t("find.new_search", lang), action: onReset)
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
    @AppStorage("vx_lang") private var lang = "en"
    let index: Int; let record: Record; let transition: SetTransition?
    var body: some View {
        VxCard(padding: 9) {
            HStack(spacing: 11) {
                Text("\(index+1)").font(VxFont.bpm(13)).foregroundStyle(VxColor.textTertiary).frame(width: 15)
                VxCover(seed: record.coverSeed, catalog: record.catalog, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(record.artist) — \(record.title)").font(.body).foregroundStyle(VxColor.text)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(transition?.text ?? L.t("build.opener", lang))
                        .font(VxFont.caption)
                        .foregroundStyle(transition.map { $0.tone == .warn ? VxColor.amber : theme.accentText(scheme) } ?? VxColor.textSecondary)
                    Text(SetPlanner.length(record).map(SetPlanner.clock) ?? L.t("plan.unknown_duration", lang))
                        .font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
                }
                Spacer(minLength: 6)
                VxBpmText(record.bpm, size: 14, unit: false)
                VxKeyBadge(record.keyCode, highlighted: record.keyCode == "8A")
            }
        }
    }
}

// — Analyze sub-body —
struct AnalyzeBody: View {
    @EnvironmentObject var theme: VertaxTheme
    @AppStorage("vx_lang") private var lang = "en"
    @Binding var query: String
    let state: AnalyzeState
    let canAnalyze: Bool
    var run: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            if canAnalyze {
                VxSearchField(text: $query, placeholder: L.t("search.find", lang), onSubmit: run, dismissKeyboard: state == .loading)
                VxButton(L.t("dig.check_track", lang), icon: "magnifyingglass", action: run)
                    .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || state == .loading)
            }
            switch state {
            case .idle:
                if !canAnalyze {
                    VxEmptyState(system: "square.stack.3d.down.right", title: L.t("dig.empty_title", lang),
                                 message: L.t("dig.need_metadata", lang))
                }
            case .loading:
                ProgressView(L.t("find.loading", lang))
            case .noMatch:
                Text(L.t("find.not_found", lang)).foregroundStyle(VxColor.textSecondary)
            case .missingMetadata:
                Text(L.t("dig.need_metadata", lang)).foregroundStyle(VxColor.textSecondary)
            case .failed:
                Text(L.t("network.retry", lang)).foregroundStyle(VxColor.textSecondary)
            case .result(let res):
                VxCard { HStack(spacing: 16) {
                    VxScoreRing(value: res.score, color: res.verdict == .strong ? theme.accent : res.verdict == .partial ? VxColor.amber : VxColor.textTertiary)
                    VStack(alignment: .leading, spacing: 10) {
                        VxVerdictPill(res.verdict)
                        Text("\(res.target.artist) — \(res.target.title)").font(VxFont.bodyStrong).foregroundStyle(VxColor.text)
                        Text(L.t("dig.best_pair", lang)).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
                    }
                } }
                VxCard { VStack(spacing: 16) {
                    ForEach(res.bars) { f in
                        VStack(spacing: 7) {
                            HStack { Text(L.t(f.title, lang)).font(VxFont.subhead).foregroundStyle(VxColor.text); Spacer(); Text("\(f.value)%").font(VxFont.bpm(12.5)).foregroundStyle(VxColor.textSecondary) }
                            VxBar(value: f.value, accent: f.accent)
                        }
                    }
                } }
                if !res.matches.isEmpty {
                    SectionHead(title: L.t("release.mixes_well", lang))
                    ForEach(res.matches) { VxRecordRow($0) }
                }
            }
        }.padding(.horizontal, VxSpace.xl)
    }
}


// — Sheets & onboarding (skeletons) —
struct RecordActionsSheet: View {
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var wishlist: WishlistStore
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
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
            VxButton(set.orderedIDs.contains(record.id) ? L.t("record.in_set", lang) : L.t("record.add_to_set", lang), icon: "slider.horizontal.3", style: .dark) {
                set.add(record.id)
                dismiss()
            }
            VxButton(L.t("record.edit_meta", lang), icon: "slider.horizontal.3", style: .dark) {
                dismiss()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { router.sheet = .editRecord(record) }
            }
            VxButton(wishlist.contains(record.id) ? L.t("record.remove_wishlist", lang) : L.t("record.save_wishlist", lang), icon: "heart", style: .dark) {
                wishlist.toggle(record.id)
                dismiss()
            }
            VxButton(L.t("action.cancel", lang), style: .ghost) { dismiss() }
        }
        .padding(VxSpace.l)
    }
}

struct EditRecordSheet: View {
    @EnvironmentObject var crate: CrateStore
    @Environment(\.dismiss) var dismiss
    let record: Record?
    @State private var artist: String
    @State private var title: String
    @State private var bpm: String
    @State private var keyCode: String
    @State private var side: String
    @State private var kind: Record.Kind = .track
    @AppStorage("vx_lang") private var lang = "en"

    init(record: Record?) {
        self.record = record
        _artist = State(initialValue: record?.artist ?? "")
        _title = State(initialValue: record?.title ?? "")
        _bpm = State(initialValue: record.flatMap { $0.bpm > 0 ? String($0.bpm) : nil } ?? "")
        _keyCode = State(initialValue: record?.keyCode ?? "")
        _side = State(initialValue: record?.side ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(L.t("edit.section", lang)) {
                    if record == nil {
                        Picker(L.t("edit.kind", lang), selection: $kind) {
                            Text(L.t("build.source_tracks", lang)).tag(Record.Kind.track)
                            Text(L.t("build.source_releases", lang)).tag(Record.Kind.release)
                        }
                        TextField(L.t("edit.artist", lang), text: $artist)
                        TextField(L.t("edit.track_title", lang), text: $title)
                    }
                    TextField("BPM", text: $bpm)
                        .keyboardType(.numberPad)
                    TempoScaleControls(text: $bpm, lang: lang)
                    TextField("Camelot", text: $keyCode)
                        .textInputAutocapitalization(.characters)
                    TextField(L.t("edit.side", lang), text: $side)
                        .textInputAutocapitalization(.characters)
                    if let invalidKey {
                        Text(L.t(invalidKey, lang)).foregroundStyle(VxColor.amber)
                    }
                }
                Section {
                    Text(L.t("edit.note", lang))
                        .font(VxFont.footnote)
                        .foregroundStyle(VxColor.textSecondary)
                }
            }
            .navigationTitle(L.t(record == nil ? "record.add_manual" : "edit.title", lang))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L.t("action.cancel", lang)) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L.t("action.save", lang)) { save() }
                        .disabled(invalidKey != nil || (record == nil && (clean(artist).isEmpty || clean(title).isEmpty)))
                }
            }
        }
    }

    private func clean(_ value: String) -> String { value.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var invalidKey: String? {
        if !clean(bpm).isEmpty, Int(clean(bpm)).map(TempoValue.valid.contains) != true { return "edit.invalid_bpm" }
        if !clean(keyCode).isEmpty, Camelot(clean(keyCode)) == nil { return "edit.invalid_camelot" }
        return nil
    }

    private func save() {
        guard invalidKey == nil else { return }
        var next = record ?? Record(id: "manual-\(UUID().uuidString)", artist: clean(artist), title: clean(title),
                                    label: "", catalog: "", year: "", bpm: 0, keyCode: "", side: "", genre: "",
                                    rating: 0, played: false, coverSeed: clean(title), notes: "", kind: kind)
        next.bpm = Int(clean(bpm)) ?? 0
        next.keyCode = Camelot(clean(keyCode))?.code ?? ""
        next.side = clean(side).uppercased()
        if record?.bpm != next.bpm, next.bpm > 0 { next.bpmSource = "manual" }
        if record?.keyCode != next.keyCode { next.keySource = next.keyCode.isEmpty ? nil : "manual" }
        if record == nil { crate.add(next) } else { crate.update(next) }
        dismiss()
    }
}

public struct WishlistView: View {
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var wishlist: WishlistStore
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    public init() {}
    public var body: some View {
        let records = wishlist.recordIDs.compactMap { id in crate.records.first { $0.id == id } }
        VStack(spacing: 0) {
            VxScreenHeader(kicker: L.t("wishlist.kicker", lang), title: L.t("wishlist.title", lang))
            if records.isEmpty {
                VxEmptyState(system: "heart", title: L.t("wishlist.empty_title", lang), message: L.t("wishlist.empty_body", lang))
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(records) { record in
                            VxRecordRow(record) { router.openRelease(record) }
                            Divider().overlay(VxColor.hairline)
                        }
                    }.padding(.horizontal, VxSpace.xl)
                }
            }
        }
    }
}
// SettingsSheet lives in Screens/SettingsView.swift

struct OnboardingView: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    @State private var step = 0
    private let languages = [("en", "English"), ("ru", "Русский"), ("zh", "中文"), ("ja", "日本語")]
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
                TabView(selection: $step) {
                    ForEach(0..<3, id: \.self) { page in
                        GeometryReader { geometry in
                            ScrollView {
                                onboardingContent(for: page)
                                    .frame(maxWidth: .infinity, minHeight: geometry.size.height)
                            }
                        }
                        .tag(page)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                HStack(spacing: VxSpace.s) {
                    ForEach(0..<3, id: \.self) { i in
                        Capsule()
                            .fill(i == step ? theme.accent : VxColor.hairlineStrong)
                            .frame(width: i == step ? 18 : 6, height: 6)
                    }
                }
                if step < 2 {
                    VxButton(L.t("action.continue", lang)) { step += 1 }
                } else {
                    VStack(spacing: VxSpace.m) {
                        VxButton(L.t("action.demo_crate", lang)) {
                            crate.loadDemo()
                            router.showOnboarding = false
                        }
                        VxButton(L.t("action.import_discogs", lang), icon: "square.and.arrow.down", style: .dark) {
                            router.showOnboarding = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                router.sheet = .discogsImport
                            }
                        }
                    }
                }
                VxButton(L.t("action.skip", lang), style: .ghost) { router.showOnboarding = false }
            }.padding(.horizontal, VxSpace.xxl).padding(.bottom, VxSpace.xxl).padding(.top, VxSpace.m)
        }
    }
    @ViewBuilder private func onboardingContent(for step: Int) -> some View {
        if step == 0 {
            VStack(spacing: VxSpace.l) {
                languagePicker
                HeroRecord()
                Text(L.t("onboarding.hero_title", lang))
                    .font(VxFont.largeTitle)
                    .tracking(VxTracking.largeTitle)
                    .foregroundStyle(VxColor.text)
                    .multilineTextAlignment(.center)
                Text(L.t("onboarding.hero_body", lang))
                    .font(VxFont.subhead)
                    .foregroundStyle(VxColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
            }
        } else if step == 1 {
            VStack(spacing: VxSpace.l) {
                Text(L.t("onboarding.smart_kicker", lang))
                    .font(VxFont.labelMono)
                    .tracking(VxTracking.labelMono)
                    .foregroundStyle(theme.accent)
                Text(L.t("onboarding.smart_title", lang))
                    .font(VxFont.title)
                    .foregroundStyle(VxColor.text)
                    .multilineTextAlignment(.center)
                VxCard {
                    HStack(spacing: VxSpace.l) {
                        VxScoreRing(value: 86, color: theme.accent)
                        VStack(alignment: .leading, spacing: VxSpace.s) {
                            VxVerdictPill(.strong)
                            Text(L.t("onboarding.smart_hint", lang))
                                .font(VxFont.bodyStrong)
                                .foregroundStyle(VxColor.text)
                        }
                    }
                }
            }
        } else {
            VStack(spacing: VxSpace.l) {
                Text(L.t("onboarding.start_title", lang))
                    .font(VxFont.largeTitle)
                    .tracking(VxTracking.largeTitle)
                    .foregroundStyle(VxColor.text)
                Text(L.t("onboarding.start_body", lang))
                    .font(VxFont.subhead)
                    .foregroundStyle(VxColor.textSecondary)
                    .multilineTextAlignment(.center)
                VxCard {
                    Text(L.t("onboarding.start_card", lang))
                        .font(VxFont.subhead)
                        .foregroundStyle(VxColor.textSecondary)
                }
            }
        }
    }

    private var languagePicker: some View {
        VStack(spacing: VxSpace.s) {
            Text(L.t("onboarding.choose_language", lang))
                .font(VxFont.labelMono)
                .tracking(VxTracking.labelMono)
                .foregroundStyle(VxColor.textTertiary)
            HStack(spacing: VxSpace.s) {
                ForEach(languages, id: \.0) { code, label in
                    Button { lang = code } label: {
                        Text(label)
                            .font(VxFont.mono(12, .semibold))
                            .foregroundStyle(lang == code ? VxColor.limeInk : VxColor.textSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(lang == code ? theme.accent : VxColor.cardElevated)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
