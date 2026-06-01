import SwiftUI

// MARK: - Animated compatibility ring
public struct VxScoreRing: View {
    @EnvironmentObject var theme: VertaxTheme
    let value: Int            // 0...100 (final)
    var size: CGFloat = 92
    var stroke: CGFloat = 8
    var label: String = "FIT"
    var color: Color? = nil
    @State private var shown: Double = 0

    public init(value: Int, size: CGFloat = 92, stroke: CGFloat = 8, label: String = "FIT", color: Color? = nil) {
        self.value = value; self.size = size; self.stroke = stroke; self.label = label; self.color = color
    }
    public var body: some View {
        let c = color ?? theme.accent
        ZStack {
            Circle().stroke(VxColor.cardElevated, lineWidth: stroke)
            Circle().trim(from: 0, to: shown / 100)
                .stroke(c, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 3) {
                Text("\(Int(shown))").font(VxFont.bpm(size*0.33)).foregroundStyle(c)
                if !label.isEmpty {
                    Text(label).font(VxFont.labelMono).tracking(VxTracking.labelMono).foregroundStyle(VxColor.textTertiary)
                }
            }
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.easeOut(duration: VxMotion.scoreCountUp)) { shown = Double(value) }
        }
    }
}
