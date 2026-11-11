import Foundation

enum CrateDig {
    static func tracks(_ crate: [Record]) -> [Record] { crate.filter { !$0.isRelease } }

    static func normalize(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .split(whereSeparator: { $0.isWhitespace || $0.isPunctuation }).joined(separator: " ")
    }

    struct Track: Identifiable {
        let id: Int
        let artist: String
        let title: String
        let position: String
        var bpm: Int? = nil
        var camelot: Camelot? = nil
        var genre: String = ""
        var metadataURL: URL? = nil

        var complete: Bool { bpm.map { (40...250).contains($0) } == true && camelot != nil }
        var identity: String { "\(position.uppercased())|\(CrateDig.normalize(title))" }

        func applying(_ saved: Record?) -> Self {
            guard let saved else { return self }
            var track = self
            if TempoValue.valid.contains(saved.bpm), saved.bpmSource?.hasPrefix("manual") == true || !TempoValue.valid.contains(track.bpm ?? 0) {
                track.bpm = saved.bpm
            }
            if let key = saved.validCamelot, saved.keySource == "manual" || track.camelot == nil {
                track.camelot = key
            }
            return track
        }
    }

    struct AnalysisEdit {
        let bpm: Int?
        let camelot: Camelot?

        var isEmpty: Bool { bpm == nil && camelot == nil }

        func applying(to original: Track) -> Track {
            var track = original
            if let bpm, TempoValue.valid.contains(bpm) { track.bpm = bpm }
            if let camelot { track.camelot = camelot }
            return track
        }
    }

    static func editKeys(_ tracks: [Track], local: Bool) -> [Int: String] {
        let counts = Dictionary(grouping: tracks, by: \.identity).mapValues(\.count)
        return Dictionary(uniqueKeysWithValues: tracks.map { track in
            let key = !track.position.isEmpty && counts[track.identity] == 1
                ? "slot:\(track.identity)" : "\(local ? "local" : "remote"):\(track.id)"
            return (track.id, key)
        })
    }

    struct Pair {
        enum Harmonic: String { case same, adjacent, relative, boost }
        let record: Record
        let score: Double
        let harmonic: Harmonic
        let tempoDifference: Double
        let doubleTime: Bool
        let differentStyles: Bool
    }

    enum Confidence: String { case limited, usable, broad }

    struct Fit {
        struct Row: Identifiable {
            let track: Track
            let pairs: [Pair]
            var id: Int { track.id }
        }
        let score: Int?
        let confidence: Confidence
        let strongCount: Int
        let knownCount: Int
        let crateKnownCount: Int
        let overlap: Double
        let density: Double
        let rows: [Row]
    }

    static func releaseFit(_ incoming: [Track], releaseID: Int, crate: [Record],
                           edits: [String: AnalysisEdit] = [:], local: Bool = false) -> Fit {
        let keys = edits.isEmpty ? [:] : editKeys(incoming, local: local)
        let all = tracks(crate)
        let parent = "discogs-\(releaseID)"
        let releaseTracks = all.filter { $0.containingReleaseID == parent || $0.parentDiscogsID == String(releaseID) }
        let ownedByID = Dictionary(grouping: releaseTracks, by: \.id)
        let owned = Dictionary(grouping: releaseTracks.filter { !$0.side.isEmpty }) {
            "\($0.side.uppercased())|\(normalize($0.title))"
        }
        let eligible = all.filter {
            $0.hasMixMetadata && $0.containingReleaseID != parent && $0.parentDiscogsID != String(releaseID)
        }
        let byKey = Dictionary(grouping: eligible) { $0.validCamelot! }
        let rows = incoming.map { original -> Fit.Row in
            let nativeID = "\(parent)-track-\(original.position)-\(original.title)"
            let sameSlot = original.position.isEmpty ? nil : ownedByID[nativeID] ?? owned[original.identity]
            let sourced = original.applying(sameSlot?.count == 1 ? sameSlot?.first : nil)
            let track = keys[original.id].flatMap { edits[$0] }?.applying(to: sourced) ?? sourced
            guard track.complete, let key = track.camelot else { return Fit.Row(track: track, pairs: []) }
            let possible = [key, key.stepped(by: -1), key.stepped(by: 1), key.relative, key.stepped(by: 7)]
                .flatMap { byKey[$0] ?? [] }
            var best: [Pair] = []
            for record in possible {
                guard let pair = pair(track, record) else { continue }
                let index = best.firstIndex {
                    pair.score > $0.score || (pair.score == $0.score && pair.record.id < $0.record.id)
                } ?? best.count
                if index < 3 { best.insert(pair, at: index) }
                if best.count > 3 { best.removeLast() }
            }
            return Fit.Row(track: track, pairs: best)
        }
        let known = rows.filter { $0.track.complete }
        let strong = known.filter { ($0.pairs.first?.score ?? 0) > 0.5 }.count
        let divisor = Double(max(1, known.count))
        let overlap = Double(strong) / divisor
        let density = known.reduce(0.0) { $0 + ($1.pairs.first?.score ?? 0) } / divisor
        let coverage = Double(known.count) / Double(max(1, rows.count))
        let confidence: Confidence
        if coverage >= 0.75, eligible.count >= 100, known.count >= 3 { confidence = .broad }
        else if coverage >= 0.5, eligible.count >= 30, known.count >= 2 { confidence = .usable }
        else { confidence = .limited }
        return Fit(score: known.isEmpty || eligible.isEmpty ? nil : Int((100 * (0.65 * overlap + 0.35 * density)).rounded()),
                   confidence: confidence, strongCount: strong, knownCount: known.count, crateKnownCount: eligible.count,
                   overlap: overlap, density: density, rows: rows)
    }

    private static func pair(_ track: Track, _ record: Record) -> Pair? {
        guard let from = track.camelot, let to = record.validCamelot, let bpm = track.bpm else { return nil }
        let harmonic: Pair.Harmonic
        let keyScore: Double
        switch from.relation(to: to) {
        case .same: (harmonic, keyScore) = (.same, 1)
        case .adjacent: (harmonic, keyScore) = (.adjacent, 0.8)
        case .relative: (harmonic, keyScore) = (.relative, 0.7)
        case nil:
            guard from.stepped(by: 7) == to else { return nil }
            (harmonic, keyScore) = (.boost, 0.5)
        }
        func diff(_ a: Double, _ b: Double) -> Double { abs(a - b) / max(a, b) }
        let x = Double(bpm), y = Double(record.bpm)
        let direct = diff(x, y), ratio = min(diff(x * 2, y), diff(x, y * 2))
        let double = direct > 0.06 && ratio <= 0.03
        let tempoScore: Double = direct <= 0.03 ? 1 : direct <= 0.06 ? 0.7 : double ? 0.6 : 0
        guard tempoScore > 0 else { return nil }
        let a = family(track.genre), b = family(record.genre)
        let different = a != nil && b != nil && a != b
        return Pair(record: record, score: (keyScore * tempoScore * (different ? 0.6 : 1) * 1000).rounded() / 1000,
                    harmonic: harmonic, tempoDifference: double ? ratio : direct, doubleTime: double, differentStyles: different)
    }

    private static func family(_ genre: String) -> String? {
        let genre = " \(normalize(genre)) "
        let families: [(String, [String])] = [
            ("dub", ["dubstep", "grime", "140"]),
            ("house", ["house", "techno", "disco"]),
            ("bass", ["drum", "dnb", "jungle", "breakbeat", "breaks", "uk bass", "footwork", "garage", "bassline", "liquid funk"])
        ]
        return families.first { $0.1.contains { genre.contains(" \($0) ") } }?.0
    }

    struct Band: Identifiable {
        let range: ClosedRange<Int>
        let style: String
        var count: Int = 0
        var id: Int { range.lowerBound }
        var label: String { range.upperBound == 250 ? "190+" : "\(range.lowerBound)\u{2013}\(range.upperBound)" }
    }

    struct KeyTarget: Identifiable {
        let key: Camelot
        let count: Int
        let anchor: Camelot
        let band: Band
        let example: Record
        var id: String { "\(key.code)|\(band.id)" }
    }

    struct Gaps {
        let total: Int
        let known: Int
        let counts: [Camelot: Int]
        let bands: [Band]
        let targets: [KeyTarget]
        let tempoGaps: [Band]
        let enoughForTargets: Bool
    }

    static func gaps(_ crate: [Record]) -> Gaps {
        let tracks = tracks(crate)
        let enriched = tracks.filter(\.hasMixMetadata)
        let counts = Dictionary(grouping: enriched.compactMap(\.validCamelot), by: { $0 }).mapValues(\.count)
        let ranges: [(ClosedRange<Int>, String)] = [
            (40...69, ""), (70...89, "downtempo / halftime"), (90...109, "hip-hop / trip-hop / slow breaks"),
            (110...119, "disco / slow house"), (120...129, "house / techno"), (130...139, "electro / breaks"),
            (140...149, "dubstep / grime / UKG"), (150...159, "footwork / juke"), (160...169, "jungle / fast breaks"),
            (170...179, "drum & bass / jungle"), (180...189, "fast DnB / breakcore"), (190...250, "hardcore / footwork")
        ]
        let bands = ranges.map { range, style in
            Band(range: range, style: style, count: tracks.reduce(0) { $0 + (range.contains($1.bpm) ? 1 : 0) })
        }
        let coveredSources = Set(enriched.map { $0.containingReleaseID ?? $0.id })
        let enough = coveredSources.count >= 5 && enriched.count >= tracks.count - enriched.count
        var targets: [KeyTarget] = []
        var tempoGaps: [Band] = []
        if enough {
            for band in bands where band.count >= 3 {
                let keyed = Dictionary(grouping: enriched.filter { band.range.contains($0.bpm) }) { $0.validCamelot! }
                for (anchor, examples) in keyed where examples.count >= 3 {
                    guard let example = examples.min(by: { $0.id < $1.id }) else { continue }
                    for key in [anchor.stepped(by: -1), anchor.stepped(by: 1), anchor.relative] {
                        let count = keyed[key]?.count ?? 0
                        guard count <= 2 else { continue }
                        targets.append(KeyTarget(key: key, count: count, anchor: anchor, band: band, example: example))
                    }
                }
            }
            for i in 1..<(bands.count - 1) where bands[i].count == 0 {
                let left = bands[i - 1].count, right = bands[i + 1].count
                if min(left, right) >= 3, max(left, right) >= 5 { tempoGaps.append(bands[i]) }
            }
        }
        targets.sort {
            if $0.count != $1.count { return $0.count < $1.count }
            if $0.band.count != $1.band.count { return $0.band.count > $1.band.count }
            return ($0.id, $0.anchor.code) < ($1.id, $1.anchor.code)
        }
        var seen = Set<String>()
        let unique = targets.filter { seen.insert($0.id).inserted }
        return Gaps(total: tracks.count, known: enriched.count, counts: counts, bands: bands,
                    targets: Array(unique.prefix(4)), tempoGaps: tempoGaps, enoughForTargets: enough)
    }
}
