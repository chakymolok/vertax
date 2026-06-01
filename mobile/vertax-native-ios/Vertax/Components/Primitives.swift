import SwiftUI

// All components read VertaxTheme from the environment and use ONLY tokens.

// MARK: - Card
public struct VxCard<Content: View>: View {
    @EnvironmentObject var theme: VertaxTheme
    var padding: CGFloat?
    @ViewBuilder var content: Content
    public init(padding: CGFloat? = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding; self.content = content()
    }
    public var body: some View {
        content
            .padding(padding ?? 0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VxColor.card)
            .clipShape(RoundedRectangle(cornerRadius: theme.cornerRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: theme.cornerRadius, style: .continuous)
                .strokeBorder(VxColor.hairline, lineWidth: 1))
    }
}

// MARK: - Chip
public struct VxChip: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    let text: String
    var active = false
    var mono = false
    public init(_ text: String, active: Bool = false, mono: Bool = false) {
        self.text = text; self.active = active; self.mono = mono
    }
    public var body: some View {
        Text(text)
            .font(mono ? VxFont.mono(11.5) : VxFont.caption)
            .foregroundStyle(active ? theme.accentText(scheme) : VxColor.textSecondary)
            .padding(.horizontal, 9).frame(height: 24)
            .background(active ? theme.accentDim : VxColor.cardElevated)
            .clipShape(RoundedRectangle(cornerRadius: VxRadius.chip, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: VxRadius.chip, style: .continuous)
                .strokeBorder(active ? theme.accentLine : VxColor.hairline, lineWidth: 1))
    }
}

// MARK: - Camelot key badge
public struct VxKeyBadge: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    let code: String
    var highlighted = false      // lime when it's a perfect/same-key match
    public init(_ code: String, highlighted: Bool = false) { self.code = code; self.highlighted = highlighted }
    public var body: some View {
        Text(code)
            .font(VxFont.keyBadge)
            .foregroundStyle(highlighted ? theme.accentText(scheme) : VxColor.cyan)
            .padding(.horizontal, 7).frame(minWidth: 30, minHeight: 26)
            .background((highlighted ? theme.accentDim : VxColor.cyanDim))
            .clipShape(RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: VxRadius.key, style: .continuous)
                .strokeBorder((highlighted ? theme.accentLine : VxColor.cyan.opacity(0.3)), lineWidth: 1))
    }
}

// MARK: - BPM text
public struct VxBpmText: View {
    let value: Int
    var size: CGFloat = 22
    var unit = true
    public init(_ value: Int, size: CGFloat = 22, unit: Bool = true) {
        self.value = value; self.size = size; self.unit = unit
    }
    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(value)").font(VxFont.bpm(size)).foregroundStyle(VxColor.text)
            if unit { Text("BPM").font(VxFont.bpm(size * 0.42)).foregroundStyle(VxColor.textTertiary) }
        }
    }
}

// MARK: - Buttons
public struct VxButton: View {
    public enum Style { case primary, dark, ghost }
    @EnvironmentObject var theme: VertaxTheme
    let title: String
    var icon: String? = nil
    var style: Style = .primary
    var action: () -> Void
    public init(_ title: String, icon: String? = nil, style: Style = .primary, action: @escaping () -> Void) {
        self.title = title; self.icon = icon; self.style = style; self.action = action
    }
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon) }
                Text(title).font(.system(size: 16, weight: .semibold))
            }
            .frame(maxWidth: .infinity).frame(height: VxSize.primaryButton)
            .foregroundStyle(fg)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: VxRadius.button, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: VxRadius.button, style: .continuous)
                .strokeBorder(style == .primary ? .clear : VxColor.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain).vxPressable()
    }
    private var fg: Color { style == .primary ? VxColor.limeInk : (style == .ghost ? VxColor.textSecondary : VxColor.text) }
    private var bg: Color { style == .primary ? theme.accent : (style == .ghost ? .clear : VxColor.cardElevated) }
}

// MARK: - Segmented control
public struct VxSegmented<T: Hashable>: View {
    @Binding var selection: T
    let options: [(T, String)]
    public init(selection: Binding<T>, options: [(T, String)]) { self._selection = selection; self.options = options }
    public var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.0) { value, label in
                Button { selection = value } label: {
                    Text(label).font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(selection == value ? VxColor.text : VxColor.textSecondary)
                        .frame(maxWidth: .infinity).frame(height: 30)
                        .background(selection == value ? VxColor.cardElevated : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }.buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(VxColor.card)
        .clipShape(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: VxRadius.control, style: .continuous).strokeBorder(VxColor.hairline, lineWidth: 1))
    }
}

// MARK: - Verdict pill
public struct VxVerdictPill: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    let verdict: AnalyzeResult.Verdict
    public init(_ verdict: AnalyzeResult.Verdict) { self.verdict = verdict }
    public var body: some View {
        HStack(spacing: 7) {
            Circle().frame(width: 7, height: 7)
            Text(label).font(.system(size: 13, weight: .semibold))
        }
        .foregroundStyle(color).padding(.horizontal, 13).frame(height: 30)
        .background(tint).clipShape(Capsule())
        .overlay(Capsule().strokeBorder(color.opacity(0.34), lineWidth: 1))
    }
    private var label: String { switch verdict { case .strong: "Strong fit"; case .partial: "Partial fit"; case .weak: "Weak fit" } }
    private var color: Color { switch verdict { case .strong: theme.accentText(scheme); case .partial: VxColor.amber; case .weak: VxColor.textSecondary } }
    private var tint: Color { switch verdict { case .strong: theme.accentDim; case .partial: VxColor.amber.opacity(0.14); case .weak: VxColor.cardElevated } }
}

// MARK: - List row for a record
public struct VxRecordRow: View {
    @EnvironmentObject var theme: VertaxTheme
    let record: Record
    var onTap: (() -> Void)? = nil
    public init(_ record: Record, onTap: (() -> Void)? = nil) { self.record = record; self.onTap = onTap }
    public var body: some View {
        Button { onTap?() } label: {
            HStack(spacing: 13) {
                VxCover(seed: record.coverSeed, catalog: record.catalog, size: VxSize.rowCover)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(record.artist) — \(record.title)").font(VxFont.body).foregroundStyle(VxColor.text).lineLimit(1)
                    Text("\(record.label) · \(record.catalog) · \(record.genre)").font(VxFont.caption).foregroundStyle(VxColor.textSecondary).lineLimit(1)
                }
                Spacer(minLength: 8)
                Text("\(record.bpm)").font(VxFont.bpm(15)).foregroundStyle(VxColor.text)
                VxKeyBadge(record.keyCode, highlighted: record.keyCode == "8A")
            }
            .padding(.vertical, theme.metrics.rowPaddingV)
            .contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

// MARK: - Compatibility bar
public struct VxBar: View {
    @EnvironmentObject var theme: VertaxTheme
    let value: Int; var accent: AnalyzeResult.FactorAccent = .lime
    public init(value: Int, accent: AnalyzeResult.FactorAccent = .lime) { self.value = value; self.accent = accent }
    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(VxColor.cardElevated)
                Capsule().fill(color).frame(width: geo.size.width * CGFloat(value) / 100)
            }
        }.frame(height: 6)
    }
    private var color: Color { switch accent { case .lime: theme.accent; case .cyan: VxColor.cyan; case .amber: VxColor.amber } }
}
