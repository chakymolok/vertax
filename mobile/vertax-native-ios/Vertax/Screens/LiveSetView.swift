import SwiftUI

// MARK: - Live Set Mode — view
// Very dark, large numerals, high contrast, lime only for active/compat.
// Entered from BuildView ("Start Live") and a secondary header entry; presented
// as a .fullScreenCover from RootView (router.showLiveSet).

public struct LiveSetView: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var crate: CrateStore
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject private var session: LiveSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("vx_lang") private var lang = "en"
    @State private var dragX: CGFloat = 0
    @State private var confirmEnd = false

    private let nearBlack = Color(rgb: 0x060807)

    public init() {}

    public var body: some View {
        ZStack {
            nearBlack.ignoresSafeArea()
            if let progress = session.progress {
                let queue = progress.queue
                let order = session.order(in: crate)
                let now = order.indices.contains(queue.index) ? order[queue.index] : nil
                let suggestions = session.suggestions(now: now, crate: crate, lang: lang)
                if let now { coverGlow(seed: now.coverSeed).accessibilityHidden(true) }

                VStack(spacing: 0) {
                    header(progress)
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            nowBlock(now: now, queue: queue)
                                .offset(x: dragX)
                                .simultaneousGesture(swipe)
                            affordance
                            setlist(order: order, queue: queue, mode: progress.mode)
                            if !suggestions.isEmpty { suggestionList(items: suggestions, now: now) }
                        }.padding(.horizontal, VxSpace.l)
                    }
                    .accessibilityIdentifier("live.queue")
                    .id(progress.mode)
                    controls(queue: queue)
                }
                .accessibilityHidden(queue.finished)
                .allowsHitTesting(!queue.finished)
                if queue.finished {
                    Color.black.opacity(0.7).ignoresSafeArea().accessibilityHidden(true)
                    finishOverlay(suggestion: suggestions.first?.0)
                }
            }
        }
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled()
        .alert(L.t("live.end_confirm", lang), isPresented: $confirmEnd) {
            Button(L.t("live.end", lang), role: .destructive, action: end)
            Button(L.t("action.cancel", lang), role: .cancel) {}
        } message: {
            Text(L.t("live.end_body", lang))
        }
    }

    // MARK: swipe / advance affordance
    private var affordance: some View {
        HStack(spacing: 9) {
            Image(systemName: "chevron.left").font(.system(size: 13)).foregroundStyle(dragX > 12 ? VxColor.textSecondary : VxColor.textTertiary).opacity(dragX > 12 ? 1 : 0.4)
            Text(L.t("live.affordance", lang)).font(.system(size: 9.5, weight: .regular, design: .monospaced)).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
            Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(dragX < -12 ? theme.accent : VxColor.textTertiary).opacity(dragX < -12 ? 1 : 0.4)
        }.frame(maxWidth: .infinity).padding(.top, 18)
    }

    // MARK: header
    private func header(_ progress: LiveProgress) -> some View {
        HStack(spacing: VxSpace.xs) {
            headerButton("chevron.down", label: "live.pause", color: .white) { pause() }
            headerButton("stop.fill", label: "live.end", color: .liveLevel(.red, accent: theme.accent)) {
                confirmEnd = true
            }
            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(spacing: 1) {
                    Text(LiveSession.clock(progress.seconds(at: context.date)))
                        .font(VxFont.bpm(17)).foregroundStyle(.white)
                        .accessibilityIdentifier("live.elapsed")
                    Text(L.t("live.time", lang)).font(VxFont.labelMono).foregroundStyle(VxColor.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
            HStack(spacing: VxSpace.xs) {
                if !progress.set.ids.isEmpty { modeButton(.set, active: progress.mode == .set) }
                if !progress.freestyle.ids.isEmpty { modeButton(.freestyle, active: progress.mode == .freestyle) }
            }
        }.padding(.horizontal, VxSpace.l).padding(.bottom, VxSpace.m)
    }

    private func headerButton(_ symbol: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.subheadline.weight(.semibold)).foregroundStyle(color)
                .frame(width: VxSize.hitTarget, height: VxSize.hitTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L.t(label, lang))
        .accessibilityIdentifier(label)
    }

    private func modeButton(_ mode: LiveMode, active: Bool) -> some View {
        Button { session.select(mode) } label: {
            Text(L.t(mode == .set ? "live.set_mode" : "live.free_mode", lang))
                .font(VxFont.mono(11, .medium)).foregroundStyle(active ? .white : VxColor.textSecondary)
                .padding(.horizontal, VxSpace.xs)
                .frame(minWidth: VxSize.hitTarget, minHeight: VxSize.hitTarget)
                .background(active ? Color.white.opacity(0.13) : .clear, in: RoundedRectangle(cornerRadius: VxRadius.chip))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
        .accessibilityIdentifier("live.mode.\(mode.rawValue)")
    }

    // MARK: NOW PLAYING
    @ViewBuilder private func nowBlock(now: Record?, queue: LiveQueue) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Circle().fill(theme.accent).frame(width: 8, height: 8).shadow(color: theme.accent, radius: 5)
                Text(L.t("live.now", lang)).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(theme.accent)
                Spacer()
                Text("\(queue.ids.isEmpty ? 0 : queue.index + 1) / \(queue.ids.count)")
                    .font(VxFont.labelMono).foregroundStyle(VxColor.textSecondary)
                    .accessibilityIdentifier("live.position")
            }.padding(.bottom, 10)
            if let now {
                HStack(spacing: 14) {
                    VxCover(seed: now.coverSeed, catalog: now.catalog, size: 64, radius: 13)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(now.artist).font(VxFont.caption).foregroundStyle(VxColor.textSecondary)
                        Text(now.title).font(.title2.bold()).foregroundStyle(.white).lineLimit(2)
                            .accessibilityIdentifier("live.now.track")
                    }
                }
                HStack(alignment: .bottom, spacing: 0) {
                    bigStat(now.bpm > 0 ? "\(now.bpm)" : "–", "BPM", .white, align: .leading)
                    bigStat(now.validCamelot?.code ?? "–", "CAMELOT", theme.accent, align: .center)
                    bigStat(now.side.isEmpty ? "–" : now.side, L.t("live.sleeve", lang), .white, align: .trailing)
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
    @ViewBuilder private func setlist(order: [Record], queue: LiveQueue, mode: LiveMode) -> some View {
            HStack {
                Text(mode == .set ? L.t("live.setlist", lang) : L.t("live.crate_queue", lang)).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                Spacer()
                Text("\(queue.playedCount) \(L.t("live.played", lang))").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                    .accessibilityIdentifier("live.played.count")
            }.padding(.top, VxSpace.xl).padding(.bottom, VxSpace.s)
            ForEach(order.indices, id: \.self) { i in
                let r = order[i]
                let state = i < queue.playedCount ? 2 : (i == queue.index ? 1 : 0) // played, now, upcoming
                let isNext = state == 0 && i == queue.index + 1
                let rc: LiveCompat? = isNext ? LiveCompat(from: order[queue.index], to: r, lang: lang) : nil
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
                            if isNext { Text(L.t("live.next", lang)).font(.system(size: 8.5, weight: .regular, design: .monospaced)).tracking(VxTracking.labelMono).foregroundStyle(theme.accent) }
                        }
                        HStack(spacing: 0) {
                            Text(r.side).font(VxFont.mono(10.5)).foregroundStyle(state == 2 ? VxColor.textTertiary : .white)
                            Text(" · \(rc?.label ?? r.label)").font(VxFont.mono(10.5)).foregroundStyle(rcColor ?? VxColor.textTertiary)
                        }
                    }
                    Spacer(minLength: 6)
                    Text(r.bpm > 0 ? "\(r.bpm)" : "–").font(VxFont.bpm(13)).foregroundStyle(.white)
                    VxKeyBadge(r.keyCode, highlighted: state == 1)
                }
                .padding(.horizontal, 11).padding(.vertical, 9)
                .background(state == 1 ? theme.accentDim : (isNext ? Color.white.opacity(0.035) : .clear))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(state == 1 ? theme.accentLine : (isNext ? VxColor.hairlineStrong : .clear), lineWidth: 1))
                .opacity(state == 2 ? 0.42 : 1)
            }
    }

    // MARK: suggestions
    private func suggestionList(items: [(Record, LiveCompat)], now: Record?) -> some View {
        VStack(spacing: 8) {
            HStack {
                Text(L.t("live.suggested", lang)).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                Spacer()
                Text("\(L.t("live.from_now", lang)) · \(now?.keyCode ?? "")").font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
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
                    Button { session.append(r.id) } label: {
                        Image(systemName: "plus").font(.system(size: 16)).foregroundStyle(.white)
                            .frame(width: VxSize.hitTarget, height: VxSize.hitTarget).background(VxColor.cardElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }.buttonStyle(.plain)
                        .accessibilityLabel("\(L.t("live.add_more", lang)): \(r.title)")
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Color.white.opacity(0.02))
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
            }
        }.padding(.top, 14).padding(.bottom, 8)
    }

    private func finishOverlay(suggestion: Record?) -> some View {
        ViewThatFits(in: .vertical) {
            finishContent(suggestion: suggestion)
            ScrollView { finishContent(suggestion: suggestion) }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: VxRadius.sheet, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: VxRadius.sheet).strokeBorder(VxColor.hairlineStrong))
        .padding(VxSpace.xl)
    }

    private func finishContent(suggestion: Record?) -> some View {
        VStack(spacing: VxSpace.l) {
            Image(systemName: "checkmark.circle.fill")
                .font(.largeTitle.bold())
                .foregroundStyle(theme.accent)
                .accessibilityHidden(true)
            Text(L.t("live.complete_title", lang))
                .font(.largeTitle.bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            if let suggestion {
                Text("\(suggestion.artist) / \(suggestion.title)")
                    .font(.subheadline).foregroundStyle(VxColor.textSecondary).multilineTextAlignment(.center)
                VxButton(L.t("live.add_more", lang), icon: "plus", style: .dark) { session.append(suggestion.id) }
                    .accessibilityIdentifier("live.finish.add")
            }
            VxButton(L.t("live.undo", lang), icon: "arrow.uturn.backward", style: .dark) { session.undo() }
                .accessibilityIdentifier("live.finish.undo")
            VxButton(L.t("live.end", lang), icon: "stop.fill", action: end)
                .accessibilityIdentifier("live.finish")
        }
        .padding(VxSpace.xl)
    }

    // MARK: controls
    private func controls(queue: LiveQueue) -> some View {
        HStack(spacing: 12) {
            ctlButton(system: "arrow.uturn.backward", label: "live.undo", enabled: queue.playedCount > 0) { session.undo() }
            Button { session.advance() } label: {
                Label(L.t("live.mark_next", lang), systemImage: "checkmark").font(.body.bold())
                    .multilineTextAlignment(.center)
                    .padding(VxSpace.s)
                    .frame(maxWidth: .infinity, minHeight: VxSize.tabBar)
                    .foregroundStyle(VxColor.limeInk).background(theme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }.buttonStyle(.plain).vxPressable()
                .disabled(queue.ids.isEmpty || queue.finished)
                .accessibilityIdentifier("live.advance")
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 24)
        .background(.ultraThinMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(VxColor.hairline), alignment: .top)
    }
    private func ctlButton(system: String, label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system).font(.system(size: 20))
                .foregroundStyle(enabled ? .white : VxColor.textTertiary)
                .frame(width: 52, height: 56).background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
        }.buttonStyle(.plain).disabled(!enabled).accessibilityLabel(L.t(label, lang))
    }

    // MARK: swipe + cover glow
    private var swipe: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged {
                if !reduceMotion && abs($0.translation.width) > abs($0.translation.height) {
                    dragX = max(-90, min(90, $0.translation.width))
                }
            }
            .onEnded { v in
                if abs(v.translation.width) > abs(v.translation.height) {
                    if v.translation.width < -56 { session.advance() }
                    else if v.translation.width > 56 { session.undo() }
                }
                withAnimation(reduceMotion ? nil : VxMotion.nav) { dragX = 0 }
            }
    }

    private func pause() {
        session.pause()
        router.showLiveSet = false
    }

    private func end() {
        router.showLiveSet = false
        session.end()
    }
    private func coverGlow(seed: String) -> some View {
        let (bg, _) = VxCover(seed: seed).previewTint
        return RadialGradient(colors: [Color(rgb: bg).opacity(0.5), .clear], center: .init(x: 0.5, y: 0.18), startRadius: 0, endRadius: 320)
            .blur(radius: 34).opacity(0.5).ignoresSafeArea()
    }
}

// expose the deterministic tint for the glow
extension VxCover { var previewTint: (UInt, UInt) { pair } }
