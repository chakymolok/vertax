import SwiftUI

// MARK: - Discogs import — domain
// Paste a profile link or username → pull the public collection through the
// Vertax backend Discogs proxy.

public struct ImportSummary { public let records: Int; public let labels: Int; public let handle: String }

public enum ImportState: Equatable {
    case idle
    case loading(step: Int)
    case done(ImportSummary)
    case failed(String)
    public static func == (l: ImportState, r: ImportState) -> Bool {
        switch (l, r) {
        case (.idle,.idle): true
        case let (.loading(a),.loading(b)): a==b
        case (.done,.done): true
        case (.failed,.failed): true
        default: false
        }
    }
}

public enum DiscogsImport {
    public static let steps = ["Fetching Discogs profile", "Reading collection", "Matching BPM & Key", "Building your crate"]
    public static func steps(lang: String) -> [String] {
        [
            L.t("import.step_profile", lang),
            L.t("import.step_collection", lang),
            L.t("import.step_matching", lang),
            L.t("import.step_crate", lang)
        ]
    }

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
    private let api = VertaxAPI()

    public init() {}
    public var handle: String { DiscogsImport.parseHandle(url) }

    /// Kicks off the staged import; on completion replaces the crate's records.
    public func run(into crate: CrateStore, lang: String = "en") {
        guard !handle.isEmpty else { return }
        cancel()
        state = .loading(step: 0)
        Task { await runImport(into: crate, lang: lang) }
    }

    @MainActor
    private func runImport(into crate: CrateStore, lang: String) async {
        let username = handle
        guard !username.isEmpty else { return }

        for step in 1..<DiscogsImport.steps.count {
            try? await Task.sleep(nanoseconds: 360_000_000)
            if case .loading = state { state = .loading(step: step) }
        }

        do {
            let recs = try await api.importDiscogsCollection(username: username)
            if case .loading = state { state = .loading(step: DiscogsImport.steps.count) }
            guard !recs.isEmpty else {
                state = .failed(L.t("import.empty", lang))
                return
            }
            crate.records = recs
            let labels = Set(recs.map { $0.label }).count
            state = .done(ImportSummary(records: recs.count, labels: labels, handle: username))
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
    public func cancel() {}
}
