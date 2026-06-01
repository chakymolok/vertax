import SwiftUI

// MARK: - Live Set Mode — view
// Very dark, large numerals, high contrast, lime only for active/compat.
// Entered from BuildView ("Start Live") and a secondary header entry; presented
// as a .fullScreenCover from RootView (router.showLiveSet).

public struct LiveSetView: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var set: SetStore
    @EnvironmentObject var router: AppRouter
    @StateObject private var session: LiveSession
    @State private var dragX: CGFloat = 0

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let nearBlack = Color(rgb: 0x060807)

    public init(mode: LiveMode = .set) { _session = StateObject(wrappedValue: LiveSession(mode: mode)) }

    public var body: some View {
        let order = session.order(set: set, crate: crate)
        let now = order.indices.contains(session.index) ? order[session.index] : nil

        ZStack {
            nearBlack.ignoresSafeArea()
            // darkened cover glow
            if let now { coverGlow(seed: now.coverSeed) }

            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 0) {
                        nowBlock(now: now, count: order.count)
                            .offset(x: dragX)
                            .gesture(swipe(order: order))
                        affordance
                        setlist(order: order)
                        suggestionList(now: now, order: order)
                    }.padding(.horizontal, 16)
                }
                controls(order: order)
            }
        }
        .preferredColorScheme(.dark)
        .onReceive(timer) { _ in session.tick() }
    }

    // MARK: swipe / advance affordance
    private var affordance: some View {
        HStack(spacing: 9) {
            Image(systemName: "chevron.left").font(.system(size: 13)).foregroundStyle(dragX > 12 ? VxColor.textSecondary : VxColor.textTertiary).opacity(dragX > 12 ? 1 : 0.4)
            Text("SWIPE OR PRESS NEXT WHEN MIXED IN").font(.system(size: 9.5, weight: .regular, design: .monospaced)).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(dragX < -12 ? theme.accent : VxColor.textTertiary).opacity(dragX < -12 ? 1 : 0.4)
        }.frame(maxWidth: .infinity).padding(.top, 18)
    }

    // MARK: header
    private var header: some View {
        HStack {
            Button { router.showLiveSet = false } label: {
                Label("End", systemImage: "stop.fill").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color(rgb: 0xE8736A))
            }
            Spacer()
            VStack(spacing: 1) {
                Text(LiveSession.clock(session.elapsed)).font(VxFont.bpm(17)).foregroundStyle(.white)
                Text("TIME IN SET").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            }
            Spacer()
            // mode toggle
            HStack(spacing: 2) {
                ForEach(LiveMode.allCases) { m in
                    Button { session.mode = m; session.index = 0; session.playedIDs = [] } label: {
                        Text(m == .set ? "SET" : "FREE").font(VxFont.mono(11, .medium))
                            .foregroundStyle(session.mode == m ? .white : VxColor.textTertiary)
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(session.mode == m ? Color.white.opacity(0.13) : .clear)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }.buttonStyle(.plain)
                }
            }.padding(2).background(Color.white.opacity(0.07)).clipShape(RoundedRectangle(cornerRadius: 9))
        }.padding(.horizontal, 18).padding(.top, 2).padding(.bottom, 12)
    }

    // MARK: NOW PLAYING
    @ViewBuilder private func nowBlock(now: Record?, count: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Circle().fill(theme.accent).frame(width: 8, height: 8).shadow(color: theme.accent, radius: 5)
                Text("NOW PLAYING").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(theme.accent)
                Spacer()
                Text("\(session.index + 1) / \(count)").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            }.padding(.bottom, 10)
            if let now {
                HStack(spacing: 14) {
                    VxCover(seed: now.coverSeed, catalog: now.catalog, size: 64, radius: 13)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(now.artist).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
                        Text(now.title).font(.system(size: 25, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                    }
                }
                HStack(alignment: .bottom, spacing: 0) {
                    bigStat("\(now.bpm)", "BPM", .white, align: .leading)
                    bigStat(now.keyCode, now.camelot.musicalKey.uppercased(), theme.accent, align: .center)
                    bigStat(Sleeve.position(now.id), "SLEEVE", .white, align: .trailing)
                }.padding(.top, 20)
            }
        }
    }
    private func bigStat(_ value: String, _ label: String, _ color: Color, align: HorizontalAlignment) -> some View {
        VStack(alignment: align, spacing: 8) {
            Text(value).font(VxFont.bpm(62)).foregroundStyle(color)
            Text(label).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
        }.frame(maxWidth: .infinity, alignment: Alignment(horizontal: align, vertical: .center))
    }

    // MARK: setlist
    private func setlist(order: [Record]) -> some View {
        VStack(spacing: 2) {
            HStack {
                Text(session.mode == .set ? "SETLIST" : "CRATE QUEUE").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                Spacer()
                Text("\(session.playedIDs.count) PLAYED").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            }.padding(.vertical, 10)
            ForEach(Array(order.enumerated()), id: \.offset) { i, r in
                let state = i < session.index ? 2 : (i == session.index ? 1 : 0) // 2 played,1 now,0 up
                let isNext = state == 0 && i == session.index + 1
                let rc: LiveCompat? = (isNext && session.index < order.count) ? LiveCompat(from: order[session.index], to: r) : nil
                let rcColor = rc.map { Color.liveLevel($0.level, accent: theme.accent) }
                HStack(spacing: 11) {
                    Group {
                        if state == 2 { Image(systemName: "checkmark").font(.system(size: 13)).foregroundStyle(VxColor.textTertiary) }
                        else if state == 1 { Circle().fill(theme.accent).frame(width: 8, height: 8) }
                        else if let rcColor { Circle().fill(rcColor).frame(width: 9, height: 9).shadow(color: rcColor, radius: 4) }
                        else { Text("\(i+1)").font(VxFont.mono(12)).foregroundStyle(VxColor.textTertiary) }
                    }.frame(width: 18)
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 7) {
                            Text("\(r.artist) — \(r.title)").font(.system(size: 14, weight: state == 1 ? .semibold : .medium))
                                .foregroundStyle(state == 1 ? theme.accent : .white).lineLimit(1)
                            if isNext { Text("NEXT").font(.system(size: 8.5, weight: .regular, design: .monospaced)).tracking(VxTracking.labelMono).foregroundStyle(theme.accent) }
                        }
                        HStack(spacing: 0) {
                            Text(Sleeve.position(r.id)).font(VxFont.mono(10.5)).foregroundStyle(state == 2 ? VxColor.textTertiary : .white)
                            Text(" · \(rc?.label ?? r.label)").font(VxFont.mono(10.5)).foregroundStyle(rcColor ?? VxColor.textTertiary)
                        }
                    }
                    Spacer(minLength: 6)
                    Text("\(r.bpm)").font(VxFont.bpm(13)).foregroundStyle(.white)
                    VxKeyBadge(r.keyCode, highlighted: state == 1)
                }
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(state == 1 ? theme.accentDim : (isNext ? Color.white.opacity(0.035) : .clear))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(state == 1 ? theme.accentLine : (isNext ? VxColor.hairlineStrong : .clear), lineWidth: 1))
                .opacity(state == 2 ? 0.42 : 1)
            }
        }.padding(.top, 14)
    }

    // MARK: suggestions
    private func suggestionList(now: Record?, order: [Record]) -> some View {
        let items = session.suggestions(now: now, order: order, crate: crate)
        return VStack(spacing: 8) {
            HStack {
                Text("SUGGESTED FROM CRATE").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                Spacer()
                Text("FROM NOW · \(now?.keyCode ?? "")").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            }.padding(.vertical, 10)
            ForEach(items, id: \.0.id) { r, c in
                let col = Color.liveLevel(c.level, accent: theme.accent)
                HStack(spacing: 11) {
                    Circle().fill(col).frame(width: 9, height: 9)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(r.artist) — \(r.title)").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                        Text("\(r.bpm) · \(r.keyCode) · \(c.bpmText)").font(VxFont.mono(10.5)).foregroundStyle(col)
                    }
                    Spacer(minLength: 6)
                    Button { set.add(r.id) } label: {
                        Image(systemName: "plus").font(.system(size: 16)).foregroundStyle(.white)
                            .frame(width: 34, height: 34).background(VxColor.cardElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }.buttonStyle(.plain)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Color.white.opacity(0.02))
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
            }
        }.padding(.top, 14).padding(.bottom, 8)
    }

    // MARK: controls
    private func controls(order: [Record]) -> some View {
        HStack(spacing: 12) {
            ctlButton(system: "backward.fill", enabled: session.index > 0) { session.previous() }
            Button { session.advance(in: order) } label: {
                HStack(spacing: 9) { Image(systemName: "checkmark").font(.system(size: 21, weight: .bold)); Text("Mark played · Next").font(.system(size: 17, weight: .bold)) }
                    .frame(maxWidth: .infinity).frame(height: 56)
                    .foregroundStyle(VxColor.limeInk).background(theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }.buttonStyle(.plain).vxPressable()
            ctlButton(system: "arrow.uturn.backward", enabled: !session.playedIDs.isEmpty) { session.undo() }
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 24)
        .background(.ultraThinMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(VxColor.hairline), alignment: .top)
    }
    private func ctlButton(system: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system).font(.system(size: 20))
                .foregroundStyle(enabled ? .white : VxColor.textTertiary)
                .frame(width: 52, height: 56).background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
        }.buttonStyle(.plain)
    }

    // MARK: swipe + cover glow
    private func swipe(order: [Record]) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { dragX = max(-90, min(90, $0.translation.width)) }
            .onEnded { v in
                if v.translation.width < -56 { session.advance(in: order) }
                else if v.translation.width > 56 { session.previous() }
                withAnimation(VxMotion.nav) { dragX = 0 }
            }
    }
    private func coverGlow(seed: String) -> some View {
        let (bg, _) = VxCover(seed: seed).previewTint
        return RadialGradient(colors: [Color(rgb: bg).opacity(0.5), .clear], center: .init(x: 0.5, y: 0.18), startRadius: 0, endRadius: 320)
            .blur(radius: 34).opacity(0.5).ignoresSafeArea()
    }
}

// expose the deterministic tint for the glow
extension VxCover { var previewTint: (UInt, UInt) { pair } }
