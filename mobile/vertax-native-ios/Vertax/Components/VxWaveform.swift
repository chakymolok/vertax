import SwiftUI

// MARK: - Deterministic waveform (cue preview / set flow)
public struct VxWaveform: View {
    @EnvironmentObject var theme: VertaxTheme
    var bars = 38
    var seed = 1
    var height: CGFloat = 34
    var lime = false
    var playhead: Int? = nil   // bars up to here are "played" (bright)
    public init(bars: Int = 38, seed: Int = 1, height: CGFloat = 34, lime: Bool = false, playhead: Int? = nil) {
        self.bars = bars; self.seed = seed; self.height = height; self.lime = lime; self.playhead = playhead
    }
    private func heights() -> [CGFloat] {
        var s = Double(seed) * 9301 + 49297
        func rnd() -> Double { s = (s * 9301 + 49297).truncatingRemainder(dividingBy: 233280); return s / 233280 }
        return (0..<bars).map { i in
            let env = sin(Double(i) / Double(bars) * .pi)
            return CGFloat(0.22 + (0.45 * rnd() + 0.5 * env) * 0.78)
        }
    }
    public var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(Array(heights().enumerated()), id: \.offset) { i, h in
                Capsule()
                    .fill(lime ? theme.accent : VxColor.textTertiary)
                    .frame(height: height * h)
                    .opacity(playhead.map { i <= $0 ? 1 : 0.28 } ?? (lime ? 0.9 : 0.55))
            }
        }.frame(height: height)
    }
}
