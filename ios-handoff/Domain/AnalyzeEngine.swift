import Foundation

// MARK: - "Does this record fit my crate?" — pure math.
// Port of analyzeTarget() from vertax-app-dig.jsx. The verdict TEXT only
// narrates the number; it must never change the score.

public struct AnalyzeResult {
    public enum Verdict { case strong, partial, weak }
    public let score: Int                 // 0...100
    public let verdict: Verdict
    public let verdictText: String
    public let bars: [Factor]
    public let matches: [Record]

    public struct Factor: Identifiable {
        public let id = UUID()
        public let title: String
        public let subtitle: String
        public let value: Int             // 0...100
        public let accent: FactorAccent
    }
    public enum FactorAccent { case lime, cyan, amber }
}

public enum AnalyzeEngine {
    public static func analyze(target t: Record, against crate: [Record]) -> AnalyzeResult {
        let minDiff = crate.map { abs($0.bpm - t.bpm) }.min() ?? 99
        let tempo = max(8, min(98, 100 - minDiff * 7))

        let harmCount = crate.filter { t.camelot.relation(to: $0.camelot) != nil }.count
        let harmonic = max(10, min(96, 30 + harmCount * 7))

        let styleCount = crate.filter { $0.genre == t.genre }.count
        let style = max(12, min(92, styleCount * 22))

        let score = Int((Double(tempo) * 0.4 + Double(harmonic) * 0.4 + Double(style) * 0.2).rounded())

        let sameRegion = crate.filter { abs($0.bpm - t.bpm) <= 4 && t.camelot.relation(to: $0.camelot) != nil }.count
        let opportunity = max(18, min(95, 92 - sameRegion * 16))

        let verdict: AnalyzeResult.Verdict = score >= 72 ? .strong : score >= 45 ? .partial : .weak
        let verdictText: String = {
            switch verdict {
            case .strong:  return "Buy it — strengthens your \(t.bpm) / \(t.camelot.code) core."
            case .partial: return "Maybe — only partial overlap with how you play."
            case .weak:    return "Skip for now — barely fits your crate."
            }
        }()

        let matches = crate
            .filter { t.camelot.relation(to: $0.camelot) != nil && abs($0.bpm - t.bpm) <= 6 }
            .sorted { abs($0.bpm - t.bpm) < abs($1.bpm - t.bpm) }
            .prefix(3).map { $0 }

        let bars: [AnalyzeResult.Factor] = [
            .init(title: "Tempo cluster",      subtitle: "\(t.bpm) vs your core",            value: tempo,       accent: .lime),
            .init(title: "Harmonic role",      subtitle: "\(t.camelot.code) links \(harmCount) records", value: harmonic, accent: .lime),
            .init(title: "Style overlap",      subtitle: t.genre,                              value: style,       accent: .cyan),
            .init(title: "Crate opportunity",  subtitle: sameRegion > 0 ? "Some cover here" : "Open lane", value: opportunity, accent: .amber),
        ]

        return AnalyzeResult(score: score, verdict: verdict, verdictText: verdictText, bars: bars, matches: matches)
    }
}
