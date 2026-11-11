#if DEBUG && targetEnvironment(simulator)
import Foundation

// Only enabled by an isolated UI test process. No fixture request reaches a real host.
final class MetadataFixture: URLProtocol {
    private var delivery: DispatchWorkItem?
    static let mode = ProcessInfo.processInfo.environment["VERTAX_TEST_NETWORK"]

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() { delivery?.cancel() }

    override func startLoading() {
        guard let url = request.url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            fail(.badURL)
            return
        }
        let params = Dictionary((components.queryItems ?? []).map { ($0.name, $0.value ?? "") },
                                uniquingKeysWith: { first, _ in first })
        if Self.mode == "offline" { fail(.notConnectedToInternet); return }
        switch (url.path, params["action"]) {
        case ("/api/discogs", "search"):
            let query = params["q"] ?? params["catno"] ?? ""
            switch query {
            case "Timeout": fail(.timedOut)
            case "Busy": reply(429, [:])
            case "Slow": reply(200, ["results": [edition(501, "Slow fixture", "SLOW")]], delay: 6)
            case "Calibre Even If":
                reply(200, ["results": [edition(2541196, "Calibre - Even If...", "SIGLP006"),
                                        edition(10407820, "Calibre - Even If...", "SIGLP006RP")]])
            case "Calibre Second Sun":
                reply(200, ["results": [edition(522676, "Calibre - Second Sun", "SS1"),
                                        edition(1356823, "Calibre - Second Sun", "SS2")]])
            case "K7072LP": reply(200, ["results": [edition(29823, "Various - Skills", "!K7072LP")]])
            default: reply(200, ["results": []])
            }
        case ("/api/discogs", "release"):
            switch params["id"] {
            case "29823": reply(200, release(29823, "Skills", "Various", "!K7072LP", ["Can You Feel It"]))
            case "2541196":
                var item = release(2541196, "Even If...", "Calibre", "SIGLP006",
                                   ["Even If", "After Rain", "Anchor", "Dust", "Flicker", "End Note"])
                item["formats"] = [["name": "Vinyl"], ["name": "CD"]]
                let vinyl = item["tracklist"] as? [[String: String]] ?? []
                item["tracklist"] = [["type_": "heading", "title": "Vinyl"]] + vinyl
                    + [["type_": "heading", "title": "CD"], ["type_": "track", "position": "1", "title": "CD bonus"]]
                reply(200, item)
            case "10407820": reply(200, release(10407820, "Even If...", "Calibre", "SIGLP006RP", ["Even If"]))
            default: reply(404, [:])
            }
        case ("/api/discogs", "collection"):
            if params["username"] == "Discogs" { reply(403, [:]) }
            else if params["username"] == "vinyljunkie" {
                reply(200, ["pagination": ["pages": 1],
                            "releases": [["basic_information": release(29823, "Skills", "Various", "!K7072LP", [])]]])
            } else { reply(200, ["pagination": ["pages": 1], "releases": []]) }
        case ("/api/beatport-lookup", _):
            switch params["title"] {
            case "Even If":
                reply(200, ["matched": true, "artist_original": "Calibre", "title_original": "Even If",
                            "bpm": 174, "camelot": "9A", "confidence": 1])
            case "After Rain":
                reply(200, ["matched": true, "bpm": 174], delay: 2)
            case "Anchor":
                reply(429, [:])
            default: reply(200, ["matched": false])
            }
        default: reply(404, [:])
        }
    }

    private func edition(_ id: Int, _ title: String, _ catalog: String) -> [String: Any] {
        ["id": id, "title": title, "catno": catalog, "year": "2004", "format": ["Vinyl"]]
    }

    private func release(_ id: Int, _ title: String, _ artist: String, _ catalog: String, _ titles: [String]) -> [String: Any] {
        ["id": id, "title": title, "artists": [["name": artist]], "labels": [["name": "Fixture", "catno": catalog]],
         "formats": [["name": "Vinyl"]], "tracklist": titles.enumerated().map {
             ["position": "A\($0.offset + 1)", "title": $0.element, "type_": "track", "duration": "6:00"]
         }]
    }

    private func fail(_ code: URLError.Code) { client?.urlProtocol(self, didFailWithError: URLError(code)) }

    private func reply(_ status: Int, _ payload: [String: Any], delay: TimeInterval = 0) {
        let work = DispatchWorkItem { [weak self] in
            guard let self, let url = self.request.url,
                  let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil,
                                                 headerFields: ["Content-Type": "application/json"]),
                  let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
            self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            self.client?.urlProtocol(self, didLoad: data)
            self.client?.urlProtocolDidFinishLoading(self)
        }
        delivery = work
        if delay == 0 { work.perform() }
        else { DispatchQueue.global().asyncAfter(deadline: .now() + delay, execute: work) }
    }

    static var crate: [Record]? {
        guard VertaxLocalStore.testNamespace != nil else { return nil }
        switch ProcessInfo.processInfo.environment["VERTAX_TEST_CRATE"] {
        case "long-live":
            return (1...120).map { index in
                Record(id: "fixture-live-\(index)", artist: "Test DJ", title: String(format: "Cue %03d", index),
                       label: "Fixture", catalog: "LIVE", year: "", bpm: 220 - index, keyCode: "9A",
                       side: "A1", genre: "Jungle", rating: 0, played: false, coverSeed: "fixture", notes: "", kind: .track)
            }
        case "timed": return timedCrate
        default: return nil
        }
    }

    private static var timedCrate: [Record] {
        let release = Record(id: "discogs-501", artist: "Test Press", title: "Test Pressing", label: "", catalog: "FIX01",
                         year: "", bpm: 0, keyCode: "", side: "", genre: "Jungle", rating: 0, played: false,
                         coverSeed: "fixture", notes: "", kind: .release)
        let saved = Record(id: "discogs-501-track-A1-Incomplete Track", artist: "Test Press", title: "Incomplete Track",
                           label: "Éditions 東京", catalog: "FIX01", year: "", bpm: 0, keyCode: "8A", side: "A1",
                           genre: "Jungle", rating: 0, played: false, coverSeed: "fixture", notes: "",
                           parentDiscogsID: "501", kind: .track, parentReleaseID: release.id, durationSeconds: 600)
        let tracks = Record.sample.enumerated().map { index, source in
            var item = source
            if index < 8 { item.durationSeconds = 600 }
            return item
        }
        return [release, saved] + tracks
    }
}

#endif
