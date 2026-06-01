import SwiftUI

// MARK: - Discogs import sheet
// Presented from RootView via .sheet(item:) for AppSheet.discogsImport, and from
// onboarding. Near-identical states to the prototype: idle → loading → done.

public struct ImportSheet: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var router: AppRouter
    @Environment(\.colorScheme) var scheme
    @StateObject private var importer = DiscogsImporter()
    var onFinished: (() -> Void)? = nil
    public init(onFinished: (() -> Void)? = nil) { self.onFinished = onFinished }

    private let examples = ["discogs.com/user/selectordub", "@crate_digger"]

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            switch importer.state {
            case .idle:           idle
            case .loading(let s): loading(step: s)
            case .done(let sum):  done(sum)
            }
        }
        .padding(.horizontal, 18).padding(.top, 10).padding(.bottom, 26)
        .presentationDetents([.medium, .large])
    }

    private var header: some View {
        HStack(spacing: 11) {
            Image(systemName: "square.and.arrow.down").font(.system(size: 20))
                .foregroundStyle(theme.accentText(scheme))
                .frame(width: 38, height: 38).background(theme.accentDim)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(theme.accentLine, lineWidth: 1))
            VStack(alignment: .leading, spacing: 1) {
                Text("Import from Discogs").font(.system(size: 17, weight: .semibold)).foregroundStyle(VxColor.text)
                Text("Yours or anyone's public collection").font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
            }
            Spacer()
        }.padding(.bottom, 16)
    }

    private var idle: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("@").font(VxFont.mono(13)).foregroundStyle(VxColor.textTertiary)
                TextField("Profile link or username", text: $importer.url).font(.system(size: 16))
            }
            .padding(.horizontal, 14).frame(height: 46)
            .background(VxColor.card).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))

            if !importer.handle.isEmpty {
                Text("→ discogs.com/user/\(importer.handle)").font(VxFont.mono(11.5)).foregroundStyle(theme.accentText(scheme)).padding(.top, 9)
            } else {
                HStack(spacing: 7) {
                    ForEach(examples, id: \.self) { ex in
                        Button { importer.url = ex } label: { VxChip(ex, mono: true) }.buttonStyle(.plain)
                    }
                }.padding(.top, 11)
            }

            Text("Vertax pulls every release — artist, label, catalog # and year — then matches BPM & Camelot key automatically. Your collection stays on device.")
                .font(VxFont.caption).foregroundStyle(VxColor.textTertiary).lineSpacing(3).padding(.top, 16)

            VxButton("Import collection", icon: "square.and.arrow.down",
                     style: importer.handle.isEmpty ? .dark : .primary) { importer.run(into: crate) }
                .opacity(importer.handle.isEmpty ? 0.55 : 1).padding(.top, 18)
        }
    }

    private func loading(step: Int) -> some View {
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
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(DiscogsImport.steps.enumerated()), id: \.offset) { i, s in
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
                }
            }
        }
    }

    private func done(_ sum: ImportSummary) -> some View {
        VStack(spacing: 0) {
            Image(systemName: "checkmark").font(.system(size: 30, weight: .bold)).foregroundStyle(theme.accentText(scheme))
                .frame(width: 64, height: 64).background(theme.accentDim)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(theme.accentLine, lineWidth: 1))
                .padding(.bottom, 16)
            Text("Collection imported").font(.system(size: 19, weight: .bold)).foregroundStyle(VxColor.text)
            HStack(spacing: 0) {
                stat("\(sum.records)", "RECORDS", VxColor.text)
                Divider().frame(height: 36).overlay(VxColor.hairline)
                stat("\(sum.labels)", "LABELS", VxColor.text)
                Divider().frame(height: 36).overlay(VxColor.hairline)
                stat("\(sum.records)", "ANALYZED", theme.accentText(scheme))
            }.padding(.vertical, 18)
            VxButton("Go to crate") {
                router.tab = .crate; router.showOnboarding = false; router.sheet = nil; onFinished?()
            }
        }.frame(maxWidth: .infinity)
    }
    private func stat(_ v: String, _ l: String, _ c: Color) -> some View {
        VStack(spacing: 5) { Text(v).font(VxFont.bpm(26)).foregroundStyle(c); Text(l).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary) }.frame(maxWidth: .infinity)
    }
}
