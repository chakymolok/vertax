import SwiftUI

// MARK: - Settings sheet
// Presented from RootView via AppSheet.settings (gear button in the Crate header).
// Appearance binds to VertaxTheme (same values the Tweaks panel exposes);
// language is persisted; privacy toggles + data actions + support/about.

public struct SettingsSheet: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var router: AppRouter
    @Environment(\.colorScheme) var scheme
    @Environment(\.dismiss) var dismiss

    @AppStorage("vx_lang") private var lang = "en"
    @AppStorage("vx_on_device") private var onDevice = true
    @AppStorage("vx_analytics") private var analytics = false
    @AppStorage("vx_crash") private var crash = true

    public init() {}

    static let accents: [(UInt, String)] = [(0xC8FF2E,"Lime"),(0x67D4E6,"Cyan"),(0xE8B15F,"Amber"),(0xE58FB0,"Rose"),(0x9CA8FF,"Indigo")]
    static let langs = [("en","English"),("ru","Русский"),("de","Deutsch"),("es","Español")]

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
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { dismiss() } label: { Image(systemName: "xmark") } } }
        }
        .presentationDetents([.large])
    }

    // APPEARANCE
    private var appearance: some View {
        group("APPEARANCE") {
            VStack(alignment: .leading, spacing: 11) {
                Text("Accent").font(VxFont.body).foregroundStyle(VxColor.text)
                HStack(spacing: 11) {
                    ForEach(Self.accents, id: \.0) { hex, name in
                        Button { theme.accentHex = hex } label: {
                            VStack(spacing: 6) {
                                Circle().fill(Color(rgb: hex)).frame(width: 34, height: 34)
                                    .overlay(Circle().strokeBorder(theme.accentHex == hex ? .white : .clear, lineWidth: 2))
                                Text(name).font(VxFont.mono(9.5)).foregroundStyle(theme.accentHex == hex ? VxColor.text : VxColor.textTertiary)
                            }.frame(maxWidth: .infinity)
                        }.buttonStyle(.plain)
                    }
                }
            }.rowPad(divider: true)
            row(divider: true) {
                Text("Theme").font(VxFont.body).foregroundStyle(VxColor.text)
            } trailing: {
                Picker("", selection: Binding(get: { theme.preferredScheme == .light ? "light" : "dark" },
                                              set: { theme.preferredScheme = $0 == "light" ? .light : .dark })) {
                    Text("Dark").tag("dark"); Text("Light").tag("light")
                }.pickerStyle(.segmented).frame(width: 150)
            }
            row(divider: false) {
                Text("Density").font(VxFont.body).foregroundStyle(VxColor.text)
            } trailing: {
                Picker("", selection: $theme.density) { ForEach(VxDensity.allCases) { Text($0.rawValue.capitalized).tag($0) } }
                    .pickerStyle(.menu).tint(VxColor.textSecondary)
            }
        }
    }

    // GENERAL
    private var general: some View {
        group("GENERAL") {
            NavigationLink {
                langPicker
            } label: { rowLabel("globe", "Language", Self.langs.first { $0.0 == lang }?.1 ?? "English", chevron: true) }
            .buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            rowLabel("metronome", "Default BPM range", "168–176 · DnB", chevron: true)
        }
    }

    // COLLECTION & DATA
    private var data: some View {
        group("COLLECTION & DATA") {
            Button { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { router.sheet = .discogsImport } } label: {
                rowLabel("square.and.arrow.down", "Import from Discogs", "Re-sync or add a collection", chevron: true)
            }.buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            ShareLink(item: "vertax-crate.json") { rowLabel("square.and.arrow.up", "Export collection", "Save crate.json to Files", chevron: true) }
                .buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            rowLabel("externaldrive", "Backup sets & history", "On-device · last: today", chevron: true)
        }
    }

    // PRIVACY
    private var privacy: some View {
        group("PRIVACY") {
            toggleRow("Keep collection on device", "No cloud sync", $onDevice, divider: true)
            toggleRow("Anonymous analytics", "Help improve Vertax", $analytics, divider: true)
            toggleRow("Crash reports", nil, $crash, divider: false)
        }
    }

    // SUPPORT
    private var support: some View {
        group("SUPPORT") {
            Link(destination: URL(string: "https://1994lab.com")!) {
                rowLabel("heart.fill", "Support the author", "Tip to keep Vertax independent", chevron: true, tint: VxColor.amber)
            }.buttonStyle(.plain)
            Divider().overlay(VxColor.hairline)
            NavigationLink { aboutView } label: { rowLabel("opticaldisc", "About Vertax", "Version 1.0", chevron: true) }.buttonStyle(.plain)
        }
    }

    // MARK: language picker + about
    private var langPicker: some View {
        List(Self.langs, id: \.0) { code, name in
            Button { lang = code } label: {
                HStack { Text(name).foregroundStyle(VxColor.text); Spacer()
                    if lang == code { Image(systemName: "checkmark").foregroundStyle(theme.accentText(scheme)) } }
            }
        }.navigationTitle("Language")
    }
    private var aboutView: some View {
        VStack(spacing: 6) {
            Circle().fill(RadialGradient(colors: [theme.accent, Color(rgb: 0x0C0F0E)], center: .center, startRadius: 0, endRadius: 28)).frame(width: 56, height: 56).padding(.top, 30)
            Text("VERTAX").font(VxFont.mono(16)).tracking(2).foregroundStyle(VxColor.text).padding(.top, 8)
            Text("DIG · PLAY · SHARE").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            Text("A smart crate assistant for vinyl DJs.").font(VxFont.subhead).foregroundStyle(VxColor.textSecondary).multilineTextAlignment(.center).padding(.horizontal, 40).padding(.top, 12)
            Text("Version 1.0 · build 100").font(VxFont.mono(11.5)).foregroundStyle(VxColor.textTertiary).padding(.top, 14)
            Spacer()
        }.frame(maxWidth: .infinity).background(VxColor.bg).navigationTitle("About").navigationBarTitleDisplayMode(.inline)
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

private extension View {
    func rowPad(divider: Bool) -> some View {
        VStack(spacing: 0) { self.padding(.vertical, 13); if divider { Divider().overlay(VxColor.hairline) } }
    }
}
