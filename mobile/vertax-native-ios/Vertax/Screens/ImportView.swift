import SwiftUI

// MARK: - Discogs import sheet
// Presented from RootView via .sheet(item:) for AppSheet.discogsImport, and from
// onboarding. Near-identical states to the prototype: idle → loading → done.

public struct ImportSheet: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var router: AppRouter
    @Environment(\.colorScheme) var scheme
    @AppStorage("vx_lang") private var lang = "en"
    @StateObject private var importer = DiscogsImporter()
    var onFinished: (() -> Void)? = nil
    public init(onFinished: (() -> Void)? = nil) { self.onFinished = onFinished }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            switch importer.state {
            case .idle:           idle
            case .loading:        loading
            case .done(let sum):  done(sum)
            case .failed(let message): failed(message)
            }
        }
        .padding(.horizontal, 18).padding(.top, 10).padding(.bottom, 26)
        .presentationDetents([.medium, .large])
        .onDisappear { importer.cancel() }
    }

    private var header: some View {
        HStack(spacing: 11) {
            Image(systemName: "square.and.arrow.down").font(.system(size: 20))
                .foregroundStyle(theme.accentText(scheme))
                .frame(width: 38, height: 38).background(theme.accentDim)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(theme.accentLine, lineWidth: 1))
            VStack(alignment: .leading, spacing: 1) {
                Text(L.t("import.title", lang)).font(.system(size: 17, weight: .semibold)).foregroundStyle(VxColor.text)
                Text(L.t("import.subtitle", lang)).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
            }
            Spacer()
        }.padding(.bottom, 16)
    }

    private var idle: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("@").font(VxFont.mono(13)).foregroundStyle(VxColor.textTertiary)
                TextField(L.t("import.placeholder", lang), text: $importer.url).font(.system(size: 16))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, 14).frame(height: 46)
            .background(VxColor.card).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))

            if !importer.handle.isEmpty {
                Text("→ discogs.com/user/\(importer.handle)").font(VxFont.mono(11.5)).foregroundStyle(theme.accentText(scheme)).padding(.top, 9)
            }

            Text(L.t("import.body", lang))
                .font(VxFont.caption).foregroundStyle(VxColor.textTertiary).lineSpacing(3).padding(.top, 16)

            VxButton(L.t("import.button", lang), icon: "square.and.arrow.down",
                     style: importer.handle.isEmpty ? .dark : .primary) { importer.run(into: crate, lang: lang) }
                .disabled(importer.handle.isEmpty)
                .opacity(importer.handle.isEmpty ? 0.55 : 1).padding(.top, 18)
        }
    }

    private var loading: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "person.fill").foregroundStyle(theme.accentText(scheme))
                    .frame(width: 40, height: 40).background(VxColor.cardElevated).clipShape(Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text("@\(importer.handle)").font(VxFont.bodyStrong).foregroundStyle(VxColor.text)
                    Text("discogs.com/user/\(importer.handle)").font(VxFont.mono(11.5)).foregroundStyle(VxColor.textSecondary)
                }
                Spacer()
            }.padding(14).background(VxColor.card).clipShape(RoundedRectangle(cornerRadius: theme.cornerRadius, style: .continuous))
            VxCard {
                HStack(spacing: VxSpace.m) {
                    ProgressView()
                    Text(L.t("import.step_collection", lang)).font(VxFont.subhead)
                }
            }
            VxButton(L.t("action.cancel", lang), style: .ghost) { importer.cancel() }
        }
    }

    private func done(_ sum: ImportSummary) -> some View {
        VStack(spacing: 0) {
            Image(systemName: "checkmark").font(.system(size: 30, weight: .bold)).foregroundStyle(theme.accentText(scheme))
                .frame(width: 64, height: 64).background(theme.accentDim)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(theme.accentLine, lineWidth: 1))
                .padding(.bottom, 16)
            Text(L.t("import.done", lang)).font(.system(size: 19, weight: .bold)).foregroundStyle(VxColor.text)
            HStack(spacing: 0) {
                stat("\(sum.records)", L.t("import.added", lang), VxColor.text)
                Divider().frame(height: 36).overlay(VxColor.hairline)
                stat("\(sum.labels)", L.t("common.labels", lang), VxColor.text)
            }.padding(.vertical, 18)
            VxButton(L.t("import.go_crate", lang)) {
                router.tab = .crate; router.showOnboarding = false; router.sheet = nil; onFinished?()
            }
        }.frame(maxWidth: .infinity)
    }
    private func failed(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(VxColor.amber)
                .frame(width: 64, height: 64)
                .background(VxColor.cardElevated)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            Text(L.t("import.failed", lang))
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(VxColor.text)
            Text(message)
                .font(VxFont.caption)
                .foregroundStyle(VxColor.textTertiary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
            VxButton(L.t("import.retry", lang), icon: "arrow.clockwise") { importer.state = .idle }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
    private func stat(_ v: String, _ l: String, _ c: Color) -> some View {
        VStack(spacing: 5) { Text(v).font(VxFont.bpm(26)).foregroundStyle(c); Text(l).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary) }.frame(maxWidth: .infinity)
    }
}
