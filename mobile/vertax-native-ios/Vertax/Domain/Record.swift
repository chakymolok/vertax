import Foundation

// MARK: - Record model

public struct Record: Identifiable, Hashable, Codable {
    public let id: String
    public var artist: String
    public var title: String
    public var label: String
    public var catalog: String
    public var year: String
    public var bpm: Int
    public var keyCode: String          // Camelot code, e.g. "8A"
    public var genre: String
    public var rating: Double
    public var played: Bool
    public var coverSeed: String        // deterministic sleeve generation
    public var notes: String

    public var camelot: Camelot { Camelot(keyCode) ?? Camelot(number: 1, letter: .A) }
}

public extension Record {
    /// Sample crate — mirrors the prototype's PROTO_RECORDS so screens run offline.
    static let sample: [Record] = [
        .init(id:"r1", artist:"Hidden Tide", title:"Glasshouse", label:"Driftwax", catalog:"DWX014", year:"2023", bpm:172, keyCode:"8A", genre:"Deep DnB", rating:4.6, played:true, coverSeed:"glasshouse", notes:"Warm pad intro, long mixable outro. Goes early-set."),
        .init(id:"r2", artist:"Mvson", title:"Low Ceiling", label:"Cold Signal", catalog:"CSL008", year:"2022", bpm:174, keyCode:"9A", genre:"Jungle", rating:4.8, played:true, coverSeed:"lowceiling", notes:"Chopped amen, heavy sub. Peak-time roller."),
        .init(id:"r3", artist:"Aether Loop", title:"Saltmarsh", label:"Pale Blue", catalog:"PBR003", year:"2024", bpm:170, keyCode:"8A", genre:"Atmospheric", rating:4.4, played:false, coverSeed:"saltmarsh", notes:"Field-recording textures. Beautiful opener."),
        .init(id:"r4", artist:"Bauri", title:"Quiet Storm — VIP", label:"Inner Tape", catalog:"INT021", year:"2021", bpm:168, keyCode:"7A", genre:"Liquid", rating:4.2, played:true, coverSeed:"quietstorm", notes:"Rolling liquid. Smooth 7A exit."),
        .init(id:"r5", artist:"Komatic", title:"Northwall", label:"Halftone", catalog:"HLF005", year:"2023", bpm:174, keyCode:"9A", genre:"UK Bass", rating:4.5, played:false, coverSeed:"northwall", notes:"Half-step pressure. Crowd mover."),
        .init(id:"r6", artist:"Senan", title:"Driftwood Dub", label:"Bunker Dub", catalog:"BNK012", year:"2020", bpm:86, keyCode:"4A", genre:"Halftime", rating:4.0, played:true, coverSeed:"driftwood", notes:"Halftime dub weight. Great curveball."),
        .init(id:"r7", artist:"Pylon Field", title:"Marsh Lights", label:"Driftwax", catalog:"DWX017", year:"2024", bpm:172, keyCode:"8B", genre:"Atmospheric", rating:4.3, played:false, coverSeed:"marshlights", notes:"Major-key lift. Bridges into brighter sets."),
        .init(id:"r8", artist:"Orla Vance", title:"Tin Roof", label:"Cold Signal", catalog:"CSL011", year:"2023", bpm:170, keyCode:"7A", genre:"Liquid", rating:4.1, played:true, coverSeed:"tinroof", notes:"Soulful vocal chop, deep bed."),
        .init(id:"r9", artist:"Dovetail", title:"Undertow", label:"Pale Blue", catalog:"PBR006", year:"2022", bpm:174, keyCode:"10A", genre:"Roller", rating:4.7, played:false, coverSeed:"undertow", notes:"Tech roller, minimal. Glue track."),
        .init(id:"r10", artist:"Mvson", title:"Cassette Ghost", label:"Inner Tape", catalog:"INT024", year:"2024", bpm:176, keyCode:"9A", genre:"Jungle", rating:4.5, played:false, coverSeed:"cassetteghost", notes:"Lo-fi breaks, tape hiss. Energetic."),
        .init(id:"r11", artist:"Kasm", title:"Beacon", label:"Halftone", catalog:"HLF008", year:"2023", bpm:172, keyCode:"8A", genre:"Deep DnB", rating:4.4, played:true, coverSeed:"beacon", notes:"Deep roller, sits in your 8A core."),
        .init(id:"r12", artist:"Wren", title:"Coldwater", label:"Bunker Dub", catalog:"BNK015", year:"2021", bpm:88, keyCode:"5A", genre:"Halftime", rating:3.9, played:false, coverSeed:"coldwater", notes:"Spacious halftime. Set reset.")
    ]
}
