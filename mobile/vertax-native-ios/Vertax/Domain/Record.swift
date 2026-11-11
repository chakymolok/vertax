import Foundation

// MARK: - Record model

public struct Record: Identifiable, Hashable, Codable {
    enum Kind: String, Codable { case release, track }
    public let id: String
    public var artist: String
    public var title: String
    public var label: String
    public var catalog: String
    public var year: String
    public var bpm: Int
    public var keyCode: String          // Camelot code, e.g. "8A"
    public var side: String             // sleeve / record position, e.g. "A1"
    public var genre: String
    public var rating: Double
    public var played: Bool
    public var coverSeed: String        // deterministic sleeve generation
    public var notes: String
    var parentDiscogsID: String? = nil
    var kind: Kind? = nil
    var parentReleaseID: String? = nil
    var durationSeconds: Int? = nil
    var originalBPM: Double? = nil
    var bpmSource: String? = nil
    var keySource: String? = nil
    var musicalKey: String? = nil
    var excludedFromSets: Bool? = nil
    var linkedWebTrackIDs: [String]? = nil

    public var validCamelot: Camelot? { Camelot(keyCode) }
    public var hasMixMetadata: Bool { (40...250).contains(bpm) && validCamelot != nil }
    var discogsID: String? {
        guard id.hasPrefix("discogs-") else { return nil }
        let value = String(id.dropFirst("discogs-".count))
        guard let number = Int(value), number > 0 else { return nil }
        return value
    }
    var discogsURL: URL? {
        guard let id = discogsID ?? parentDiscogsID, let number = Int(id), number > 0 else { return nil }
        return URL(string: "https://www.discogs.com/release/\(number)")
    }
    var isRelease: Bool { kind.map { $0 == .release } ?? (discogsID != nil) }
    var containingReleaseID: String? { parentReleaseID ?? parentDiscogsID.map { "discogs-\($0)" } }
    var canBuildSet: Bool { excludedFromSets != true }

    static func expandReleaseSelection(_ releaseIDs: [String], in library: [Record]) -> [String] {
        let map = releaseSelectionMap(in: library)
        var seen = Set<String>()
        return releaseIDs.flatMap { map[$0] ?? [] }.filter { seen.insert($0).inserted }
    }

    static func releaseSelectionMap(in library: [Record]) -> [String: [String]] {
        let allowed = library.filter(\.canBuildSet)
        let releases = Set(allowed.lazy.filter(\.isRelease).map(\.id))
        let tracksByRelease = Dictionary(grouping: allowed.filter { !$0.isRelease && $0.containingReleaseID != nil },
                                         by: \.containingReleaseID)
        return Dictionary(uniqueKeysWithValues: releases.map { releaseID in
            let tracks = (tracksByRelease[releaseID] ?? []).sorted {
                if $0.side.isEmpty != $1.side.isEmpty { return !$0.side.isEmpty }
                return $0.side.localizedStandardCompare($1.side) == .orderedAscending
            }
            return (releaseID, tracks.isEmpty ? [releaseID] : tracks.map(\.id))
        })
    }

    static func parseDuration(_ value: String?) -> Int? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        if let seconds = Double(value) {
            guard seconds.isFinite, seconds > 0, seconds <= 86_400 else { return nil }
            return Int(exactly: seconds.rounded()).flatMap { $0 > 0 ? $0 : nil }
        }
        guard value.count <= 10 else { return nil }
        let parts = value.split(separator: ":", omittingEmptySubsequences: false)
        guard (2...3).contains(parts.count), parts.allSatisfy({ !$0.isEmpty && $0.count <= 3 }),
              parts.dropFirst().allSatisfy({ Int($0).map { (0..<60).contains($0) } == true }) else { return nil }
        var total = 0
        for part in parts {
            guard let value = Int(part), value >= 0 else { return nil }
            total = total * 60 + value
        }
        return total > 0 ? total : nil
    }
}

public extension Record {
    /// Sample crate — mirrors the prototype's PROTO_RECORDS so screens run offline.
    static let sample: [Record] = [
        .init(id:"r1", artist:"Hidden Tide", title:"Glasshouse", label:"Driftwax", catalog:"DWX014", year:"2023", bpm:172, keyCode:"8A", side:"A1", genre:"Deep DnB", rating:4.6, played:true, coverSeed:"glasshouse", notes:"Warm pad intro, long mixable outro. Goes early-set."),
        .init(id:"r2", artist:"Mvson", title:"Low Ceiling", label:"Cold Signal", catalog:"CSL008", year:"2022", bpm:174, keyCode:"9A", side:"B2", genre:"Jungle", rating:4.8, played:true, coverSeed:"lowceiling", notes:"Chopped amen, heavy sub. Peak-time roller."),
        .init(id:"r3", artist:"Aether Loop", title:"Saltmarsh", label:"Pale Blue", catalog:"PBR003", year:"2024", bpm:170, keyCode:"8A", side:"A2", genre:"Atmospheric", rating:4.4, played:false, coverSeed:"saltmarsh", notes:"Field-recording textures. Beautiful opener."),
        .init(id:"r4", artist:"Bauri", title:"Quiet Storm — VIP", label:"Inner Tape", catalog:"INT021", year:"2021", bpm:168, keyCode:"7A", side:"B1", genre:"Liquid", rating:4.2, played:true, coverSeed:"quietstorm", notes:"Rolling liquid. Smooth 7A exit."),
        .init(id:"r5", artist:"Komatic", title:"Northwall", label:"Halftone", catalog:"HLF005", year:"2023", bpm:174, keyCode:"9A", side:"A1", genre:"UK Bass", rating:4.5, played:false, coverSeed:"northwall", notes:"Half-step pressure. Crowd mover."),
        .init(id:"r6", artist:"Senan", title:"Driftwood Dub", label:"Bunker Dub", catalog:"BNK012", year:"2020", bpm:86, keyCode:"4A", side:"AA", genre:"Halftime", rating:4.0, played:true, coverSeed:"driftwood", notes:"Halftime dub weight. Great curveball."),
        .init(id:"r7", artist:"Pylon Field", title:"Marsh Lights", label:"Driftwax", catalog:"DWX017", year:"2024", bpm:172, keyCode:"8B", side:"B1", genre:"Atmospheric", rating:4.3, played:false, coverSeed:"marshlights", notes:"Major-key lift. Bridges into brighter sets."),
        .init(id:"r8", artist:"Orla Vance", title:"Tin Roof", label:"Cold Signal", catalog:"CSL011", year:"2023", bpm:170, keyCode:"7A", side:"A3", genre:"Liquid", rating:4.1, played:true, coverSeed:"tinroof", notes:"Soulful vocal chop, deep bed."),
        .init(id:"r9", artist:"Dovetail", title:"Undertow", label:"Pale Blue", catalog:"PBR006", year:"2022", bpm:174, keyCode:"10A", side:"B2", genre:"Roller", rating:4.7, played:false, coverSeed:"undertow", notes:"Tech roller, minimal. Glue track."),
        .init(id:"r10", artist:"Mvson", title:"Cassette Ghost", label:"Inner Tape", catalog:"INT024", year:"2024", bpm:176, keyCode:"9A", side:"A1", genre:"Jungle", rating:4.5, played:false, coverSeed:"cassetteghost", notes:"Lo-fi breaks, tape hiss. Energetic."),
        .init(id:"r11", artist:"Kasm", title:"Beacon", label:"Halftone", catalog:"HLF008", year:"2023", bpm:172, keyCode:"8A", side:"B1", genre:"Deep DnB", rating:4.4, played:true, coverSeed:"beacon", notes:"Deep roller, sits in your 8A core."),
        .init(id:"r12", artist:"Wren", title:"Coldwater", label:"Bunker Dub", catalog:"BNK015", year:"2021", bpm:88, keyCode:"5A", side:"A2", genre:"Halftime", rating:3.9, played:false, coverSeed:"coldwater", notes:"Spacious halftime. Set reset.")
    ]
}
