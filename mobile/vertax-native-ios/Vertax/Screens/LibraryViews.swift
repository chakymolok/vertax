import SwiftUI
import UniformTypeIdentifiers

struct SetTextDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.plainText]
    let text: String

    init(text: String) { self.text = text }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents, let text = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.text = text
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}

struct TargetSetView: View {
    @EnvironmentObject private var theme: VertaxTheme
    @Environment(\.colorScheme) private var scheme
    @EnvironmentObject private var crate: CrateStore
    @EnvironmentObject private var set: SetStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("vx_lang") private var lang = "en"
    @State private var minutes = 30
    @State private var genre = ""
    @State private var fromDraft = false

    var body: some View {
        let plan = SetPlanner.generate(library: crate.records, source: fromDraft ? set.orderedIDs : nil,
                                       genre: genre, minutes: minutes)
        NavigationStack {
            Form {
                Section {
                    choiceMenu("build.source", value: L.t(fromDraft ? "plan.draft" : "plan.crate", lang), selection: $fromDraft) {
                        Text(L.t("plan.crate", lang)).tag(false)
                        Text(L.t("plan.draft", lang)).tag(true).disabled(set.orderedIDs.isEmpty)
                    }
                    .accessibilityIdentifier("set.target.source")
                    choiceMenu("plan.genre", value: genre.isEmpty ? L.t("plan.any_genre", lang) : genre, selection: $genre) {
                        Text(L.t("plan.any_genre", lang)).tag("")
                        ForEach(SetPlanner.genres(in: crate.records), id: \.self) { Text($0).tag($0) }
                    }
                    .accessibilityIdentifier("set.target.genre")
                    choiceMenu("plan.duration", value: String(format: L.t("plan.minutes", lang), minutes), selection: $minutes) {
                        ForEach([15, 30, 60, 90, 120], id: \.self) {
                            Text(String(format: L.t("plan.minutes", lang), $0)).tag($0)
                        }
                    }
                    .accessibilityIdentifier("set.target.duration")
                } footer: {
                    Text(L.t("plan.estimate_rule", lang)).foregroundStyle(VxColor.textSecondary)
                }
                Section {
                    if plan.tracks.isEmpty {
                        Text(L.t(plan.eligible == 0 ? "plan.no_tracks" : "plan.no_time", lang))
                    } else {
                        Text(String(format: L.t("plan.summary", lang), plan.tracks.count, SetPlanner.clock(plan.estimatedSeconds)))
                            .accessibilityIdentifier("set.target.summary")
                        if plan.shortfall { Text(L.t("plan.short", lang)).foregroundStyle(VxColor.textSecondary) }
                    }
                    if plan.missingDuration > 0 {
                        Text(String(format: L.t("plan.missing_time", lang), plan.missingDuration)).foregroundStyle(VxColor.textSecondary)
                    }
                    if plan.missingMixMetadata > 0 {
                        Text(String(format: L.t("plan.missing_metadata", lang), plan.missingMixMetadata)).foregroundStyle(VxColor.textSecondary)
                    }
                } header: {
                    Text(L.t("plan.preview", lang)).foregroundStyle(VxColor.textSecondary)
                }
                if !plan.tracks.isEmpty {
                    Section {
                        Button(set.orderedIDs.isEmpty ? L.t("plan.use", lang) : L.t("plan.replace", lang)) {
                            set.orderedIDs = plan.tracks.map(\.id)
                            dismiss()
                        }
                        .frame(minHeight: 44, alignment: .leading)
                        .accessibilityIdentifier("set.target.apply")
                    }
                    Section {
                        ForEach(plan.tracks) { track in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(track.artist) / \(track.title)")
                                if let length = SetPlanner.length(track) {
                                    Text(SetPlanner.clock(length)).font(.footnote.monospacedDigit()).foregroundStyle(VxColor.textSecondary)
                                }
                            }
                        }
                    } header: { Text(L.t("build.source_tracks", lang)).foregroundStyle(VxColor.textSecondary) }
                }
            }
            .navigationTitle(L.t("plan.title", lang))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(L.t("action.cancel", lang)) { dismiss() } } }
        }
        .tint(scheme == .dark ? theme.accent : .primary)
    }

    private func choiceMenu<Value: Hashable, Options: View>(_ key: String, value: String, selection: Binding<Value>,
                                                           @ViewBuilder options: () -> Options) -> some View {
        let label = L.t(key, lang)
        return Menu {
            Picker(label, selection: selection, content: options)
                .pickerStyle(.inline)
        } label: {
            ViewThatFits(in: .horizontal) {
                HStack {
                    Text(label).foregroundStyle(.primary).fixedSize()
                    Spacer()
                    Text(value).fixedSize()
                    Image(systemName: "chevron.up.chevron.down").font(.footnote)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(label).foregroundStyle(.primary)
                    Label(value, systemImage: "chevron.up.chevron.down")
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }
}

struct TempoScaleControls: View {
    @EnvironmentObject private var theme: VertaxTheme
    @Environment(\.colorScheme) private var scheme
    @Binding var text: String
    let lang: String

    var body: some View {
        HStack {
            scale(.double, "×2", "edit.double_bpm")
            Spacer(minLength: 8)
            scale(.half, "÷2", "edit.half_bpm")
        }
        .buttonStyle(.borderless)
        .tint(scheme == .dark ? theme.accent : .primary)
    }

    private func scale(_ scale: TempoValue.Scale, _ title: String, _ label: String) -> some View {
        let bpm = scale.apply(to: Int(text.trimmingCharacters(in: .whitespacesAndNewlines)))
        return Button {
            if let bpm { text = String(bpm) }
        } label: {
            Text(title).font(.body.monospacedDigit()).frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel(L.t(label, lang))
        .accessibilityIdentifier(label)
        .disabled(bpm == nil)
    }
}

enum FindRoute: Hashable { case editions }

struct DiscogsSearchView: View {
    @EnvironmentObject private var crate: CrateStore
    @EnvironmentObject private var router: AppRouter
    @AppStorage("vx_lang") private var lang = "en"
    @State private var titleQuery = ""
    @State private var catalogQuery = ""
    @State private var byCatalog = false
    @State private var request: Task<Void, Never>?
    @State private var loading = false
    @State private var selection: Int?
    @State private var results: [DiscogsEdition]?
    @State private var errorKey: String?

    var body: some View {
        VStack(spacing: VxSpace.m) {
            Picker(L.t("find.discogs_editions", lang), selection: $byCatalog) {
                Text(L.t("find.by_title", lang)).tag(false)
                Text(L.t("find.by_catalog", lang)).tag(true)
            }
            .pickerStyle(.segmented)
            .disabled(selection != nil)
            .onChange(of: byCatalog) { _ in
                request?.cancel()
                results = nil
                errorKey = nil
                loading = false
            }
            HStack {
                VxSearchField(text: byCatalog ? $catalogQuery : $titleQuery,
                              placeholder: L.t(byCatalog ? "find.by_catalog" : "find.by_title", lang),
                              onSubmit: search, dismissKeyboard: loading)
                Button(action: search) {
                    Image(systemName: "magnifyingglass")
                        .frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel(L.t("tab.find", lang))
                .accessibilityIdentifier("discogs.search")
                .disabled(searchText.isEmpty || selection != nil)
            }
            if loading { ProgressView() }
            if let errorKey {
                Text(L.t(errorKey, lang)).foregroundStyle(.secondary)
            }
            if let results {
                if results.isEmpty {
                    Text(L.t("find.no_editions", lang)).foregroundStyle(.secondary)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: VxSpace.s) {
                            ForEach(results) { edition in
                                editionRow(edition)
                                Divider()
                            }
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, VxSpace.l)
        .navigationTitle(L.t("find.discogs_editions", lang))
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { request?.cancel() }
    }

    private func editionRow(_ edition: DiscogsEdition) -> some View {
        let id = "discogs-\(edition.id)"
        let saved = crate.records.contains { $0.id == id }
        let details = [edition.catno, edition.year, edition.country, edition.label?.first]
            .compactMap { $0 }.filter { !$0.isEmpty }
        let format = (edition.format ?? []).filter { !$0.isEmpty }
        return VStack(alignment: .leading, spacing: VxSpace.xs) {
            Button {
                open(edition)
            } label: {
                HStack(alignment: .top, spacing: VxSpace.m) {
                    VStack(alignment: .leading, spacing: VxSpace.xs) {
                        Text(edition.title).font(.body.weight(.semibold)).foregroundStyle(.primary)
                        if !details.isEmpty {
                            Text(details.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
                        }
                        if !format.isEmpty {
                            Text(format.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: VxSpace.s)
                    if selection == edition.id {
                        ProgressView()
                    } else {
                        Image(systemName: saved ? "checkmark.circle" : "plus.circle")
                            .accessibilityLabel(L.t(saved ? "release.in_crate" : "find.save_crate", lang))
                    }
                }
                .frame(minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(loading || selection != nil)
            .accessibilityIdentifier("discogs.edition.\(edition.id)")
            DiscogsAttribution(url: edition.url)
        }
    }

    private var searchText: String {
        (byCatalog ? catalogQuery : titleQuery).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func search() {
        let value = searchText
        guard !value.isEmpty, selection == nil else { return }
        let catalog = byCatalog
        request?.cancel()
        results = nil
        errorKey = nil
        loading = true
        request = Task {
            do {
                let editions = try await VertaxAPI().searchDiscogsEditions(query: value, byCatalog: catalog)
                try Task.checkCancellation()
                results = editions
            } catch {
                guard !Task.isCancelled else { return }
                errorKey = "find.editions_failed"
            }
            loading = false
        }
    }

    private func open(_ edition: DiscogsEdition) {
        if let record = crate.records.first(where: { $0.id == "discogs-\(edition.id)" }) {
            router.openRelease(record)
            return
        }
        selection = edition.id
        errorKey = nil
        request = Task {
            do {
                let record = try await VertaxAPI().discogsRecord(releaseID: edition.id)
                try Task.checkCancellation()
                crate.add(record)
                selection = nil
                router.openRelease(record)
            } catch {
                guard !Task.isCancelled else { return }
                selection = nil
                errorKey = "find.edition_failed"
            }
        }
    }
}

struct SavedSetsView: View {
    @EnvironmentObject private var set: SetStore
    @EnvironmentObject private var crate: CrateStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("vx_lang") private var lang = "en"
    @State private var pending: SavedSet?
    @State private var deleting: SavedSet?
    @State private var renaming: SavedSet?
    @State private var name = ""
    @State private var showLoad = false
    @State private var showDelete = false
    @State private var showRename = false

    var body: some View {
        let available = Set(crate.records.map(\.id))
        NavigationStack {
            List {
                if set.savedSets.isEmpty {
                    Text(L.t("build.saved_empty", lang)).foregroundStyle(.secondary)
                }
                ForEach(set.savedSets) { item in
                    let count = item.entryIDs.filter(available.contains).count
                    Button {
                        if set.orderedIDs.isEmpty || set.orderedIDs == item.entryIDs { open(item) }
                        else { pending = item; showLoad = true }
                    } label: {
                        VStack(alignment: .leading, spacing: VxSpace.xs) {
                            Text(item.name).font(.headline)
                            Text("\(L.t("build.entries", lang)) \(count)").font(.footnote).foregroundStyle(.secondary)
                        }
                        .frame(minHeight: 44, alignment: .leading)
                    }
                    .disabled(count == 0)
                    .swipeActions(allowsFullSwipe: false) {
                        Button(role: .destructive) { deleting = item; showDelete = true } label: {
                            Label(L.t("build.delete_saved", lang), systemImage: "trash")
                        }
                        Button { name = item.name; renaming = item; showRename = true } label: {
                            Label(L.t("build.rename", lang), systemImage: "pencil")
                        }.tint(.accentColor)
                    }
                }
            }
            .navigationTitle(L.t("build.saved", lang))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L.t("action.cancel", lang)) { dismiss() } }
            }
        }
        .alert(L.t("build.load_replace", lang), isPresented: $showLoad) {
            Button(L.t("build.load", lang)) { if let pending { open(pending) } }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
        .alert(L.t("build.delete_saved", lang), isPresented: $showDelete) {
            Button(L.t("build.delete_saved", lang), role: .destructive) {
                if let deleting { set.savedSets.removeAll { $0.id == deleting.id } }
            }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
        .alert(L.t("build.rename", lang), isPresented: $showRename) {
            TextField(L.t("build.name", lang), text: $name)
            Button(L.t("action.save", lang)) { if let renaming { set.rename(renaming.id, to: name) } }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
    }

    private func open(_ item: SavedSet) {
        set.orderedIDs = item.entryIDs
        dismiss()
    }
}
