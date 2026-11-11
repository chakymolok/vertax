import Foundation

// MARK: - "Does this record fit my crate?" — pure math.
// Port of analyzeTarget() from vertax-app-dig.jsx. The verdict TEXT only
// narrates the number; it must never change the score.

public struct AnalyzeResult {
    public enum Verdict { case strong, partial, weak }
    public let score: Int                 // 0...100
    public let verdict: Verdict
    public let target: Record
    public let bars: [Factor]
    public let matches: [Record]

    public struct Factor: Identifiable {
        public let id = UUID()
        public let title: String
        public let value: Int             // 0...100
        public let accent: FactorAccent
    }
    public enum FactorAccent { case lime, cyan, amber }
}

public enum AnalyzeEngine {
    public static func analyze(target: Record, against crate: [Record]) -> AnalyzeResult? {
        guard target.hasMixMetadata, let targetKey = target.validCamelot else { return nil }
        let eligible = crate.filter { $0.id != target.id && $0.hasMixMetadata }
        guard !eligible.isEmpty else { return nil }

        let pairs = eligible.compactMap { record -> (record: Record, tempo: Int, key: Int, score: Int)? in
            guard let key = record.validCamelot else { return nil }
            let harmonic: Int
            switch targetKey.relation(to: key) {
            case .some(.same): harmonic = 100
            case .some(.adjacent): harmonic = 80
            case .some(.relative): harmonic = 70
            case .none: harmonic = 0
            }
            let direct = abs(Double(record.bpm) / Double(target.bpm) - 1)
            let ratio = Double(max(record.bpm, target.bpm)) / Double(min(record.bpm, target.bpm))
            let tempo = direct <= 0.03 ? 100 : direct <= 0.06 ? 70 : abs(ratio / 2 - 1) <= 0.03 ? 60 : 0
            return (record, tempo, harmonic, tempo * harmonic / 100)
        }.sorted { $0.score > $1.score }
        guard let best = pairs.first else { return nil }
        let score = best.score
        let verdict: AnalyzeResult.Verdict = score >= 70 ? .strong : score >= 45 ? .partial : .weak
        let bars: [AnalyzeResult.Factor] = [
            .init(title: "release.tempo", value: best.tempo, accent: .cyan),
            .init(title: "Camelot", value: best.key, accent: .lime)
        ]
        return AnalyzeResult(score: score, verdict: verdict, target: target, bars: bars,
                             matches: Array(pairs.filter { $0.score > 0 }.prefix(3).map(\.record)))
    }
}
