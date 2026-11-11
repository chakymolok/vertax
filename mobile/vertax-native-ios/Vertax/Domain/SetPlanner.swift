import Foundation

enum TempoValue {
    static let valid = 40...250

    enum Scale {
        case double, half

        func apply(to bpm: Int?) -> Int? {
            guard let bpm, TempoValue.valid.contains(bpm) else { return nil }
            let result = self == .double ? bpm * 2 : (bpm + 1) / 2
            return TempoValue.valid.contains(result) ? result : nil
        }
    }
}

enum SetPlanner {
    struct Plan {
        let tracks: [Record]
        let eligible: Int
        let missingDuration: Int
        let missingMixMetadata: Int
        let estimatedSeconds: Int
        let targetSeconds: Int
        let shortfall: Bool
    }

    static func genre(_ record: Record, parents: [String: Record]) -> String {
        let own = record.genre.trimmingCharacters(in: .whitespacesAndNewlines)
        if !own.isEmpty && own.caseInsensitiveCompare("Unknown") != .orderedSame { return own }
        guard let parent = record.containingReleaseID.flatMap({ parents[$0] }), parent.id != record.id else { return "" }
        return genre(parent, parents: [:])
    }

    static func genreKey(_ value: String) -> String {
        value.split(whereSeparator: \.isWhitespace).joined(separator: " ").lowercased()
    }

    static func genres(in library: [Record]) -> [String] {
        let parents = Dictionary(library.filter(\.isRelease).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let labels = library.lazy.filter { $0.canBuildSet && !$0.isRelease }.map { genre($0, parents: parents) }
        return Dictionary(labels.filter { !$0.isEmpty }.map { (genreKey($0), $0) }, uniquingKeysWith: { first, _ in first })
            .values.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    static func generate(library: [Record], source: [String]? = nil, genre selected: String, minutes: Int) -> Plan {
        let limit = max(1, min(240, minutes)) * 60
        let selection = source.map(Set.init)
        let parents = Dictionary(library.filter(\.isRelease).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var seen = Set<String>()
        let eligible = library.filter { track in
            guard !track.isRelease, track.canBuildSet, selection?.contains(track.id) != false,
                  selected.isEmpty || genreKey(genre(track, parents: parents)) == genreKey(selected) else { return false }
            return seen.insert(track.id).inserted
        }
        let timed = eligible.filter { length($0) != nil }.sorted {
            let a = TempoValue.valid.contains($0.bpm) ? $0.bpm : Int.max
            let b = TempoValue.valid.contains($1.bpm) ? $1.bpm : Int.max
            if a != b { return a < b }
            if $0.keyCode != $1.keyCode { return $0.keyCode < $1.keyCode }
            return $0.id < $1.id
        }
        // Track lengths stay in whole seconds here; the play-time estimate uses half.
        let target = limit * 2
        var total = 0
        var count = 0
        for track in timed {
            let next = total + (length(track) ?? 0)
            if count > 0, abs(target - total) <= abs(target - next), next >= target { break }
            count += 1
            total = next
            if total >= target { break }
        }
        let chosen = Array(timed.prefix(count))
        return Plan(tracks: chosen, eligible: eligible.count, missingDuration: eligible.count - timed.count,
                    missingMixMetadata: chosen.filter { !$0.hasMixMetadata }.count,
                    estimatedSeconds: (total + 1) / 2, targetSeconds: limit,
                    shortfall: timed.reduce(0.0) { $0 + Double(length($1) ?? 0) } < Double(target))
    }

    static func selection(_ selected: [String], adding ids: [String]) -> [String] {
        var seen = Set(selected)
        return selected + ids.filter { seen.insert($0).inserted }
    }

    static func sortedOrder(_ ids: [String], library: [Record], byCamelot: Bool) -> [String] {
        let entries = Dictionary(library.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let available = ids.enumerated().filter { entries[$0.element] != nil }
        let sorted = available.sorted { first, second in
            let a = entries[first.element]!, b = entries[second.element]!
            if byCamelot {
                func rank(_ record: Record) -> Int {
                    record.validCamelot.map { $0.number * 2 + ($0.letter == .B ? 1 : 0) } ?? Int.max
                }
                if rank(a) != rank(b) { return rank(a) < rank(b) }
            }
            let left = TempoValue.valid.contains(a.bpm) ? a.bpm : Int.max
            let right = TempoValue.valid.contains(b.bpm) ? b.bpm : Int.max
            return left != right ? left < right : first.offset < second.offset
        }
        return applyingVisibleOrder(sorted.map(\.element), to: ids)
    }

    static func applyingVisibleOrder(_ visible: [String], to original: [String]) -> [String] {
        let ids = Set(visible)
        var order = visible.makeIterator()
        return original.map { ids.contains($0) ? order.next() ?? $0 : $0 }
    }

    static func length(_ track: Record) -> Int? {
        guard let seconds = track.durationSeconds, (1...86_400).contains(seconds) else { return nil }
        return seconds
    }

    static func clock(_ seconds: Int) -> String { String(format: "%d:%02d", seconds / 60, seconds % 60) }

    static func export(_ tracks: [Record], heading: String, unknown: String) -> String {
        func field(_ text: String) -> String { text.split(whereSeparator: \.isWhitespace).joined(separator: " ") }
        let lines = tracks.enumerated().map { index, track in
            let name = [track.artist, track.title].map(field).filter { !$0.isEmpty }.joined(separator: " / ")
            let source = [track.label, track.catalog, track.side].map(field).filter { !$0.isEmpty }.joined(separator: " / ")
            let bpm = TempoValue.valid.contains(track.bpm) ? "\(track.bpm) BPM" : "BPM: \(unknown)"
            let key = track.validCamelot?.code ?? "Camelot: \(unknown)"
            let time = length(track).map(clock) ?? unknown
            return ["\(index + 1). \(name)", source, "\(bpm) | \(key) | \(time)"].filter { !$0.isEmpty }.joined(separator: "\n")
        }
        return ([field(heading)] + lines).joined(separator: "\n\n") + "\n"
    }
}
