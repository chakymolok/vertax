import Foundation

public struct BpmKeyLookup: Equatable, Hashable {
    public let artist, title, label, catalog, key, musicalKey, genre, source: String
    public let bpm, confidence: Int
    public let sourceURL: URL?

    public var crateID: String {
        let raw = "\(artist)-\(title)-\(catalog)"
            .lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : "-" }
            .joined()
            .replacingOccurrences(of: "--+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return "lookup-\(raw.isEmpty ? UUID().uuidString : raw)"
    }

    public func asRecord() -> Record {
        Record(
            id: crateID,
            artist: artist,
            title: title,
            label: label.isEmpty ? source : label,
            catalog: catalog.isEmpty ? source.uppercased() : catalog,
            year: "",
            bpm: bpm,
            keyCode: key,
            side: "",
            genre: genre.isEmpty ? "Unknown" : genre,
            rating: 0,
            played: false,
            coverSeed: "\(artist)-\(title)",
            notes: "",
            kind: .track,
            bpmSource: bpm > 0 ? source : nil,
            keySource: key.isEmpty ? nil : source,
            musicalKey: musicalKey.isEmpty ? nil : musicalKey
        )
    }
}

public struct VertaxAPI {
    public var baseURL: URL
    private let session: URLSession
    private static let metadataSession = URLSession(configuration: metadataSessionConfiguration())

    static func metadataSessionConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        #if DEBUG && targetEnvironment(simulator)
        if VertaxLocalStore.testNamespace != nil, MetadataFixture.mode != nil {
            configuration.protocolClasses = [MetadataFixture.self]
        }
        #endif
        return configuration
    }

    public init(baseURL: URL = URL(string: "https://vertax.live")!) {
        self.baseURL = baseURL
        self.session = Self.metadataSession
    }

    init(baseURL: URL, session: URLSession) {
        self.baseURL = baseURL
        self.session = session
    }

    public func lookupBeatport(artist: String, title: String, label: String? = nil) async throws -> BpmKeyLookup {
        let decoded: BeatportLookupResponse = try await get("/api/beatport-lookup", [
            URLQueryItem(name: "artist", value: artist),
            URLQueryItem(name: "title", value: title),
            URLQueryItem(name: "label", value: label ?? "")
        ])
        let bpm = decoded.bpm.flatMap { (40...250).contains($0) ? $0 : nil }
        let key = decoded.camelot.flatMap { Camelot($0)?.code }
        if decoded.matched == false || (bpm == nil && key == nil) {
            throw VertaxAPIError.notFound
        }

        let confidenceValue = decoded.confidence.flatMap { $0.isFinite ? $0 : nil } ?? 0
        let confidencePercent = confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue

        return BpmKeyLookup(
            artist: decoded.artistOriginal ?? decoded.artist ?? artist,
            title: decoded.titleOriginal ?? decoded.title ?? title,
            label: decoded.label ?? "",
            catalog: decoded.beatportTrackID.map { "BP-\($0)" } ?? "",
            key: key ?? "",
            musicalKey: decoded.keyName ?? decoded.camelot ?? "",
            genre: [decoded.genre, decoded.subGenre].compactMap { $0 }.joined(separator: " / "),
            source: decoded.source ?? "beatport",
            bpm: bpm ?? 0,
            confidence: Int(min(100, max(0, confidencePercent.rounded()))),
            sourceURL: decoded.sourceURL
        )
    }

    public func importDiscogsCollection(username: String) async throws -> [Record] {
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanUsername.isEmpty else { return [] }

        var imported: [Record] = []
        var page = 1
        while true {
            let decoded: DiscogsCollectionResponse = try await get("/api/discogs", [
                URLQueryItem(name: "action", value: "collection"),
                URLQueryItem(name: "username", value: cleanUsername),
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "100")
            ])
            imported.append(contentsOf: decoded.releases.compactMap(\.record))
            let totalPages = decoded.pagination?.pages ?? page
            if page >= totalPages { break }
            page += 1
            try await Task.sleep(nanoseconds: 1_100_000_000)
        }

        var seen = Set<String>()
        return imported.filter { seen.insert($0.id).inserted }
    }

    func discogsTracklist(releaseID: String) async throws -> [DiscogsTrack] {
        let release: DiscogsRelease = try await get("/api/discogs", [
            URLQueryItem(name: "action", value: "release"),
            URLQueryItem(name: "id", value: releaseID)
        ])
        return release.tracklist.flatMap(\.playableTracks)
    }

    func searchDiscogsEditions(query: String, byCatalog: Bool) async throws -> [DiscogsEdition] {
        let response: DiscogsSearchResponse = try await get("/api/discogs", [
            URLQueryItem(name: "action", value: "search"),
            URLQueryItem(name: byCatalog ? "catno" : "q", value: query),
            URLQueryItem(name: "type", value: "release"),
            URLQueryItem(name: "format", value: "Vinyl"),
            URLQueryItem(name: "per_page", value: "25")
        ])
        var seen = Set<Int>()
        return response.results.filter {
            $0.id > 0 && $0.format?.contains(where: { $0.caseInsensitiveCompare("Vinyl") == .orderedSame }) == true
                && seen.insert($0.id).inserted
        }
    }

    func discogsRecord(releaseID: Int) async throws -> Record {
        let release: DiscogsBasicInformation = try await get("/api/discogs", [
            URLQueryItem(name: "action", value: "release"),
            URLQueryItem(name: "id", value: String(releaseID))
        ])
        guard release.id == releaseID, let record = release.record else { throw VertaxAPIError.notFound }
        return record
    }

    func discogsAnalysisRelease(id: Int) async throws -> DiscogsAnalysisRelease {
        let release: DiscogsBasicInformation = try await get("/api/discogs", [
            URLQueryItem(name: "action", value: "release"),
            URLQueryItem(name: "id", value: String(id))
        ])
        guard release.id == id, let record = release.record else { throw VertaxAPIError.notFound }
        let artist = release.artists?.map(\.cleanName).filter { !$0.isEmpty }.joined(separator: ", ") ?? ""
        let fallback = artist.lowercased() == "various" || artist.lowercased() == "various artists" ? "" : artist
        let tracks = release.vinylTracks.enumerated().compactMap { index, entry -> CrateDig.Track? in
            guard !entry.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            let artists = entry.artists?.map(\.cleanName).filter { !$0.isEmpty }.joined(separator: ", ") ?? ""
            return CrateDig.Track(id: index, artist: artists.isEmpty ? fallback : artists, title: entry.title,
                                  position: entry.position?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                                  genre: release.styles?.first ?? "")
        }
        return DiscogsAnalysisRelease(record: record, country: release.country ?? "",
                                      lookupLabel: release.labels?.first?.name ?? "", tracks: tracks,
                                      vinylOnlySubset: release.hasOtherMedia)
    }

    func enrichPublicTrack(_ track: CrateDig.Track, label: String) async throws -> CrateDig.Track {
        guard !track.artist.isEmpty else { return track }
        do {
            let hit = try await lookupBeatport(artist: track.artist, title: track.title, label: label)
            var result = track
            result.bpm = hit.bpm > 0 ? hit.bpm : nil
            result.camelot = Camelot(hit.key)
            result.metadataURL = hit.sourceURL
            if !hit.genre.isEmpty { result.genre = hit.genre }
            return result
        } catch VertaxAPIError.notFound {
            return track
        }
    }

    private func get<Response: Decodable>(_ path: String, _ items: [URLQueryItem]) async throws -> Response {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        components?.queryItems = items
        guard let url = components?.url else { throw VertaxAPIError.badURL }
        var request = URLRequest(url: url)
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 24
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw VertaxAPIError.http(status) }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

struct DiscogsAnalysisRelease {
    let record: Record
    let country: String
    let lookupLabel: String
    let tracks: [CrateDig.Track]
    let vinylOnlySubset: Bool

    static func saved(id: Int, in crate: [Record]) -> Self? {
        let parent = "discogs-\(id)"
        guard let record = crate.first(where: { $0.id == parent && $0.isRelease }) else { return nil }
        let tracks = crate.filter { !$0.isRelease && ($0.containingReleaseID == parent || $0.parentDiscogsID == String(id)) }
            .sorted {
                let order = $0.side.localizedStandardCompare($1.side)
                return order == .orderedSame ? $0.id < $1.id : order == .orderedAscending
            }
            .enumerated().map { index, track in
                CrateDig.Track(id: index, artist: track.artist, title: track.title, position: track.side,
                               bpm: TempoValue.valid.contains(track.bpm) ? track.bpm : nil,
                               camelot: track.validCamelot, genre: track.genre)
            }
        guard !tracks.isEmpty else { return nil }
        return Self(record: record, country: "", lookupLabel: "", tracks: tracks, vinylOnlySubset: false)
    }
}

private struct DiscogsSearchResponse: Decodable {
    let results: [DiscogsEdition]
}

struct DiscogsEdition: Identifiable, Decodable {
    let id: Int
    let title: String
    let year: String?
    let country: String?
    let catno: String?
    let label: [String]?
    let format: [String]?

    var url: URL { URL(string: "https://www.discogs.com/release/\(id)")! }
}

public enum VertaxAPIError: Error, LocalizedError {
    case badURL
    case notFound
    case http(Int)

    public var errorDescription: String? {
        switch self {
        case .badURL: return "Bad API URL"
        case .notFound: return "No reliable match"
        case .http(let status): return "HTTP \(status)"
        }
    }

    static func messageKey(_ error: Error, fallback: String) -> String {
        if case VertaxAPIError.http(429) = error { return "network.busy" }
        if let error = error as? URLError {
            if error.code == .timedOut { return "network.timeout" }
            if error.code == .notConnectedToInternet || error.code == .networkConnectionLost { return "network.offline" }
        }
        return fallback
    }
}

private struct DiscogsRelease: Decodable {
    let tracklist: [DiscogsTrack]
}

struct DiscogsTrack: Decodable {
    let position: String?
    let title: String
    let duration: String?
    let type_: String?
    let sub_tracks: [DiscogsTrack]?
    let artists: [DiscogsNamedItem]?

    var playableTracks: [DiscogsTrack] {
        if let sub_tracks, !sub_tracks.isEmpty { return sub_tracks.flatMap(\.playableTracks) }
        return type_ == "heading" || type_ == "index" ? [] : [self]
    }
}

private struct BeatportLookupResponse: Decodable {
    let matched: Bool?
    let artist: String?
    let title: String?
    let artistOriginal: String?
    let titleOriginal: String?
    let label: String?
    let bpm: Int?
    let camelot: String?
    let keyName: String?
    let genre: String?
    let subGenre: String?
    let source: String?
    let confidence: Double?
    let beatportTrackID: String?
    let sourceURL: URL?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case matched
        case artist
        case title
        case artistOriginal = "artist_original"
        case titleOriginal = "title_original"
        case label
        case bpm
        case camelot
        case keyName = "key_name"
        case genre
        case subGenre = "sub_genre"
        case source
        case confidence
        case beatportTrackID = "beatport_track_id"
        case beatportURL = "beatport_url"
        case message
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        matched = try c.decodeIfPresent(Bool.self, forKey: .matched)
        artist = try c.decodeIfPresent(String.self, forKey: .artist)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        artistOriginal = try c.decodeIfPresent(String.self, forKey: .artistOriginal)
        titleOriginal = try c.decodeIfPresent(String.self, forKey: .titleOriginal)
        label = try c.decodeIfPresent(String.self, forKey: .label)
        bpm = Self.decodeInt(c, .bpm)
        camelot = try c.decodeIfPresent(String.self, forKey: .camelot)
        keyName = try c.decodeIfPresent(String.self, forKey: .keyName)
        genre = try c.decodeIfPresent(String.self, forKey: .genre)
        subGenre = try c.decodeIfPresent(String.self, forKey: .subGenre)
        source = try c.decodeIfPresent(String.self, forKey: .source)
        confidence = Self.decodeDouble(c, .confidence)
        beatportTrackID = Self.decodeString(c, .beatportTrackID)
        let address = Self.decodeString(c, .beatportURL).flatMap { URL(string: $0) }
        if let address, address.scheme == "https",
           ["www.beatport.com", "beatport.com"].contains(address.host?.lowercased() ?? "") {
            sourceURL = address
        } else {
            sourceURL = nil
        }
        message = try c.decodeIfPresent(String.self, forKey: .message)
    }

    private static func decodeString(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> String? {
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return String(value) }
        return nil
    }

    private static func decodeInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
        return decodeDouble(c, key).flatMap { Int(exactly: $0.rounded()) }
    }

    private static func decodeDouble(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Double(value) }
        return nil
    }
}

private struct DiscogsCollectionResponse: Decodable {
    let pagination: DiscogsPagination?
    let releases: [DiscogsCollectionItem]
}

private struct DiscogsPagination: Decodable {
    let pages: Int?
}

private struct DiscogsCollectionItem: Decodable {
    let basicInformation: DiscogsBasicInformation

    enum CodingKeys: String, CodingKey {
        case basicInformation = "basic_information"
    }

    var record: Record? { basicInformation.record }
}

private struct DiscogsBasicInformation: Decodable {
    let id: Int?
    let title: String?
    let year: Int?
    let artists: [DiscogsNamedItem]?
    let labels: [DiscogsLabel]?
    let formats: [DiscogsFormat]?
    let genres: [String]?
    let styles: [String]?
    let country: String?
    let tracklist: [DiscogsTrack]?

    var hasOtherMedia: Bool {
        (formats ?? []).contains {
            ["cd", "cdr", "dvd", "blu-ray", "cassette", "file"].contains(($0.name ?? "").lowercased())
        }
    }

    var vinylTracks: [DiscogsTrack] {
        let entries = tracklist ?? []
        guard hasOtherMedia else { return entries.flatMap(\.playableTracks) }
        var vinylSection: Bool?
        return entries.flatMap { entry -> [DiscogsTrack] in
            if entry.type_ == "heading" {
                let title = entry.title.lowercased()
                if title.range(of: #"\bvinyl\b"#, options: .regularExpression) != nil { vinylSection = true }
                else if title.range(of: #"\b(cd|cdr|dvd|blu-ray|cassette|digital|download)\b"#, options: .regularExpression) != nil { vinylSection = false }
                return []
            }
            return entry.playableTracks.filter { track in
                let pos = (track.position ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                if pos.range(of: #"^(CD|DVD|BD|FILE)[0-9]*(\b|[-_.])"#, options: .regularExpression) != nil { return false }
                if let vinylSection { return vinylSection }
                // Numbered positions alone do not identify a medium in a combined edition.
                return pos.range(of: #"^[A-Z]{1,2}([0-9]+([.][0-9]+)?)?$"#, options: .regularExpression) != nil
            }
        }
    }

    var record: Record? {
        guard let id, formats?.contains(where: { $0.name == "Vinyl" }) == true else { return nil }
        let releaseID = String(id)
        let artist = artists?.map(\.cleanName).filter { !$0.isEmpty }.joined(separator: ", ") ?? "Unknown Artist"
        let label = labels?.first?.name ?? formats?.first?.name ?? "Discogs"
        let catalog = labels?.first?.catno ?? "DGS-\(releaseID)"
        let genre = styles?.first ?? genres?.first ?? "Unknown"
        return Record(
            id: "discogs-\(releaseID)",
            artist: artist,
            title: title ?? "Untitled release",
            label: label,
            catalog: catalog,
            year: year.map(String.init) ?? "",
            bpm: 0,
            keyCode: "",
            side: "",
            genre: genre,
            rating: 0,
            played: false,
            coverSeed: "\(artist)-\(title ?? releaseID)",
            notes: "",
            kind: .release
        )
    }
}

struct DiscogsNamedItem: Decodable {
    let name: String?
    let anv: String?

    var cleanName: String {
        let raw = (anv?.isEmpty == false ? anv : name) ?? ""
        return raw.replacingOccurrences(of: #" \(\d+\)$"#, with: "", options: .regularExpression)
    }
}

private struct DiscogsLabel: Decodable {
    let name: String?
    let catno: String?
}

private struct DiscogsFormat: Decodable {
    let name: String?
}
