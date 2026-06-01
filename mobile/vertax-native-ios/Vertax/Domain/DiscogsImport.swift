import SwiftUI

// MARK: - Discogs import — domain
// Paste a profile link or username → pull the public collection. Port of the
// prototype's DiscogsImportSheet. The fetch here is stubbed with Record.sample;
// wire it to the real Discogs API (or the Vertax backend) when available.

public struct ImportSummary { public let records: Int; public let labels: Int; public let handle: String }

public enum ImportState: Equatable {
    case idle
    case loading(step: Int)
    case done(ImportSummary)
    public static func == (l: ImportState, r: ImportState) -> Bool {
        switch (l, r) { case (.idle,.idle): true; case let (.loading(a),.loading(b)): a==b; case (.done,.done): true; default: false }
    }
}

public enum DiscogsImport {
    public static let steps = ["Fetching Discogs profile", "Reading collection", "Matching BPM & Key", "Building your crate"]

    /// Extract a username from a pasted profile URL, @handle, or bare username.
    public static func parseHandle(_ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return "" }
        if let r = s.range(of: #"discogs\.com/(?:user/)?([A-Za-z0-9_\-.]+)"#, options: [.regularExpression, .caseInsensitive]) {
            let match = String(s[r])
            return match.split(separator: "/").last.map(String.init) ?? s
        }
        return s.replacingOccurrences(of: "@", with: "").split(whereSeparator: { "/ ?".contains($0) }).first.map(String.init) ?? s
    }
}

public final class DiscogsImporter: ObservableObject {
    @Published public var url = ""
    @Published public var state: ImportState = .idle
    private var timers: [Timer] = []

    public init() {}
    public var handle: String { DiscogsImport.parseHandle(url) }

    /// Kicks off the staged import; on completion replaces the crate's records.
    public func run(into crate: CrateStore) {
        guard !handle.isEmpty else { return }
        cancel()
        state = .loading(step: 0)
        for s in 1...DiscogsImport.steps.count {
            timers.append(Timer.scheduledTimer(withTimeInterval: Double(s) * 0.56, repeats: false) { [weak self] _ in
                if case .loading = self?.state { self?.state = .loading(step: s) }
            })
        }
        timers.append(Timer.scheduledTimer(withTimeInterval: 2.5, repeats: false) { [weak self] _ in
            guard let self else { return }
            let recs = Record.sample          // ← replace with real Discogs fetch
            crate.records = recs
            let labels = Set(recs.map { $0.label }).count
            self.state = .done(ImportSummary(records: recs.count, labels: labels, handle: self.handle))
        })
    }
    public func cancel() { timers.forEach { $0.invalidate() }; timers = [] }
}
