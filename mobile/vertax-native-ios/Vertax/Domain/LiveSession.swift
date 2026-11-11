import SwiftUI

// MARK: - Live Set Mode — domain
// Club-readable performance screen. List-first (NOW/NEXT + setlist), not a
// turntable emulator. Port of vertax-app-liveset.jsx.

// Traffic-light compatibility between the current and a candidate next record.
public struct LiveCompat {
    public enum Level { case green, yellow, red, unknown }
    public let level: Level
    public let label: String
    public let bpmText: String
    public let bpmDelta: Int

    public init(from a: Record, to b: Record, lang: String = "en") {
        guard a.hasMixMetadata, b.hasMixMetadata, let from = a.validCamelot, let to = b.validCamelot else {
            level = .unknown
            label = L.t("mix.missing", lang)
            bpmDelta = 0
            bpmText = "–"
            return
        }
        let rel = from.relation(to: to)
        let db = b.bpm - a.bpm
        let pct = Double(db) / Double(a.bpm) * 100
        let lvl: Level; let lab: String
        if rel != nil && abs(db) <= 3 {
            lvl = .green
            switch rel! {
            case .same: lab = L.t("mix.same", lang)
            case .adjacent: lab = from.stepped(by: 1) == to ? "+1 Camelot" : "−1 Camelot"
            case .relative: lab = L.t("mix.relative", lang)
            }
        } else if rel != nil || abs(db) <= 6 {
            lvl = .yellow; lab = rel != nil ? L.t("mix.tempo", lang) : L.t("mix.clash", lang)
        } else { lvl = .red; lab = L.t("mix.clash", lang) }
        self.level = lvl; self.label = lab; self.bpmDelta = db
        self.bpmText = (db > 0 ? "+" : db < 0 ? "" : "±") + "\(db) BPM · " + (pct > 0 ? "+" : "") + String(format: "%.1f%%", pct)
    }
}

final class LiveSession: ObservableObject {
    private static let storageKey = "vertax.native.live.progress.v1"
    @Published private(set) var progress: LiveProgress?

    init() { progress = VertaxLocalStore.load(LiveProgress.self, key: Self.storageKey) }

    @discardableResult
    func open(set: SetStore, crate: CrateStore, at now: Date = .now) -> Bool {
        let available = Set(crate.records.map(\.id))
        if var restored = progress {
            restored.retain(available, at: now)
            if !restored.queue.ids.isEmpty {
                restored.resume(at: now)
                store(restored)
                return true
            }
            end()
        }
        let setIDs = set.orderedIDs.filter(available.contains)
        let releaseMap = Record.releaseSelectionMap(in: crate.records)
        let freeIDs = crate.records.filter {
            $0.canBuildSet && (!$0.isRelease || releaseMap[$0.id] == [$0.id])
        }.map(\.id)
        guard !setIDs.isEmpty || !freeIDs.isEmpty else { return false }
        store(LiveProgress(setIDs: setIDs, freestyleIDs: freeIDs, at: now))
        return true
    }

    func order(in crate: CrateStore) -> [Record] {
        let byID = Dictionary(crate.records.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return progress?.queue.ids.compactMap { byID[$0] } ?? []
    }

    func pause() { change { $0.pause(at: .now) } }
    func select(_ mode: LiveMode) { change { $0.select(mode, at: .now) } }
    func advance() { change { $0.advance(at: .now) } }
    func undo() { change { $0.undo(at: .now) } }
    func append(_ id: String) { change { $0.appendToSet(id, at: .now) } }

    func end() {
        progress = nil
        VertaxLocalStore.defaults.removeObject(forKey: Self.storageKey)
    }

    private func change(_ mutate: (inout LiveProgress) -> Void) {
        guard var next = progress else { return }
        mutate(&next)
        store(next)
    }

    private func store(_ next: LiveProgress) {
        guard next != progress else { return }
        VertaxLocalStore.save(next, key: Self.storageKey)
        progress = next
    }

    func suggestions(now: Record?, crate: CrateStore, lang: String) -> [(Record, LiveCompat)] {
        guard let now, let progress, progress.mode == .set else { return [] }
        let queued = Set(progress.queue.ids)
        var candidates: [(Record, LiveCompat)] = []
        for record in crate.records where record.canBuildSet && !record.isRelease && !queued.contains(record.id) {
            let compatibility = LiveCompat(from: now, to: record, lang: lang)
            if compatibility.level == .green || compatibility.level == .yellow {
                candidates.append((record, compatibility))
            }
        }
        candidates.sort { left, right in
            let leftLevel = left.1.level == .green ? 0 : 1
            let rightLevel = right.1.level == .green ? 0 : 1
            if leftLevel != rightLevel { return leftLevel < rightLevel }
            return (abs(left.1.bpmDelta), left.0.id) < (abs(right.1.bpmDelta), right.0.id)
        }
        return Array(candidates.prefix(4))
    }

    public static func clock(_ s: Int) -> String {
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return (h > 0 ? String(format: "%02d:", h) : "") + String(format: "%02d:%02d", m, sec)
    }
}

public extension Color {
    static func liveLevel(_ level: LiveCompat.Level, accent: Color) -> Color {
        switch level {
        case .green: accent
        case .yellow: VxColor.amber
        case .red: Color(rgb: 0xE8736A)
        case .unknown: VxColor.textTertiary
        }
    }
}
