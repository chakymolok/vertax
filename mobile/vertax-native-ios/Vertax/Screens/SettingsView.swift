import SwiftUI
import UniformTypeIdentifiers

private struct BackupDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    let backup: LibraryBackup

    init(backup: LibraryBackup) { self.backup = backup }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        backup = try LibraryBackup.decode(data)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        try FileWrapper(regularFileWithContents: backup.encoded())
    }
}

// MARK: - Settings sheet
// Presented from RootView via AppSheet.settings (gear button in the Crate header).
// Appearance binds to VertaxTheme (same values the Tweaks panel exposes);
// language is persisted; privacy toggles + data actions + support/about.

public struct SettingsSheet: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var wishlist: WishlistStore
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject private var live: LiveSession
    @Environment(\.colorScheme) var scheme
    @Environment(\.dismiss) var dismiss

    @AppStorage("vx_lang") private var lang = "en"
    @AppStorage("vx_find_recent") private var recent = ""
    @State private var confirmClear = false
    @State private var showExport = false
    @State private var showRestore = false
    @State private var confirmRestore = false
    @State private var pendingBackup: LibraryBackup?
    @State private var readingBackup = false
    @State private var backupMessage: String?
    public init() {}

    static let accents: [(UInt, String)] = [(0xC8FF2E,"Lime"),(0x67D4E6,"Cyan"),(0xE8B15F,"Amber"),(0xE58FB0,"Rose"),(0x9CA8FF,"Indigo")]
    static let langs = [("en","English"),("ru","Русский"),("zh","中文"),("ja","日本語")]

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    appearance
                    general
                    data
                    privacy
                    support
                }.padding(.horizontal, 18).padding(.vertical, 12)
            }
            .background(VxColor.surface)
            .navigationTitle(L.t("settings.title", lang))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { dismiss() } label: { Image(systemName: "xmark") } } }
        }
        .presentationDetents([.large])
        .fileExporter(isPresented: $showExport, document: BackupDocument(backup: currentBackup),
                      contentType: .json, defaultFilename: backupFilename) { result in
            if case .failure = result { backupMessage = L.t("backup.failed", lang) }
        }
        .fileImporter(isPresented: $showRestore, allowedContentTypes: [.json]) { result in
            guard case let .success(url) = result else {
                if case .failure = result { backupMessage = L.t("backup.failed", lang) }
                return
            }
            readBackup(url)
        }
        .confirmationDialog(L.t("backup.restore", lang), isPresented: $confirmRestore, titleVisibility: .visible) {
            Button(L.t("backup.merge", lang)) {
                guard let backup = pendingBackup else { return }
                let current = currentBackup
                let merged = current.merging(backup)
                if merged.records != current.records { crate.records = merged.records }
                if merged.sets != current.sets { set.savedSets = merged.sets }
                if merged.activeSet != current.activeSet { set.orderedIDs = merged.activeSet }
                if merged.wishlist != current.wishlist { wishlist.recordIDs = merged.wishlist }
                pendingBackup = nil
                backupMessage = backupCounts(records: merged.records.count - current.records.count,
                                             sets: merged.sets.count - current.sets.count)
            }
            Button(L.t("action.cancel", lang), role: .cancel) { pendingBackup = nil }
        } message: {
            if let backup = pendingBackup {
                Text(backupCounts(records: backup.records.count, sets: backup.sets.count) + "\n" + L.t("backup.keep", lang))
            }
        }
        .alert(L.t("settings.data", lang), isPresented: Binding(
            get: { backupMessage != nil }, set: { if !$0 { backupMessage = nil } }
        )) {
            Button("OK") { backupMessage = nil }
        } message: {
            Text(backupMessage ?? "")
        }
        .confirmationDialog(L.t("settings.clear_local", lang), isPresented: $confirmClear, titleVisibility: .visible) {
            Button(L.t("common.clear", lang), role: .destructive) {
                live.end()
                crate.clear()
                set.clear()
                set.savedSets.removeAll()
                wishlist.clear()
                recent = ""
                dismiss()
            }
            Button(L.t("action.cancel", lang), role: .cancel) {}
        }
    }

    // APPEARANCE
    private var appearance: some View {
        group(L.t("settings.appearance", lang)) {
            VStack(alignment: .leading, spacing: 11) {
                Text(L.t("settings.accent", lang)).font(VxFont.body).foregroundStyle(VxColor.text)
                HStack(spacing: 11) {
                    ForEach(Self.accents, id: \.0) { hex, name in
                        Button { theme.accentHex = hex } label: {
                            VStack(spacing: 6) {
                                Circle().fill(Color(rgb: hex)).frame(width: 34, height: 34)
                                    .overlay(Circle().strokeBorder(theme.accentHex == hex ? .white : .clear, lineWidth: 2))
                                Text(L.t("accent." + name.lowercased(), lang)).font(VxFont.mono(9.5))
                                    .foregroundStyle(theme.accentHex == hex ? VxColor.text : VxColor.textTertiary)
                            }.frame(maxWidth: .infinity)
                        }.buttonStyle(.plain)
                    }
                }
            }.rowPad(divider: true)
            row(divider: true) {
                Text(L.t("settings.theme", lang)).font(VxFont.body).foregroundStyle(VxColor.text)
            } trailing: {
                Picker("", selection: Binding(get: { theme.preferredScheme == .light ? "light" : "dark" },
                                              set: { theme.preferredScheme = $0 == "light" ? .light : .dark })) {
                    Text(L.t("settings.dark", lang)).tag("dark"); Text(L.t("settings.light", lang)).tag("light")
                }.pickerStyle(.segmented).frame(width: 150)
            }
            row(divider: false) {
                Text(L.t("settings.density", lang)).font(VxFont.body).foregroundStyle(VxColor.text)
            } trailing: {
                Picker("", selection: $theme.density) {
                    ForEach(VxDensity.allCases) { Text(L.t("density." + $0.rawValue, lang)).tag($0) }
                }
                    .pickerStyle(.menu).tint(VxColor.textSecondary)
            }
        }
    }

    // GENERAL
    private var general: some View {
        group(L.t("settings.general", lang)) {
            NavigationLink {
                langPicker
            } label: { rowLabel("globe", L.t("settings.language", lang), Self.langs.first { $0.0 == lang }?.1 ?? "English", chevron: true) }
            .buttonStyle(.plain)
        }
    }

    // COLLECTION & DATA
    private var data: some View {
        group(L.t("settings.data", lang)) {
            Button { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { router.sheet = .discogsImport } } label: {
                rowLabel("square.and.arrow.down", L.t("settings.import", lang), L.t("settings.import_hint", lang), chevron: true)
            }.buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            Button { showExport = true } label: {
                rowLabel("square.and.arrow.up", L.t("settings.export", lang), "JSON", chevron: true)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("backup.export")
            Divider().overlay(VxColor.hairline)
            Button { showRestore = true } label: {
                if readingBackup { ProgressView() }
                else { rowLabel("doc.badge.plus", L.t("backup.restore", lang), "JSON", chevron: true) }
            }
            .disabled(readingBackup)
            .accessibilityIdentifier("backup.restore")
            .buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            Button {
                crate.loadDemo()
                dismiss()
            } label: {
                rowLabel("opticaldisc", L.t("settings.demo", lang), nil, chevron: false)
            }
            .buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            Button(role: .destructive) {
                confirmClear = true
            } label: {
                rowLabel("trash", L.t("settings.clear_local", lang), nil, chevron: false, tint: VxColor.amber)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("backup.clear")
        }
    }

    // PRIVACY
    private var privacy: some View {
        group(L.t("settings.privacy", lang)) {
            rowLabel("lock.fill", L.t("settings.local_only", lang), L.t("settings.no_cloud", lang), chevron: false)
            Divider().overlay(VxColor.hairline)
            NavigationLink {
                ScrollView {
                    Text(L.t("settings.privacy_body", lang))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(VxSpace.xl)
                }
                .navigationTitle(L.t("settings.privacy_details", lang))
            } label: {
                rowLabel("hand.raised", L.t("settings.privacy_details", lang), "", chevron: true)
            }
            .buttonStyle(.plain)
        }
    }

    private var currentBackup: LibraryBackup {
        LibraryBackup(records: crate.records, sets: set.savedSets, activeSet: set.orderedIDs, wishlist: wishlist.recordIDs)
    }

    private var backupFilename: String {
        VertaxLocalStore.testNamespace.map { "vertax-qa-\($0.prefix(8))" } ?? "vertax-ios-backup"
    }

    private func backupCounts(records: Int, sets: Int) -> String {
        "\(L.t("backup.records_count", lang)) \(records) · \(L.t("backup.sets_count", lang)) \(sets)"
    }

    private func readBackup(_ url: URL) {
        readingBackup = true
        Task {
            defer { readingBackup = false }
            do {
                let backup = try await Task.detached(priority: .userInitiated) {
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    let file = try FileHandle(forReadingFrom: url)
                    defer { try? file.close() }
                    let data = try file.read(upToCount: LibraryBackup.maxBytes + 1) ?? Data()
                    return try LibraryBackup.decode(data)
                }.value
                pendingBackup = backup
                confirmRestore = true
            } catch {
                backupMessage = L.t("backup.failed", lang)
            }
        }
    }

    // SUPPORT
    private var support: some View {
        group(L.t("settings.support", lang)) {
            Link(destination: URL(string: "https://vertax.live/about#contact")!) {
                rowLabel("questionmark.circle", L.t("settings.help", lang), "vertax.live", chevron: true)
            }.buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            NavigationLink { aboutView } label: { rowLabel("opticaldisc", L.t("settings.about", lang), L.t("common.version", lang), chevron: true) }.buttonStyle(.plain)
        }
    }

    // MARK: language picker + about
    private var langPicker: some View {
        List(Self.langs, id: \.0) { code, name in
            Button { lang = code } label: {
                HStack { Text(name).foregroundStyle(VxColor.text); Spacer()
                    if lang == code { Image(systemName: "checkmark").foregroundStyle(theme.accentText(scheme)) } }
            }
        }.navigationTitle(L.t("settings.language", lang))
    }
    private var aboutView: some View {
        VStack(spacing: 6) {
            Circle().fill(RadialGradient(colors: [theme.accent, Color(rgb: 0x0C0F0E)], center: .center, startRadius: 0, endRadius: 28)).frame(width: 56, height: 56).padding(.top, 30)
            Text("VERTAX").font(VxFont.mono(16)).tracking(2).foregroundStyle(VxColor.text).padding(.top, 8)
            Text("DIG · PLAY · SHARE").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            Text(L.t("settings.about_body", lang)).font(VxFont.subhead).foregroundStyle(VxColor.textSecondary).multilineTextAlignment(.center).padding(.horizontal, 40).padding(.top, 12)
            Text(L.t("common.version", lang)).font(VxFont.mono(11.5)).foregroundStyle(VxColor.textTertiary).padding(.top, 14)
            Text("This application uses Discogs’ API but is not affiliated with, sponsored or endorsed by Discogs. ‘Discogs’ is a trademark of Zink Media, LLC.")
                .font(VxFont.footnote).foregroundStyle(VxColor.textSecondary)
                .multilineTextAlignment(.center).padding(.horizontal, VxSpace.xl).padding(.top, VxSpace.l)
            Spacer()
        }.frame(maxWidth: .infinity).background(VxColor.bg).navigationTitle(L.t("settings.about_title", lang)).navigationBarTitleDisplayMode(.inline)
    }

    // MARK: builders
    @ViewBuilder private func group<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary).padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .padding(.horizontal, 14)
                .background(VxColor.card).clipShape(RoundedRectangle(cornerRadius: theme.cornerRadius, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: theme.cornerRadius, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
        }
    }
    private func rowLabel(_ icon: String, _ label: String, _ sub: String?, chevron: Bool, tint: Color? = nil) -> some View {
        HStack(spacing: 13) {
            Image(systemName: icon).font(.system(size: 15)).foregroundStyle(tint ?? VxColor.text)
                .frame(width: 30, height: 30).background(VxColor.cardElevated).clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(VxFont.body).foregroundStyle(tint ?? VxColor.text)
                if let sub { Text(sub).font(VxFont.footnote).foregroundStyle(VxColor.textSecondary) }
            }
            Spacer()
            if chevron { Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(VxColor.textTertiary) }
        }.padding(.vertical, 13).contentShape(Rectangle())
    }
    private func toggleRow(_ label: String, _ sub: String?, _ binding: Binding<Bool>, divider: Bool) -> some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(VxFont.body).foregroundStyle(VxColor.text)
                    if let sub { Text(sub).font(VxFont.footnote).foregroundStyle(VxColor.textSecondary) }
                }
                Spacer()
                Toggle("", isOn: binding).labelsHidden().tint(theme.accent)
            }.padding(.vertical, 11)
            if divider { Divider().overlay(VxColor.hairline) }
        }
    }
    @ViewBuilder private func row<L: View, T: View>(divider: Bool, @ViewBuilder _ label: () -> L, @ViewBuilder trailing: () -> T) -> some View {
        VStack(spacing: 0) {
            HStack { label(); Spacer(); trailing() }.padding(.vertical, 11)
            if divider { Divider().overlay(VxColor.hairline) }
        }
    }
}

public struct SettingsScreen: View {
    public init() {}
    public var body: some View {
        SettingsSheet()
    }
}

private extension View {
    func rowPad(divider: Bool) -> some View {
        VStack(spacing: 0) { self.padding(.vertical, 13); if divider { Divider().overlay(VxColor.hairline) } }
    }
}
