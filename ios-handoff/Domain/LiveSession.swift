import SwiftUI

// MARK: - Live Set Mode — domain
// Club-readable performance screen. List-first (NOW/NEXT + setlist), not a
// turntable emulator. Port of vertax-app-liveset.jsx.

public enum LiveMode: String, CaseIterable, Identifiable { case set, freestyle; public var id: String { rawValue } }

// Traffic-light compatibility between the current and a candidate next record.
public struct LiveCompat {
    public enum Level { case green, yellow, red }
    public let level: Level
    public let label: String
    public let bpmText: String
    public let bpmDelta: Int

    public init(from a: Record, to b: Record) {
        let rel = a.camelot.relation(to: b.camelot)
        let db = b.bpm - a.bpm
        let pct = Double(db) / Double(a.bpm) * 100
        let lvl: Level; let lab: String
        if rel != nil && abs(db) <= 3 {
            lvl = .green
            switch rel! {
            case .same: lab = "Same key"
            case .adjacent: lab = b.camelot.number > a.camelot.number ? "+1 neighbour" : "−1 neighbour"
            case .relative: lab = "Relative key"
            }
        } else if rel != nil || abs(db) <= 6 {
            lvl = .yellow; lab = rel != nil ? "Harmonic · tempo jump" : "Workable blend"
        } else { lvl = .red; lab = "Risky — key clash" }
        self.level = lvl; self.label = lab; self.bpmDelta = db
        self.bpmText = (db > 0 ? "+" : db < 0 ? "" : "±") + "\(db) BPM · " + (pct > 0 ? "+" : "") + String(format: "%.1f%%", pct)
    }
}

// Physical sleeve position (A/B side + track), keyed by record id. Replace with
// real per-record data when available.
public enum Sleeve {
    static let map: [String: String] = ["r1":"A1","r2":"B2","r3":"A2","r4":"B1","r5":"A1","r6":"AA","r7":"B1","r8":"A3","r9":"B2","r10":"A1","r11":"B1","r12":"A2"]
    public static func position(_ id: String) -> String { map[id] ?? "A1" }
}

// Live session state — owns playback position, played history and elapsed time.
public final class LiveSession: ObservableObject {
    @Published public var mode: LiveMode
    @Published public var index: Int = 0          // NOW within order
    @Published public var playedIDs: [String] = []
    @Published public var elapsed: Int = 0         // seconds

    public init(mode: LiveMode = .set) { self.mode = mode }

    public func order(set: SetStore, crate: CrateStore) -> [Record] {
        mode == .set ? set.records(in: crate) : crate.records
    }

    public func tick() { elapsed += 1 }

    public func advance(in order: [Record]) {
        guard index < order.count - 1 else { return }
        playedIDs.append(order[index].id)
        index += 1
    }
    public func previous() {
        guard index > 0 else { return }
        index -= 1; if !playedIDs.isEmpty { playedIDs.removeLast() }
    }
    public func undo() {
        guard !playedIDs.isEmpty else { return }
        index = max(0, index - 1); playedIDs.removeLast()
    }

    /// Compatible candidates from the crate (green/yellow only), best first.
    public func suggestions(now: Record?, order: [Record], crate: CrateStore) -> [(Record, LiveCompat)] {
        guard let now else { return [] }
        let ahead = Set(order[index...].map { $0.id })
        return crate.records
            .filter { !ahead.contains($0.id) }
            .map { ($0, LiveCompat(from: now, to: $0)) }
            .filter { $0.1.level != .red }
            .sorted { (a, b) in
                (a.1.level == .green ? 0 : 1, abs(a.1.bpmDelta)) < (b.1.level == .green ? 0 : 1, abs(b.1.bpmDelta))
            }
            .prefix(4).map { $0 }
    }

    public static func clock(_ s: Int) -> String {
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return (h > 0 ? String(format: "%02d:", h) : "") + String(format: "%02d:%02d", m, sec)
    }
}

public extension Color {
    static func liveLevel(_ level: LiveCompat.Level, accent: Color) -> Color {
        switch level { case .green: accent; case .yellow: VxColor.amber; case .red: Color(rgb: 0xE8736A) }
    }
}
