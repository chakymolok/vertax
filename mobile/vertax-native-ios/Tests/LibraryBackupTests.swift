import Foundation

@main
struct LibraryBackupTests {
    static func main() throws {
        let web = try LibraryBackup.decode(Data(webFixture.utf8))
        let tracks = web.records.filter { !$0.isRelease }
        precondition(web.records.filter(\.isRelease).count == 2)
        precondition(tracks.count == 4)
        let imported = try require(tracks.first { $0.title == "Manual cut" })
        precondition(imported.containingReleaseID == "discogs-29823")
        precondition(imported.bpm == 174 && imported.keyCode == "8A" && imported.side == "B1")
        precondition(imported.durationSeconds == 315 && imported.bpmSource == "manual" && imported.notes == "cue")
        let manualRelease = try require(web.records.first { $0.id == "web-release:vinyl-manual" })
        precondition(manualRelease.isRelease && manualRelease.discogsURL == nil)
        precondition(tracks.contains { $0.title == "Untimed" && $0.bpm == 0 && $0.containingReleaseID == manualRelease.id })
        precondition(tracks.contains { $0.title == "Deleted from crate" && $0.containingReleaseID == nil })
        let selectedReleases = Record.expandReleaseSelection([manualRelease.id, "discogs-29823", manualRelease.id], in: web.records)
        let selectedTitles = selectedReleases.compactMap { id in web.records.first { $0.id == id }?.title }
        precondition(selectedTitles == ["Untimed", "Side A", "Manual cut"])
        precondition(web.sets.map(\.name) == ["Night shift", "Afterhours"])
        let firstSetTitles = web.sets[0].entryIDs.compactMap { id in web.records.first { $0.id == id }?.title }
        precondition(firstSetTitles == ["Manual cut", "Deleted from crate", "Untimed"])

        let root = try require(web.records.first { $0.id == "discogs-29823" })
        let local = Record(id: "discogs-29823-track-B1-Manual cut", artist: root.artist, title: imported.title,
                           label: root.label, catalog: root.catalog, year: root.year, bpm: 171, keyCode: "10A",
                           side: "C1", genre: root.genre, rating: 0, played: true, coverSeed: root.coverSeed,
                           notes: "local edit", parentDiscogsID: root.discogsID)
        let oldCrate = LibraryBackup(records: [root, local], activeSet: [local.id], wishlist: [root.id])
        let merged = oldCrate.merging(web)
        let preserved = try require(merged.records.first { $0.id == local.id })
        precondition(preserved.bpm == 171 && preserved.keyCode == "10A" && preserved.side == "C1")
        precondition(preserved.played && preserved.notes == "local edit")
        precondition(merged.records.count == web.records.count)
        precondition(merged.sets[0].entryIDs.first == local.id && merged.activeSet == [local.id])
        precondition(merged.merging(web) == merged)

        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: url) }
        try merged.encoded().write(to: url, options: .atomic)
        let decoded = try LibraryBackup.decode(Data(contentsOf: url))
        precondition(decoded == merged)
        precondition(LibraryBackup(records: []).merging(decoded) == merged)
        let legacy = try JSONEncoder().encode([root, local])
        let restoredLegacy = try LibraryBackup.decode(legacy)
        precondition(restoredLegacy.records == [root, local] && restoredLegacy.sets.isEmpty)
        let versioned = webFixture.replacingOccurrences(of: #""app": "VERTAX-01 / RUNT-01", "backupVersion": 1"#, with: #""version": 1"#)
        precondition(tryDecode(versioned) == web)
        let seconds = webFixture.replacingOccurrences(of: #""duration":"5:15""#, with: #""duration":315"#)
        let secondsString = webFixture.replacingOccurrences(of: #""duration":"5:15""#, with: #""duration":"315.0""#)
        guard tryDecode(seconds) == web, tryDecode(secondsString) == web else {
            throw CocoaError(.fileReadCorruptFile, userInfo: [NSLocalizedDescriptionKey: "Web duration in seconds must restore the same records and sets as m:ss."])
        }
        precondition(tryDecode(#"{"app":"vertax-ios","backupVersion":99,"records":[]}"#) == nil)
        precondition(tryDecode(#"{"version":1,"vinyls":"malformed"}"#) == nil)
        precondition(tryDecode(String(webFixture.dropLast())) == nil)
        precondition(tryDecode(webFixture.replacingOccurrences(of: #""duration":"5:15""#, with: #""duration":true"#)) == nil)
        precondition((try? LibraryBackup.decode(Data(repeating: 32, count: LibraryBackup.maxBytes + 1))) == nil)

        let vinyls = (0..<3_000).map { index in
            #"""
            {"id":"v\#(index)","discogsId":\#(50_000 + index),"artist":"Crate test","title":"Release \#(index)",
             "tracklist":[{"id":"a","title":"A","position":"A1","bpm":"174","camelot":"8a"},
                          {"id":"b","title":"B","position":"B1","bpm":null}]}
            """#
        }.joined(separator: ",")
        let large = try LibraryBackup.decode(Data("{\"version\":1,\"vinyls\":[\(vinyls)]}".utf8))
        precondition(large.records.count == 9_000)
        let copy = try LibraryBackup.decode(large.encoded())
        precondition(copy == large && large.merging(copy) == large)
        print("Library backup tests passed: web duration formats, corrupt file rejection, local edits, native round trip, 9000 entries")
    }

    static func require<T>(_ value: T?) throws -> T {
        guard let value else { throw CocoaError(.fileReadCorruptFile) }
        return value
    }

    static func tryDecode(_ json: String) -> LibraryBackup? {
        try? LibraryBackup.decode(Data(json.utf8))
    }

    static let webFixture = #"""
    {
      "app": "VERTAX-01 / RUNT-01", "backupVersion": 1,
      "vinyls": [
        {"id":"vinyl-discogs","discogsId":"29823","artist":"Various","title":"Skills","catno":"!K7072LP",
         "genre":["Electronic"],"style":["House"],"year":1998,
         "tracklist":[{"id":"manual-cut","title":"Manual cut","position":"B1","duration":"5:15",
                       "bpm":"174","camelot":"8a","key":"A Minor","bpmSource":"manual","comment":"cue"},
                      {"id":"raw","title":"Side A","position":"A1","bpm":null,"key":null}]},
        {"id":"vinyl-manual","artist":"Local","title":"White label","style":"Techno",
         "tracklist":[{"id":"untimed","title":"Untimed","side":"A"}]}
      ],
      "sets": [
        {"id":"night","name":"Night shift","createdAt":1770000000000,"tracks":[
          {"vinylId":"vinyl-manual","trackId":"untimed","position":3},
          {"vinylId":"vinyl-discogs","trackId":"manual-cut","position":1,"snapshot":{"title":"Old title","bpm":164}},
          {"vinylId":"deleted-release","trackId":"deleted","position":2,
           "snapshot":{"title":"Deleted from crate","bpm":128,"camelot":"7A","vinylArtist":"Artist","vinylPosition":"A2"}},
          {"vinylId":"missing","trackId":"missing","position":4}
        ]},
        {"id":"afterhours","name":"Afterhours","tracks":[{"vinylId":"vinyl-discogs","trackId":"raw","position":1}]}
      ],
      "settings":[{"key":"web-setting","value":true}]
    }
    """#
}
