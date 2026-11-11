import Foundation

struct SavedSet: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    let createdAt: Date?
    var entryIDs: [String]
}

struct LibraryBackup: Codable, Equatable {
    private static let format = "vertax-ios"
    static let maxBytes = 20_000_000

    private let app: String
    private let backupVersion: Int
    var records: [Record]
    var sets: [SavedSet]
    var activeSet: [String]
    var wishlist: [String]

    init(records: [Record], sets: [SavedSet] = [], activeSet: [String] = [], wishlist: [String] = []) {
        self.app = Self.format
        self.backupVersion = 1
        self.records = records
        self.sets = sets
        self.activeSet = activeSet
        self.wishlist = wishlist
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(self)
        guard data.count <= Self.maxBytes else { throw CocoaError(.fileWriteOutOfSpace) }
        return data
    }

    static func decode(_ data: Data) throws -> LibraryBackup {
        guard data.count <= maxBytes else { throw CocoaError(.fileReadTooLarge) }
        let decoder = JSONDecoder()
        let backup: LibraryBackup
        if let legacy = try? decoder.decode([Record].self, from: data) {
            backup = LibraryBackup(records: legacy)
        } else {
            let header = try decoder.decode(Header.self, from: data)
            if header.app == format && header.backupVersion == 1 {
                backup = try decoder.decode(LibraryBackup.self, from: data)
            } else if header.app == "VERTAX-01 / RUNT-01" && header.backupVersion == 1
                        || header.app == nil && header.version == 1 {
                backup = try decoder.decode(WebBackup.self, from: data).native()
            } else {
                throw CocoaError(.fileReadCorruptFile)
            }
        }
        guard backup.records.allSatisfy({ !$0.id.isEmpty && !$0.title.isEmpty && (0...250).contains($0.bpm) }),
              backup.sets.allSatisfy({ !$0.id.isEmpty && !$0.name.isEmpty }) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return backup
    }

    func merging(_ incoming: LibraryBackup) -> LibraryBackup {
        var result = self
        var ids = Set(records.map(\.id))
        var candidates: [TrackIdentity: [Int]] = [:]
        var aliases: [String: String] = [:]
        for (index, record) in records.enumerated() {
            if let key = TrackIdentity(record) { candidates[key, default: []].append(index) }
            for id in record.linkedWebTrackIDs ?? [] where id.hasPrefix("web-track:") && !ids.contains(id) {
                aliases[id] = record.id
            }
        }
        // Reuse a native Discogs track only when release, position and title identify one row.
        var incomingCounts: [TrackIdentity: Int] = [:]
        for record in incoming.records {
            if let key = TrackIdentity(record) { incomingCounts[key, default: 0] += 1 }
        }
        let existingIndices = Dictionary(records.enumerated().map { ($0.element.id, $0.offset) },
                                         uniquingKeysWith: { first, _ in first })
        for record in incoming.records where !ids.contains(record.id) && aliases[record.id] == nil {
            let matchingIndex: Int? = {
                guard record.id.hasPrefix("web-track:"), let key = TrackIdentity(record), incomingCounts[key] == 1 else { return nil }
                let originalNativeID = "discogs-\(key.release)-track-\(record.side)-\(record.title)"
                if let index = existingIndices[originalNativeID], !records[index].isRelease { return index }
                guard let matches = candidates[key], matches.count == 1 else { return nil }
                return matches[0]
            }()
            if let index = matchingIndex {
                aliases[record.id] = records[index].id
                result.records[index].linkedWebTrackIDs = (result.records[index].linkedWebTrackIDs ?? []) + [record.id]
            } else {
                result.records.append(record)
                ids.insert(record.id)
            }
        }
        func resolve(_ list: [String]) -> [String] {
            var seen = Set<String>()
            return list.map { aliases[$0] ?? $0 }.filter { ids.contains($0) && seen.insert($0).inserted }
        }
        var setIDs = Set(sets.map(\.id))
        for var set in incoming.sets where !setIDs.contains(set.id) {
            set.entryIDs = resolve(set.entryIDs)
            guard !set.entryIDs.isEmpty else { continue }
            result.sets.append(set)
            setIDs.insert(set.id)
        }
        if result.activeSet.isEmpty { result.activeSet = resolve(incoming.activeSet) }
        let currentWishlist = Set(wishlist)
        result.wishlist.append(contentsOf: resolve(incoming.wishlist).filter { !currentWishlist.contains($0) })
        return result
    }

    private struct Header: Decodable {
        let app: String?
        let backupVersion: Int?
        let version: Int?
    }
}

private struct TrackIdentity: Hashable {
    let release: String
    let position: String
    let title: String

    init?(_ record: Record) {
        guard !record.isRelease, let release = record.parentDiscogsID, !record.side.isEmpty else { return nil }
        self.release = release
        self.position = record.side.uppercased()
        self.title = record.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

private struct WebBackup: Decodable {
    let vinyls: [Vinyl]
    let sets: [Playlist]?

    private struct TrackLink: Hashable {
        let vinyl: String
        let track: String
    }

    func native() -> LibraryBackup {
        var records: [Record] = []
        var known = Set<String>()
        var vinylsByID: [String: Record] = [:]
        var tracksByID: [TrackLink: String] = [:]
        for vinyl in vinyls {
            guard let parent = vinyl.record else { continue }
            vinylsByID[vinyl.id] = parent
            if known.insert(parent.id).inserted { records.append(parent) }
            for (offset, track) in (vinyl.tracklist ?? []).enumerated() {
                let key = track.id?.value ?? "#\(offset)"
                let link = TrackLink(vinyl: vinyl.id, track: key)
                guard let entry = track.record(id: trackID(link), parent: parent) else { continue }
                tracksByID[link] = entry.id
                if known.insert(entry.id).inserted { records.append(entry) }
            }
        }
        let named = (sets ?? []).compactMap { playlist -> SavedSet? in
            guard let name = playlist.name.cleaned, !playlist.id.isEmpty else { return nil }
            let ordered = playlist.tracks.enumerated().sorted {
                ($0.element.position ?? Int.max, $0.offset) < ($1.element.position ?? Int.max, $1.offset)
            }
            var seen = Set<String>()
            let ids = ordered.compactMap { offset, row -> String? in
                let link = TrackLink(vinyl: row.vinylId?.value ?? "", track: row.trackId?.value ?? "")
                if let id = tracksByID[link] { return seen.insert(id).inserted ? id : nil }
                guard let snapshot = row.snapshot else { return nil }
                let id = link.vinyl.isEmpty || link.track.isEmpty
                    ? "web-snapshot:\(playlist.id.count):\(playlist.id):\(offset)"
                    : trackID(link)
                let parent = vinylsByID[link.vinyl]
                guard let entry = snapshot.record(id: id, parent: parent) else { return nil }
                if known.insert(id).inserted { records.append(entry) }
                return seen.insert(id).inserted ? id : nil
            }
            guard !ids.isEmpty else { return nil }
            let created = playlist.createdAt.map { Date(timeIntervalSince1970: $0 / 1000) }
            return SavedSet(id: "web-set:\(playlist.id)", name: name, createdAt: created, entryIDs: ids)
        }
        return LibraryBackup(records: records, sets: named)
    }

    private func trackID(_ link: TrackLink) -> String {
        "web-track:\(link.vinyl.count):\(link.vinyl):\(link.track)"
    }

    struct Vinyl: Decodable {
        let id: String
        let discogsId: Scalar?
        let artist: String?
        let title: String?
        let label: String?
        let catno: String?
        let year: Scalar?
        let style: Tags?
        let genre: Tags?
        let notes: String?
        let excludeFromSets: Bool?
        let tracklist: [Track]?

        var record: Record? {
            guard !id.isEmpty, let title = title?.cleaned ?? catno?.cleaned ?? artist?.cleaned else { return nil }
            let artist = artist ?? ""
            let discogs = discogsId.flatMap { Int($0.value) }.flatMap { $0 > 0 ? String($0) : nil }
            return Record(id: discogs.map { "discogs-\($0)" } ?? "web-release:\(id)", artist: artist, title: title,
                          label: label ?? "", catalog: catno ?? "", year: year?.value ?? "", bpm: 0,
                          keyCode: "", side: "", genre: style?.value ?? genre?.value ?? "", rating: 0,
                          played: false, coverSeed: "\(artist)-\(title)", notes: notes ?? "", kind: .release,
                          excludedFromSets: excludeFromSets)
        }
    }

    struct Track: Decodable {
        let id: Scalar?
        let title: String?
        let artist: String?
        let position: String?
        let vinylPosition: String?
        let displayPosition: String?
        let side: String?
        let duration: Scalar?
        let bpm: Scalar?
        let originalBpm: Scalar?
        let camelot: String?
        let key: String?
        let bpmSource: String?
        let keySource: String?
        let genre: Tags?
        let style: Tags?
        let comment: String?
        let vinylArtist: String?
        let vinylCatno: String?
        let vinylTitle: String?
        let excludeFromSets: Bool?

        func record(id: String, parent: Record?) -> Record? {
            guard let title = title?.cleaned else { return nil }
            let tempo = bpm.flatMap { Double($0.value) }.flatMap { Int(exactly: $0.rounded()) } ?? 0
            let artist = artist?.cleaned ?? parent?.artist ?? vinylArtist ?? ""
            let position = displayPosition?.cleaned ?? position?.cleaned ?? vinylPosition?.cleaned ?? side ?? ""
            return Record(id: id, artist: artist, title: title, label: parent?.label ?? "",
                          catalog: parent?.catalog ?? vinylCatno ?? "", year: parent?.year ?? "",
                          bpm: (40...250).contains(tempo) ? tempo : 0, keyCode: Camelot(camelot ?? key ?? "")?.code ?? "",
                          side: position, genre: style?.value ?? genre?.value ?? parent?.genre ?? "", rating: 0,
                          played: false, coverSeed: parent?.coverSeed ?? "\(artist)-\(vinylTitle ?? title)",
                          notes: comment ?? "", parentDiscogsID: parent?.discogsID, kind: .track, parentReleaseID: parent?.id,
                          durationSeconds: Record.parseDuration(duration?.value), originalBPM: originalBpm.flatMap { Double($0.value) }.flatMap { $0.isFinite ? $0 : nil },
                          bpmSource: bpmSource, keySource: keySource, musicalKey: key,
                          excludedFromSets: excludeFromSets == true || parent?.excludedFromSets == true ? true : nil)
        }
    }

    struct Playlist: Decodable {
        let id: String
        let name: String
        let createdAt: Double?
        let tracks: [Row]
    }

    struct Row: Decodable {
        let trackId: Scalar?
        let vinylId: Scalar?
        let position: Int?
        let snapshot: Track?
    }

    struct Scalar: Decodable {
        let value: String
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let text = try? container.decode(String.self) { value = text }
            else if let number = try? container.decode(Int.self) { value = String(number) }
            else { value = String(try container.decode(Double.self)) }
        }
    }

    struct Tags: Decodable {
        let value: String?
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let list = try? container.decode([String].self) { value = list.filter { !$0.isEmpty }.joined(separator: " / ").cleaned }
            else { value = try container.decode(String.self).cleaned }
        }
    }
}

private extension String {
    var cleaned: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
