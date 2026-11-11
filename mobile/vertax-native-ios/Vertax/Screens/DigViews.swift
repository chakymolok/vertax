import SwiftUI

struct ReleaseFitSearch: View {
    @AppStorage("vx_lang") private var lang = "en"
    @State private var title = ""
    @State private var catalog = ""
    @State private var byCatalog = false
    @State private var request: Task<Void, Never>?
    @State private var loading = false
    @State private var failure: String?
    @State private var results: [DiscogsEdition]?
    @State private var lastQuery: String?
    @State private var selected: Int?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: VxSpace.m) {
                Picker(L.t("find.discogs_editions", lang), selection: $byCatalog) {
                    Text(L.t("find.by_title", lang)).tag(false)
                    Text(L.t("find.by_catalog", lang)).tag(true)
                }
                .pickerStyle(.segmented)
                .onChange(of: byCatalog) { _ in
                    request?.cancel()
                    loading = false
                    results = nil
                    lastQuery = nil
                    failure = nil
                }
                VxSearchField(text: byCatalog ? $catalog : $title,
                              placeholder: L.t(byCatalog ? "find.by_catalog" : "find.by_title", lang),
                              onSubmit: search, dismissKeyboard: loading)
                    .accessibilityIdentifier("release-fit.query")
                VxButton(L.t("tab.find", lang), icon: "magnifyingglass", action: search)
                    .accessibilityIdentifier("release-fit.search")
                    .disabled(query.isEmpty || loading)
                if loading {
                    ProgressView(L.t("find.loading", lang))
                    Button(L.t("common.cancel", lang), action: cancelSearch).frame(minHeight: 44)
                        .accessibilityIdentifier("release-fit.search.cancel")
                }
                if let failure, lastQuery == query { Text(L.t(failure, lang)).foregroundStyle(.secondary) }
                if let results, lastQuery == query {
                    if results.isEmpty {
                        Text(L.t("find.no_editions", lang)).foregroundStyle(.secondary)
                    } else {
                        Text(L.t("fit.choose_edition", lang)).font(.headline)
                        ForEach(results) { edition in
                            Button {
                                selected = edition.id
                            } label: {
                                let details = [edition.catno, edition.year, edition.country, edition.label?.first]
                                    .compactMap { $0 }.filter { !$0.isEmpty }
                                HStack(spacing: VxSpace.m) {
                                    VStack(alignment: .leading, spacing: VxSpace.xs) {
                                        Text(edition.title).font(.body.weight(.semibold))
                                        if !details.isEmpty { Text(details.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary) }
                                        if let format = edition.format, !format.isEmpty {
                                            Text(format.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right").foregroundStyle(.secondary)
                                }
                                .frame(minHeight: 44, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("release-fit.edition.\(edition.id)")
                            DiscogsAttribution(url: edition.url)
                            Divider()
                        }
                    }
                }
            }
            .padding(.horizontal, VxSpace.xl)
            .padding(.vertical, VxSpace.m)
        }
        .navigationTitle(L.t("fit.title", lang))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
            if let selected { ReleaseFitView(releaseID: selected).id(selected) }
        }
        .onDisappear {
            cancelSearch()
        }
        .onChange(of: query) { value in if loading && value != lastQuery { cancelSearch() } }
    }

    private var query: String {
        String((byCatalog ? catalog : title).trimmingCharacters(in: .whitespacesAndNewlines).prefix(180))
    }

    private func cancelSearch() {
        request?.cancel()
        request = nil
        loading = false
    }

    private func search() {
        let value = query
        let catalogMode = byCatalog
        guard !value.isEmpty, !loading, lastQuery != value || results?.isEmpty != false else { return }
        lastQuery = value
        failure = nil
        results = nil
        loading = true
        request = Task {
            do {
                let editions = try await VertaxAPI().searchDiscogsEditions(query: value, byCatalog: catalogMode)
                try Task.checkCancellation()
                results = editions
            } catch {
                guard !Task.isCancelled else { return }
                failure = VertaxAPIError.messageKey(error, fallback: "find.editions_failed")
            }
            loading = false
        }
    }
}

struct ReleaseFitView: View {
    @EnvironmentObject private var crate: CrateStore
    @EnvironmentObject private var theme: VertaxTheme
    @Environment(\.colorScheme) private var scheme
    @AppStorage("vx_lang") private var lang = "en"
    let releaseID: Int
    @State private var release: DiscogsAnalysisRelease?
    @State private var checked: [Int: CrateDig.Track] = [:]
    @State private var request: Task<Void, Never>?
    @State private var working = false
    @State private var failure: String?
    @State private var edits: [String: CrateDig.AnalysisEdit] = [:]
    @State private var editing: AnalysisTrackInput?
    @State private var showMissing = false

    var body: some View {
        let local = release?.tracks.isEmpty != false
        let saved = local ? DiscogsAnalysisRelease.saved(id: releaseID, in: crate.records) : nil
        ScrollView {
            LazyVStack(alignment: .leading, spacing: VxSpace.l) {
                if let entry = saved ?? release {
                    let tracks = entry.tracks.map { saved == nil ? checked[$0.id] ?? $0 : $0 }
                    let fit = CrateDig.releaseFit(tracks, releaseID: releaseID, crate: crate.records, edits: edits, local: saved != nil)
                    let keys = CrateDig.editKeys(tracks, local: saved != nil)
                    releaseHeader(entry)
                    if saved != nil {
                        Text(L.t("fit.saved_only", lang)).font(.subheadline).foregroundStyle(.secondary)
                    }
                    if tracks.isEmpty {
                        Text(L.t("fit.empty_tracklist", lang)).foregroundStyle(.secondary)
                    } else {
                        fitSummary(fit)
                        if saved == nil {
                            requestControls(tracks: tracks, fit: fit)
                        } else if working {
                            ProgressView(L.t("find.loading", lang))
                            Button(L.t("common.cancel", lang), action: cancel).frame(minHeight: 44)
                        } else if release == nil {
                            loadFailure
                        }
                        let paired = fit.rows.filter { !$0.pairs.isEmpty }
                        let unmatched = fit.rows.filter { $0.track.complete && $0.pairs.isEmpty }
                        let missing = fit.rows.filter { !$0.track.complete }
                        if !missing.isEmpty {
                            missingTracks(missing, keys: keys)
                        }
                        if !paired.isEmpty {
                            Text(L.t("fit.pairs", lang)).font(.headline).accessibilityAddTraits(.isHeader)
                            ForEach(paired) { row in
                                trackRow(row.track, key: keys[row.id])
                                ForEach(row.pairs, id: \.record.id) { pair in pairRow(pair) }
                                Divider()
                            }
                        }
                        if !unmatched.isEmpty {
                            trackGroup("fit.unmatched", rows: unmatched, keys: keys)
                        }
                    }
                } else if working {
                    ProgressView(L.t("find.loading", lang)).accessibilityIdentifier("release-fit.progress")
                    Button(L.t("common.cancel", lang), action: cancel)
                } else {
                    loadFailure
                }
            }
            .padding(.horizontal, VxSpace.xl)
            .padding(.vertical, VxSpace.m)
            .padding(.bottom, VxSize.tabBar)
        }
        .navigationTitle(L.t("fit.title", lang))
        .navigationBarTitleDisplayMode(.inline)
        .tint(scheme == .dark ? theme.accent : .primary)
        .task { if release == nil && failure == nil && !working { run() } }
        .onDisappear(perform: cancel)
        .sheet(item: $editing) { item in
            AnalysisTrackEditor(item: item, value: edits[item.id]) { value in
                edits[item.id] = value.isEmpty ? nil : value
            }
        }
    }

    private var loadFailure: some View {
        VStack(alignment: .leading, spacing: VxSpace.s) {
            if let failure { Text(L.t(failure, lang)).foregroundStyle(.secondary) }
            Button(action: run) { Label(L.t("import.retry", lang), systemImage: "arrow.clockwise") }
                .frame(minHeight: 44)
                .accessibilityIdentifier("release-fit.retry")
        }
    }

    private func releaseHeader(_ release: DiscogsAnalysisRelease) -> some View {
        let record = release.record
        let details = [record.label, record.catalog, record.year, release.country].filter { !$0.isEmpty }
        return VStack(alignment: .leading, spacing: VxSpace.xs) {
            Text(record.title).font(.title2.bold()).accessibilityIdentifier("release-fit.title")
            Text(record.artist).font(.body).foregroundStyle(.secondary)
            Text(details.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
            if release.vinylOnlySubset {
                Text(L.t("fit.mixed_media", lang)).font(.footnote).foregroundStyle(.secondary)
            }
            if let url = record.discogsURL { DiscogsAttribution(url: url) }
        }
    }

    private func fitSummary(_ fit: CrateDig.Fit) -> some View {
        VStack(alignment: .leading, spacing: VxSpace.s) {
            if let score = fit.score {
                Text(L.t("fit.score", lang)).font(.headline)
                Text("\(score)/100").font(.system(.title, design: .monospaced).bold())
                    .accessibilityIdentifier("release-fit.score")
                Text(L.t("fit.confidence.\(fit.confidence.rawValue)", lang)).font(.subheadline)
                Text(fmt("fit.strong_count", fit.strongCount, fit.knownCount)).font(.footnote)
            } else {
                Text(L.t(fit.crateKnownCount == 0 ? "fit.no_crate" : "fit.no_known", lang)).font(.headline)
            }
            Text(fmt("fit.coverage", fit.knownCount, fit.rows.count))
                .font(.subheadline).foregroundStyle(.secondary)
                .accessibilityIdentifier("release-fit.coverage")
            DisclosureGroup(L.t("fit.method_title", lang)) {
                Text(L.t("fit.method", lang))
                    .font(.footnote).foregroundStyle(.secondary).padding(.top, VxSpace.xs)
            }
            .font(.footnote.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(VxSpace.m)
        .background(VxColor.card, in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder private func requestControls(tracks: [CrateDig.Track], fit: CrateDig.Fit) -> some View {
        let completedLocally = Set(fit.rows.filter(\.track.complete).map(\.id))
        let pending = tracks.filter { checked[$0.id] == nil && !$0.artist.isEmpty && !completedLocally.contains($0.id) }.count
        if let failure { Text(L.t(failure, lang)).font(.footnote).foregroundStyle(.secondary) }
        if working {
            HStack(spacing: VxSpace.s) {
                ProgressView().accessibilityHidden(true)
                Text(L.t("fit.checking", lang)).font(.subheadline).foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("release-fit.progress")
            Button(L.t("common.cancel", lang), action: cancel)
                .frame(minHeight: 44)
                .accessibilityIdentifier("release-fit.cancel")
        } else if pending > 0 {
            VxButton(fmt("fit.check_more", pending), icon: "arrow.clockwise", style: .dark, action: run)
                .accessibilityIdentifier("release-fit.check-more")
        }
    }

    private func trackGroup(_ key: String, rows: [CrateDig.Fit.Row], keys: [Int: String]) -> some View {
        DisclosureGroup(fmt(key, rows.count)) {
            VStack(alignment: .leading, spacing: VxSpace.s) {
                ForEach(rows) { trackRow($0.track, key: keys[$0.id]) }
            }
            .padding(.vertical, VxSpace.s)
        }
        .font(.subheadline.weight(.semibold))
    }

    private func missingTracks(_ rows: [CrateDig.Fit.Row], keys: [Int: String]) -> some View {
        let label = fmt("fit.missing", rows.count)
        return VStack(alignment: .leading, spacing: VxSpace.s) {
            if rows.count > 2 {
                Button {
                    showMissing.toggle()
                } label: {
                    HStack {
                        Text(label)
                        Spacer()
                        Image(systemName: showMissing ? "chevron.down" : "chevron.right").accessibilityHidden(true)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .font(.subheadline.weight(.semibold))
                .accessibilityAddTraits(showMissing ? .isSelected : [])
                .accessibilityIdentifier("release-fit.missing")
            } else {
                Text(label).font(.headline).accessibilityAddTraits(.isHeader)
            }
            if rows.count <= 2 || showMissing {
                ForEach(rows) { trackRow($0.track, key: keys[$0.id]) }
            }
        }
    }

    private func trackRow(_ track: CrateDig.Track, key: String?) -> some View {
        VStack(alignment: .leading, spacing: VxSpace.xs) {
            Text([track.position, track.title].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.body.weight(.semibold))
            if !track.artist.isEmpty { Text(track.artist).font(.subheadline).foregroundStyle(.secondary) }
            Text(meta(track.bpm, track.camelot?.code)).font(.system(.footnote, design: .monospaced)).foregroundStyle(.secondary)
            if let url = track.metadataURL {
                Link(destination: url) {
                    Label("Beatport", systemImage: "arrow.up.right").font(.footnote)
                }
                .frame(minHeight: 44)
            }
            if let key, !track.complete || edits[key] != nil {
                Button {
                    editing = AnalysisTrackInput(id: key, track: track)
                } label: {
                    Label(L.t("fit.edit_track", lang), systemImage: "slider.horizontal.3")
                        .frame(minHeight: 44, alignment: .leading)
                }
                .accessibilityLabel(L.t("fit.edit_track", lang) + ": " + track.title)
                .accessibilityIdentifier("release-fit.edit.\(track.id)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func pairRow(_ pair: CrateDig.Pair) -> some View {
        let record = pair.record
        let difference = pair.tempoDifference.formatted(.percent.precision(.fractionLength(0...1)).locale(Locale(identifier: lang)))
        return VStack(alignment: .leading, spacing: VxSpace.xs) {
            HStack(alignment: .firstTextBaseline, spacing: VxSpace.m) {
                Text("\(record.artist) · \(record.title)").font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                Text("\(Int((pair.score * 100).rounded()))%").font(.system(.headline, design: .monospaced))
            }
            Text(meta(record.bpm, record.validCamelot?.code)).font(.system(.footnote, design: .monospaced))
            Text([L.t("fit.key.\(pair.harmonic.rawValue)", lang),
                  pair.doubleTime ? L.t("fit.double_tempo", lang) : fmt("fit.tempo_delta", difference),
                  pair.differentStyles ? L.t("fit.style_penalty", lang) : nil]
                .compactMap { $0 }.joined(separator: " · "))
                .font(.footnote)
            if let url = record.discogsURL { DiscogsAttribution(url: url) }
        }
        .foregroundStyle(.secondary)
        .padding(.leading, VxSpace.m)
    }

    private func meta(_ bpm: Int?, _ key: String?) -> String {
        [bpm.map { "\($0) BPM" } ?? L.t("fit.unknown_bpm", lang), key ?? L.t("fit.unknown_key", lang)].joined(separator: " · ")
    }

    private func fmt(_ key: String, _ args: CVarArg...) -> String {
        String(format: L.t(key, lang), locale: Locale(identifier: lang), arguments: args)
    }

    private func cancel() {
        request?.cancel()
        request = nil
        working = false
    }

    private func run() {
        guard !working else { return }
        working = true
        failure = nil
        request = Task {
            do {
                let api = VertaxAPI()
                let entry: DiscogsAnalysisRelease
                if let release { entry = release } else { entry = try await api.discogsAnalysisRelease(id: releaseID) }
                try Task.checkCancellation()
                release = entry
                let fit = CrateDig.releaseFit(entry.tracks.map { checked[$0.id] ?? $0 },
                                              releaseID: releaseID, crate: crate.records, edits: edits)
                let localIDs = Set(fit.rows.filter(\.track.complete).map(\.id))
                let next = entry.tracks.lazy.filter { checked[$0.id] == nil && !$0.artist.isEmpty && !localIDs.contains($0.id) }.prefix(6)
                for (index, track) in Array(next).enumerated() {
                    if index > 0 { try await Task.sleep(nanoseconds: 1_100_000_000) }
                    try Task.checkCancellation()
                    let found = try await api.enrichPublicTrack(track, label: entry.lookupLabel)
                    try Task.checkCancellation()
                    checked[track.id] = found
                }
            } catch {
                guard !Task.isCancelled else { return }
                failure = VertaxAPIError.messageKey(error, fallback: release == nil ? "fit.release_failed" : "fit.track_failed")
            }
            working = false
            request = nil
        }
    }
}

private struct AnalysisTrackInput: Identifiable {
    let id: String
    let track: CrateDig.Track
}

private struct AnalysisTrackEditor: View {
    @EnvironmentObject private var theme: VertaxTheme
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    @AppStorage("vx_lang") private var lang = "en"
    @State private var bpm: String
    @State private var key: String
    let item: AnalysisTrackInput
    let apply: (CrateDig.AnalysisEdit) -> Void

    init(item: AnalysisTrackInput, value: CrateDig.AnalysisEdit?, apply: @escaping (CrateDig.AnalysisEdit) -> Void) {
        self.item = item
        self.apply = apply
        _bpm = State(initialValue: value?.bpm.map(String.init) ?? "")
        _key = State(initialValue: value?.camelot?.code ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(item.track.title) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("BPM").font(.footnote).foregroundStyle(VxColor.textSecondary).accessibilityHidden(true)
                        TextField("BPM", text: $bpm, prompt: item.track.bpm.map { Text(String($0)).foregroundColor(VxColor.textSecondary) })
                            .keyboardType(.numberPad).accessibilityIdentifier("fit.edit.bpm")
                    }
                    TempoScaleControls(text: $bpm, lang: lang)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Camelot").font(.footnote).foregroundStyle(VxColor.textSecondary).accessibilityHidden(true)
                        TextField("Camelot", text: $key, prompt: item.track.camelot.map { Text($0.code).foregroundColor(VxColor.textSecondary) })
                            .textInputAutocapitalization(.characters).autocorrectionDisabled()
                            .accessibilityIdentifier("fit.edit.camelot")
                    }
                    if let invalid { Text(L.t(invalid, lang)).foregroundStyle(.primary) }
                }
                Section { Text(L.t("fit.edit_scope", lang)).font(.footnote).foregroundStyle(VxColor.textSecondary) }
            }
            .navigationTitle(L.t("fit.edit_track", lang))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L.t("action.cancel", lang)) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L.t("action.save", lang)) {
                        apply(CrateDig.AnalysisEdit(bpm: Int(clean(bpm)), camelot: Camelot(clean(key))))
                        dismiss()
                    }
                    .disabled(invalid != nil)
                    .accessibilityIdentifier("fit.edit.save")
                }
            }
        }
        .tint(scheme == .dark ? theme.accent : .primary)
    }

    private func clean(_ value: String) -> String { value.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var invalid: String? {
        if !clean(bpm).isEmpty, Int(clean(bpm)).map(TempoValue.valid.contains) != true { return "edit.invalid_bpm" }
        if !clean(key).isEmpty, Camelot(clean(key)) == nil { return "edit.invalid_camelot" }
        return nil
    }
}

struct CrateGapsView: View {
    @EnvironmentObject private var crate: CrateStore
    @EnvironmentObject private var theme: VertaxTheme
    @AppStorage("vx_lang") private var lang = "en"

    var body: some View {
        let gaps = CrateDig.gaps(crate.records)
        VStack(alignment: .leading, spacing: VxSpace.l) {
            if gaps.total == 0 {
                VxEmptyState(system: "square.stack", title: L.t("gaps.empty", lang),
                             message: L.t("gaps.need_tracks", lang))
            } else {
                Text(fmt("fit.coverage", gaps.known, gaps.total)).font(.subheadline)
                    .accessibilityIdentifier("gaps.coverage")
                if gaps.enoughForTargets {
                    targets(gaps)
                } else {
                    Text(L.t("gaps.limited", lang)).font(.subheadline).foregroundStyle(.secondary)
                }
                if gaps.known > 0 { camelotGrid(gaps) }
                let activeBands = gaps.bands.filter { band in band.count > 0 || gaps.tempoGaps.contains { $0.id == band.id } }
                if !activeBands.isEmpty { tempoRows(activeBands) }
            }
        }
        .padding(.horizontal, VxSpace.xl)
    }

    @ViewBuilder private func targets(_ gaps: CrateDig.Gaps) -> some View {
        VStack(alignment: .leading, spacing: VxSpace.m) {
            Text(L.t("dig.next", lang)).font(.headline).accessibilityAddTraits(.isHeader)
            if gaps.targets.isEmpty && gaps.tempoGaps.isEmpty {
                Text(L.t("gaps.none", lang)).font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(gaps.targets) { target in
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text("\(target.key.code) · \(target.band.label) BPM")
                        .font(.system(.headline, design: .monospaced))
                    Text(fmt("gaps.target", target.count, target.key.code, target.anchor.code))
                        .font(.subheadline).foregroundStyle(.secondary)
                    Text(fmt("gaps.example", "\(target.example.artist) · \(target.example.title) · \(target.example.bpm) BPM"))
                        .font(.footnote).foregroundStyle(.secondary)
                    if let url = target.example.discogsURL { DiscogsAttribution(url: url) }
                }
                .accessibilityIdentifier("gaps.target.\(target.id)")
                Divider()
            }
            ForEach(gaps.tempoGaps) { gap in
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    Text("\(gap.label) BPM").font(.system(.headline, design: .monospaced))
                    Text(L.t("gaps.tempo_gap", lang)).font(.subheadline).foregroundStyle(.secondary)
                }
                Divider()
            }
            if !gaps.targets.isEmpty || !gaps.tempoGaps.isEmpty {
                let prefix = ["en", "zh", "ja"].contains(lang) ? "/\(lang)" : ""
                Link(destination: URL(string: "https://vertax.live\(prefix)/music")!) {
                    Label(L.t("gaps.catalog", lang), systemImage: "arrow.up.right")
                }
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 44)
            }
        }
    }

    private func camelotGrid(_ gaps: CrateDig.Gaps) -> some View {
        VStack(alignment: .leading, spacing: VxSpace.s) {
            Text(L.t("dig.camelot_map", lang)).font(.headline).accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal) {
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    ForEach([Camelot.Letter.A, .B], id: \.self) { letter in
                        HStack(spacing: VxSpace.xs) {
                            ForEach(1...12, id: \.self) { number in
                                let key = Camelot(number: number, letter: letter)
                                let count = gaps.counts[key, default: 0]
                                VStack(spacing: 2) {
                                    Text(key.code).font(.system(.caption2, design: .monospaced))
                                    Text(count.formatted()).font(.system(.caption, design: .monospaced).bold())
                                }
                                .padding(.horizontal, VxSpace.xs)
                                .frame(minWidth: 40, minHeight: 42)
                                .background(count == 0 ? VxColor.card : theme.accent.opacity(min(0.28, 0.09 + Double(count) * 0.025)),
                                            in: RoundedRectangle(cornerRadius: 6))
                                .accessibilityElement(children: .combine)
                            }
                        }
                    }
                }.padding(.bottom, VxSpace.s)
            }
            .accessibilityIdentifier("gaps.camelot")
        }
    }

    private func tempoRows(_ bands: [CrateDig.Band]) -> some View {
        VStack(alignment: .leading, spacing: VxSpace.s) {
            Text(L.t("dig.tempo_coverage", lang)).font(.headline).accessibilityAddTraits(.isHeader)
            let maxCount = bands.map(\.count).max() ?? 1
            ForEach(bands) { band in
                VStack(alignment: .leading, spacing: VxSpace.xs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("\(band.label) BPM").font(.system(.subheadline, design: .monospaced).weight(.semibold))
                        Spacer()
                        Text(band.count.formatted()).monospacedDigit()
                    }
                    if !band.style.isEmpty { Text(band.style).font(.footnote).foregroundStyle(.secondary) }
                    VxBar(value: 100 * band.count / max(1, maxCount), accent: .lime)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .accessibilityIdentifier("gaps.tempo")
    }

    private func fmt(_ key: String, _ args: CVarArg...) -> String {
        String(format: L.t(key, lang), locale: Locale(identifier: lang), arguments: args)
    }
}
