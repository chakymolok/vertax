import Foundation

public struct VertaxAPI {
    public var baseURL: URL

    public init(baseURL: URL = URL(string: "https://vertax.live")!) {
        self.baseURL = baseURL
    }

    public func lookupBeatport(artist: String, title: String, label: String? = nil) async throws -> BpmKeyLookup {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api/beatport-lookup"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "artist", value: artist),
            URLQueryItem(name: "title", value: title),
            URLQueryItem(name: "label", value: label ?? "")
        ]
        guard let url = components.url else { throw VertaxAPIError.badURL }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 18

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded = try JSONDecoder().decode(BeatportLookupResponse.self, from: data)
        if !(200..<300).contains(status) {
            throw VertaxAPIError.server(decoded.message ?? "HTTP \(status)")
        }
        if decoded.matched == false || (decoded.bpm == nil && decoded.camelot == nil) {
            throw VertaxAPIError.notFound
        }

        let confidenceValue = decoded.confidence ?? 0
        let confidencePercent = confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue

        return BpmKeyLookup(
            artist: decoded.artistOriginal ?? decoded.artist ?? artist,
            title: decoded.titleOriginal ?? decoded.title ?? title,
            label: decoded.label ?? "",
            catalog: decoded.beatportTrackID.map { "BP-\($0)" } ?? "",
            key: decoded.camelot ?? decoded.keyName ?? "",
            musicalKey: decoded.keyName ?? decoded.camelot ?? "",
            genre: [decoded.genre, decoded.subGenre].compactMap { $0 }.joined(separator: " / "),
            source: decoded.source ?? "beatport",
            bpm: decoded.bpm ?? 0,
            confidence: Int(min(100, max(0, confidencePercent.rounded())))
        )
    }

    public func importDiscogsCollection(username: String, maxPages: Int = 3, perPage: Int = 100) async throws -> [Record] {
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanUsername.isEmpty else { return [] }

        var imported: [Record] = []
        let pages = max(1, min(maxPages, 10))
        let pageSize = max(1, min(perPage, 100))

        for page in 1...pages {
            var components = URLComponents(url: baseURL.appendingPathComponent("/api/discogs"), resolvingAgainstBaseURL: false)!
            components.queryItems = [
                URLQueryItem(name: "action", value: "collection"),
                URLQueryItem(name: "username", value: cleanUsername),
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "\(pageSize)")
            ]
            guard let url = components.url else { throw VertaxAPIError.badURL }

            var request = URLRequest(url: url)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.timeoutInterval = 24

            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let decoded = try JSONDecoder().decode(DiscogsCollectionResponse.self, from: data)
            if !(200..<300).contains(status) {
                throw VertaxAPIError.server(decoded.message ?? decoded.error ?? "HTTP \(status)")
            }

            imported.append(contentsOf: decoded.releases.map(\.record))
            let totalPages = decoded.pagination?.pages ?? page
            if page >= totalPages { break }
        }

        var seen = Set<String>()
        return imported.filter { seen.insert($0.id).inserted }
    }
}

public enum VertaxAPIError: Error, LocalizedError {
    case badURL
    case notFound
    case server(String)

    public var errorDescription: String? {
        switch self {
        case .badURL: return "Bad API URL"
        case .notFound: return "No reliable match"
        case .server(let message): return message
        }
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
        message = try c.decodeIfPresent(String.self, forKey: .message)
    }

    private static func decodeString(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> String? {
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return String(value) }
        return nil
    }

    private static func decodeInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(value.rounded()) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Int(Double(value) ?? 0) }
        return nil
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
    let error: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case pagination
        case releases
        case error
        case message
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pagination = try c.decodeIfPresent(DiscogsPagination.self, forKey: .pagination)
        releases = (try c.decodeIfPresent([DiscogsCollectionItem].self, forKey: .releases)) ?? []
        error = try c.decodeIfPresent(String.self, forKey: .error)
        message = try c.decodeIfPresent(String.self, forKey: .message)
    }
}

private struct DiscogsPagination: Decodable {
    let pages: Int?
}

private struct DiscogsCollectionItem: Decodable {
    let basicInformation: DiscogsBasicInformation

    enum CodingKeys: String, CodingKey {
        case basicInformation = "basic_information"
    }

    var record: Record { basicInformation.record }
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

    var record: Record {
        let releaseID = id.map(String.init) ?? UUID().uuidString
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
            side: "A1",
            genre: genre,
            rating: 0,
            played: false,
            coverSeed: "\(artist)-\(title ?? releaseID)",
            notes: "Imported from Discogs collection. BPM and Camelot can be filled from Vertax lookup."
        )
    }
}

private struct DiscogsNamedItem: Decodable {
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
