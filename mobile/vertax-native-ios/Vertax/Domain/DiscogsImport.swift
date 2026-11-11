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
    /// Extract a username from a pasted profile URL, @handle, or bare username.
    public static func parseHandle(_ raw: String) -> String {
        let input = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let username: String
        if input.contains("/") {
            let address = input.contains("://") ? input : "https://\(input)"
            guard let url = URL(string: address),
                  ["discogs.com", "www.discogs.com"].contains(url.host?.lowercased() ?? "") else { return "" }
            let parts = url.path.split(separator: "/")
            guard parts.count >= 2, parts[0] == "user" else { return "" }
            username = String(parts[1])
        } else {
            username = input.hasPrefix("@") ? String(input.dropFirst()) : input
        }
        return username.range(of: #"^[A-Za-z0-9_.-]{1,64}$"#, options: .regularExpression) == nil ? "" : username
    }
}

@MainActor public final class DiscogsImporter: ObservableObject {
    @Published public var url = ""
    @Published public var state: ImportState = .idle
    private let api = VertaxAPI()
    private var task: Task<Void, Never>?

    public init() {}
    public var handle: String { DiscogsImport.parseHandle(url) }

    public func run(into crate: CrateStore, lang: String = "en") {
        let username = handle
        guard !username.isEmpty else { return }
        cancel()
        state = .loading(step: 0)
        task = Task {
            do {
                let recs = try await api.importDiscogsCollection(username: username)
                try Task.checkCancellation()
                guard !recs.isEmpty else {
                    state = .failed(L.t("import.empty", lang))
                    return
                }
                let added = crate.merge(recs)
                let labels = Set(recs.map(\.label)).count
                state = .done(ImportSummary(records: added, labels: labels, handle: username))
            } catch {
                guard !Task.isCancelled else { return }
                let key: String
                switch error {
                case VertaxAPIError.http(401), VertaxAPIError.http(403): key = "import.private"
                case VertaxAPIError.http(404): key = "import.missing"
                default: key = "network.retry"
                }
                state = .failed(L.t(key, lang))
            }
        }
    }
    public func cancel() {
        task?.cancel()
        task = nil
        if case .loading = state { state = .idle }
    }
}
