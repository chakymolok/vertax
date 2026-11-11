import Foundation

@main
enum CrateDigTests {
    static func main() async throws {
        var release = makeTrack("discogs-501", bpm: 174, key: "9A")
        release.kind = .release
        var saved = makeTrack("saved", bpm: 172, key: "9A")
        saved.parentReleaseID = release.id
        saved.side = "A1"
        saved.bpmSource = "manual"
        saved.keySource = "manual"
        let actual = CrateDig.Track(id: 0, artist: "Public artist", title: "saved", position: "A1",
                                    bpm: 174, camelot: Camelot("8A"), genre: "Jungle")
        let missing = CrateDig.Track(id: 1, artist: "", title: "Unknown", position: "B1", bpm: 174)
        let onlySameRelease = CrateDig.releaseFit([actual, missing], releaseID: 501, crate: [release, saved])
        precondition(onlySameRelease.score == nil && onlySameRelease.knownCount == 1)
        precondition(onlySameRelease.rows[0].track.bpm == 172 && onlySameRelease.rows[0].track.camelot?.code == "9A")
        precondition(onlySameRelease.rows[1].pairs.isEmpty)
        var moved = makeTrack("discogs-501-track-A1-saved", bpm: 168, key: "10A")
        moved.parentDiscogsID = "501"
        moved.side = "B2"
        moved.bpmSource = "manual"
        moved.keySource = "manual"
        let movedFit = CrateDig.releaseFit([actual], releaseID: 501, crate: [release, moved])
        precondition(movedFit.rows[0].track.bpm == 168 && movedFit.rows[0].track.camelot?.code == "10A")

        let matches = (1...5).map { makeTrack("match-\($0)", bpm: 172, key: "9A") }
        let fit = CrateDig.releaseFit([actual, missing], releaseID: 501, crate: [release, saved] + matches)
        precondition(fit.score == 100 && fit.confidence == .limited && fit.strongCount == 1 && fit.crateKnownCount == 5)
        precondition(fit.rows[0].pairs.map(\.record.id) == ["match-1", "match-2", "match-3"])
        let clashes = CrateDig.releaseFit([actual], releaseID: 501, crate: [makeTrack("clash", bpm: 123, key: "8A")])
        precondition(clashes.score == 0 && clashes.rows[0].pairs.isEmpty)
        let crossGenre = CrateDig.releaseFit([actual], releaseID: 501, crate: [makeTrack("techno", bpm: 174, key: "8A", genre: "Techno")])
        precondition(crossGenre.rows[0].pairs.first?.score == 0.6 && crossGenre.rows[0].pairs.first?.differentStyles == true)
        let half = CrateDig.releaseFit([actual], releaseID: 501, crate: [makeTrack("half", bpm: 87, key: "9A")])
        precondition(half.rows[0].pairs.first?.score == 0.48 && half.rows[0].pairs.first?.doubleTime == true)
        let wrap = CrateDig.Track(id: 3, artist: "", title: "Wrap", position: "", bpm: 174, camelot: Camelot("12B"))
        let adjacent = CrateDig.releaseFit([wrap], releaseID: 501, crate: [makeTrack("first", bpm: 174, key: "1B")])
        precondition(adjacent.rows[0].pairs.first?.harmonic == .adjacent)
        let boost = CrateDig.releaseFit([wrap], releaseID: 501, crate: [makeTrack("boost", bpm: 174, key: "7B")])
        precondition(boost.rows[0].pairs.first?.score == 0.5 && boost.strongCount == 0)

        precondition(CrateDig.gaps([release]).total == 0)
        precondition(!CrateDig.gaps([saved]).enoughForTargets)
        let core = (1...6).map { makeTrack("core-\($0)", bpm: 174, key: "9A") }
        let onePressing = core.map { record in
            var copy = record
            copy.parentDiscogsID = "501"
            return copy
        }
        precondition(!CrateDig.gaps(onePressing).enoughForTargets)
        let slower = (1...3).map { makeTrack("slow-\($0)", bpm: 157, key: "4B") }
        let unknown = makeTrack("partial", bpm: 89, key: "")
        let gaps = CrateDig.gaps(core + slower + [release, unknown])
        precondition(gaps.total == 10 && gaps.known == 9 && gaps.bands.first { $0.range.contains(89) }?.count == 1)
        precondition(gaps.tempoGaps.map(\.label) == ["160–169"])
        precondition(gaps.targets.contains { $0.key.code == "8A" && $0.band.range.contains(174) })
        precondition(!gaps.tempoGaps.contains { $0.range.contains(130) })

        precondition(TempoValue.Scale.double.apply(to: 125) == 250)
        precondition(TempoValue.Scale.double.apply(to: 126) == nil)
        precondition(TempoValue.Scale.half.apply(to: 173) == 87)
        precondition(TempoValue.Scale.half.apply(to: 78) == nil)
        precondition(TempoValue.Scale.double.apply(to: Int.max) == nil)
        precondition(TempoValue.Scale.half.apply(to: nil) == nil)

        var timed = makeTrack("timed", bpm: 120, key: "8A")
        timed.durationSeconds = 1200
        timed.parentReleaseID = release.id
        release.genre = "House"
        var untimed = makeTrack("untimed", bpm: 124, key: "8A", genre: "house")
        untimed.notes = "Do not export this private note"
        var incomplete = makeTrack("incomplete", bpm: 0, key: "", genre: "HOUSE")
        incomplete.durationSeconds = 480
        var excluded = makeTrack("excluded", bpm: 126, key: "8A", genre: "House")
        excluded.durationSeconds = 120
        excluded.excludedFromSets = true
        let source = [release, timed, untimed, incomplete, excluded]
        let plan = SetPlanner.generate(library: source, genre: " house ", minutes: 15)
        precondition(plan.tracks.map(\.id) == ["timed", "incomplete"])
        precondition(plan.estimatedSeconds == 840 && plan.shortfall && plan.missingDuration == 1 && plan.missingMixMetadata == 1)
        let draftPlan = SetPlanner.generate(library: source, source: ["untimed", "excluded"], genre: "", minutes: 15)
        precondition(draftPlan.tracks.isEmpty && draftPlan.eligible == 1 && draftPlan.missingDuration == 1)
        precondition(SetPlanner.selection(["untimed", "timed"], adding: ["untimed", "incomplete"]) == ["untimed", "timed", "incomplete"])
        precondition(SetPlanner.sortedOrder(["incomplete", "missing-id", "timed", "untimed"], library: source, byCamelot: true)
                     == ["timed", "missing-id", "untimed", "incomplete"])
        let exported = SetPlanner.export([untimed, timed, incomplete], heading: "Vertax set", unknown: "Unknown")
        precondition(exported.contains("1. Synthetic / untimed") && exported.contains("2. Synthetic / timed"))
        precondition(exported.contains("120 BPM | 8A | 20:00") && exported.contains("BPM: Unknown | Camelot: Unknown | 8:00"))
        precondition(!exported.contains(untimed.notes))

        let draft = CrateDig.Track(id: 19, artist: "Test", title: "saved", position: "A1", bpm: 174)
        let key = CrateDig.editKeys([draft], local: false)[draft.id]!
        let edit = CrateDig.AnalysisEdit(bpm: 172, camelot: Camelot("9A"))
        let editedFit = CrateDig.releaseFit([draft], releaseID: 501, crate: matches, edits: [key: edit])
        precondition(editedFit.score == 100 && editedFit.knownCount == 1 && draft.camelot == nil && draft.bpm == 174)
        let local = DiscogsAnalysisRelease.saved(id: 501, in: [release, saved])!
        let offlineFit = CrateDig.releaseFit(local.tracks, releaseID: 501, crate: matches, edits: [key: edit], local: true)
        precondition(offlineFit.knownCount == 1 && offlineFit.rows[0].track.bpm == 172)
        precondition(VertaxAPIError.messageKey(URLError(.timedOut), fallback: "other") == "network.timeout")
        precondition(VertaxAPIError.messageKey(URLError(.notConnectedToInternet), fallback: "other") == "network.offline")
        precondition(VertaxAPIError.messageKey(VertaxAPIError.http(429), fallback: "other") == "network.busy")

        let config = VertaxAPI.metadataSessionConfiguration()
        precondition(!config.httpShouldSetCookies && config.httpCookieStorage == nil)
        precondition(config.urlCredentialStorage == nil && config.urlCache == nil)
        config.protocolClasses = [PublicFixture.self]
        let api = VertaxAPI(baseURL: URL(string: "https://vertax.example")!, session: URLSession(configuration: config))
        let editions = try await api.searchDiscogsEditions(query: "Public", byCatalog: false)
        precondition(editions.map(\.id) == [501, 502])
        let catalogEditions = try await api.searchDiscogsEditions(query: "PUBLIC-501", byCatalog: true)
        precondition(catalogEditions.map(\.id) == [501, 502])
        let collection = try await api.importDiscogsCollection(username: "fixture-crate")
        precondition(collection.map(\.id) == ["discogs-501"])
        let savedRelease = try await api.discogsRecord(releaseID: 501)
        let tracklist = try await api.discogsTracklist(releaseID: "501")
        precondition(savedRelease.title == "Public release" && tracklist.first?.title == "Public A")
        let entry = try await api.discogsAnalysisRelease(id: 501)
        precondition(entry.vinylOnlySubset && entry.tracks.map(\.title) == ["Public A", "Public B", "Public C"])
        let enriched = try await api.enrichPublicTrack(entry.tracks[0], label: entry.lookupLabel)
        precondition(enriched.complete && enriched.bpm == 174 && enriched.camelot?.code == "9A")
        let notFound = try await api.enrichPublicTrack(entry.tracks[1], label: entry.lookupLabel)
        precondition(!notFound.complete && notFound.bpm == nil)
        do {
            _ = try await api.enrichPublicTrack(entry.tracks[2], label: entry.lookupLabel)
            preconditionFailure("503 must not be treated as missing metadata")
        } catch VertaxAPIError.http(503) {}
        let empty = try await api.discogsAnalysisRelease(id: 502)
        precondition(empty.tracks.isEmpty)
        print("Crate Dig model, ephemeral metadata configuration and public request fixtures passed")
    }

    static func makeTrack(_ id: String, bpm: Int, key: String, genre: String = "") -> Record {
        Record(id: id, artist: "Synthetic", title: id, label: "", catalog: "", year: "", bpm: bpm, keyCode: key,
               side: "", genre: genre, rating: 0, played: false, coverSeed: "", notes: "", kind: .track)
    }
}

private final class PublicFixture: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        let url = request.url!
        let params = Dictionary(uniqueKeysWithValues: (URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? [])
            .map { ($0.name, $0.value ?? "") })
        precondition(request.httpMethod == "GET" && request.httpBody == nil && !request.httpShouldHandleCookies)
        for header in ["Cookie", "Authorization", "X-User-Id"] {
            precondition(request.value(forHTTPHeaderField: header) == nil)
        }
        let json: String
        var status = 200
        switch (url.path, params["action"], params["id"], params["title"]) {
        case ("/api/discogs", "search", _, _):
            let queryKey = params["catno"] == nil ? "q" : "catno"
            precondition(Set(params.keys) == ["action", queryKey, "type", "format", "per_page"])
            precondition(params[queryKey] == (queryKey == "q" ? "Public" : "PUBLIC-501"))
            json = #"{"results":[{"id":501,"title":"Public","format":["Vinyl","CD"]},{"id":501,"title":"Public","format":["Vinyl"]},{"id":502,"title":"Public","format":["Vinyl"]},{"id":999,"title":"Public","format":["CD"]}]}"#
        case ("/api/discogs", "collection", _, _):
            precondition(Set(params.keys) == ["action", "username", "page", "per_page"] && params["username"] == "fixture-crate")
            json = #"{"pagination":{"pages":1},"releases":[{"basic_information":{"id":501,"title":"Public release","formats":[{"name":"Vinyl"}]}}]}"#
        case ("/api/discogs", "release", "501", _):
            precondition(Set(params.keys) == ["action", "id"])
            json = """
            {"id":501,"title":"Public release","artists":[{"name":"Public artist"}],"labels":[{"name":"Public label"}],
             "formats":[{"name":"Vinyl"},{"name":"CD"}],
             "tracklist":[{"type_":"heading","title":"Public...Vinyl"},{"position":"A1","title":"Public A"},
             {"position":"B1","title":"Public B"},{"position":"C1","title":"Public C"},
             {"type_":"heading","title":"Public...CD"},{"position":"1","title":"Extra CD"}]}
            """
        case ("/api/discogs", "release", "502", _):
            json = #"{"id":502,"title":"Public empty pressing","formats":[{"name":"Vinyl"}]}"#
        case ("/api/beatport-lookup", _, _, "Public A"):
            precondition(Set(params.keys) == ["artist", "title", "label"])
            precondition(params["artist"] == "Public artist" && params["label"] == "Public label")
            json = #"{"matched":true,"bpm":174,"camelot":"9A"}"#
        case ("/api/beatport-lookup", _, _, "Public B"):
            json = #"{"matched":false}"#
        case ("/api/beatport-lookup", _, _, "Public C"):
            status = 503
            json = "{}"
        default:
            preconditionFailure("Unexpected public request")
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(json.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
}
