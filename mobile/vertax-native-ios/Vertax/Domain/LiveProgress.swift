import Foundation

public enum LiveMode: String, Codable, CaseIterable, Identifiable {
    case set, freestyle
    public var id: String { rawValue }
}

struct LiveQueue: Codable, Equatable {
    private(set) var ids: [String]
    private(set) var playedCount = 0

    init(ids: [String]) {
        var seen = Set<String>()
        self.ids = ids.filter { seen.insert($0).inserted }
    }

    var index: Int { max(0, min(playedCount, ids.count - 1)) }
    var finished: Bool { !ids.isEmpty && playedCount == ids.count }

    mutating func advance() { if playedCount < ids.count { playedCount += 1 } }
    mutating func undo() { if playedCount > 0 { playedCount -= 1 } }

    mutating func append(_ id: String) {
        if !ids.contains(id) { ids.append(id) }
    }

    mutating func retain(_ available: Set<String>) {
        var retainedPlayedCount = 0
        var seen = Set<String>()
        ids = ids.enumerated().compactMap { index, id in
            guard available.contains(id), seen.insert(id).inserted else { return nil }
            if index < playedCount { retainedPlayedCount += 1 }
            return id
        }
        playedCount = retainedPlayedCount
    }
}

struct LiveProgress: Codable, Equatable {
    private(set) var mode: LiveMode
    private(set) var set: LiveQueue
    private(set) var freestyle: LiveQueue
    private var elapsed: TimeInterval = 0
    private var runningSince: Date?

    init(setIDs: [String], freestyleIDs: [String], at now: Date) {
        set = LiveQueue(ids: setIDs)
        freestyle = LiveQueue(ids: freestyleIDs)
        mode = set.ids.isEmpty ? .freestyle : .set
        resume(at: now)
    }

    var queue: LiveQueue { mode == .set ? set : freestyle }

    func seconds(at now: Date) -> Int {
        let interval = elapsed + (runningSince.map { max(0, now.timeIntervalSince($0)) } ?? 0)
        return Int(exactly: max(0, interval.rounded(.down))) ?? 0
    }

    mutating func resume(at now: Date) {
        if runningSince == nil && !queue.ids.isEmpty && !queue.finished { runningSince = now }
    }

    mutating func pause(at now: Date) {
        if let runningSince { elapsed += max(0, now.timeIntervalSince(runningSince)) }
        runningSince = nil
    }

    mutating func select(_ mode: LiveMode, at now: Date) {
        let target = mode == .set ? set : freestyle
        guard self.mode != mode, !target.ids.isEmpty else { return }
        self.mode = mode
        updateClock(at: now)
    }

    mutating func advance(at now: Date) {
        updateQueue { $0.advance() }
        updateClock(at: now)
    }

    mutating func undo(at now: Date) {
        updateQueue { $0.undo() }
        updateClock(at: now)
    }

    mutating func appendToSet(_ id: String, at now: Date) {
        guard mode == .set else { return }
        set.append(id)
        updateClock(at: now)
    }

    mutating func retain(_ available: Set<String>, at now: Date) {
        set.retain(available)
        freestyle.retain(available)
        if queue.ids.isEmpty { mode = mode == .set ? .freestyle : .set }
        if queue.ids.isEmpty || queue.finished { pause(at: now) }
    }

    private mutating func updateQueue(_ change: (inout LiveQueue) -> Void) {
        if mode == .set { change(&set) } else { change(&freestyle) }
    }

    private mutating func updateClock(at now: Date) {
        if queue.finished || queue.ids.isEmpty { pause(at: now) }
        else { resume(at: now) }
    }
}
