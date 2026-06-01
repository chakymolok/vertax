import SwiftUI

// MARK: - App-level stores & router

public final class CrateStore: ObservableObject {
    @Published public var records: [Record]
    public init(records: [Record] = Record.sample) { self.records = records }

    public func add(_ r: Record) { if !records.contains(where: { $0.id == r.id }) { records.insert(r, at: 0) } }

    /// Filtered + tempo-sorted view used by CrateView.
    public func filtered(query: String, chips: Set<CrateFilter>) -> [Record] {
        var list = records
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            list = list.filter {
                "\($0.artist) \($0.title) \($0.label) \($0.catalog) \($0.genre)".lowercased().contains(q)
            }
        }
        // chips of the same KIND are OR'd; different kinds are AND'd
        let byKind = Dictionary(grouping: chips, by: { $0.kind })
        for (_, group) in byKind {
            list = list.filter { rec in group.contains { $0.matches(rec) } }
        }
        return list.sorted { $0.bpm > $1.bpm }
    }
}

public final class SetStore: ObservableObject {
    @Published public var orderedIDs: [String]
    public init(orderedIDs: [String] = ["r3","r1","r11","r5"]) { self.orderedIDs = orderedIDs }

    public func records(in crate: CrateStore) -> [Record] {
        orderedIDs.compactMap { id in crate.records.first { $0.id == id } }
    }
    public func add(_ id: String) { if !orderedIDs.contains(id) { orderedIDs.append(id) } }
    public func remove(_ id: String) { orderedIDs.removeAll { $0 == id } }
    public func move(from: IndexSet, to: Int) { orderedIDs.move(fromOffsets: from, toOffset: to) }
}

// MARK: - Filters

public struct CrateFilter: Hashable, Identifiable {
    public enum Kind: Hashable { case bpm, key, genre, flag }
    public let id: String
    public let label: String
    public let kind: Kind
    let predicate: (Record) -> Bool
    public func matches(_ r: Record) -> Bool { predicate(r) }
    public static func == (l: CrateFilter, r: CrateFilter) -> Bool { l.id == r.id }
    public func hash(into h: inout Hasher) { h.combine(id) }

    public static let all: [CrateFilter] = [
        .init(id:"bpm1", label:"168–174", kind:.bpm) { (168...174).contains($0.bpm) },
        .init(id:"bpm2", label:"84–90",  kind:.bpm) { (84...90).contains($0.bpm) },
        .init(id:"k8a",  label:"8A",     kind:.key) { $0.keyCode == "8A" },
        .init(id:"k9a",  label:"9A",     kind:.key) { $0.keyCode == "9A" },
        .init(id:"gjun", label:"Jungle", kind:.genre) { $0.genre == "Jungle" },
        .init(id:"gliq", label:"Liquid", kind:.genre) { $0.genre == "Liquid" },
        .init(id:"gatm", label:"Atmospheric", kind:.genre) { $0.genre == "Atmospheric" },
        .init(id:"unpl", label:"Unplayed", kind:.flag) { !$0.played },
    ]
}

// MARK: - Router

public final class AppRouter: ObservableObject {
    public enum Tab: Hashable { case crate, find, build, dig }
    @Published public var tab: Tab = .crate

    // per-tab navigation stacks
    @Published public var cratePath = NavigationPath()
    @Published public var findPath  = NavigationPath()
    @Published public var buildPath = NavigationPath()
    @Published public var digPath   = NavigationPath()

    // modals
    @Published public var sheet: AppSheet?
    @Published public var showOnboarding = true
    @Published public var showLiveSet = false   // reserved — next milestone

    public init() {}
    public func openRelease(_ r: Record) {
        switch tab {
        case .crate: cratePath.append(r)
        case .build: buildPath.append(r)
        case .dig:   digPath.append(r)
        case .find:  findPath.append(r)
        }
    }
}

public enum AppSheet: Identifiable {
    case recordActions(Record)
    case discogsImport
    case settings
    public var id: String {
        switch self {
        case .recordActions(let r): return "rec-\(r.id)"
        case .discogsImport: return "discogs-import"
        case .settings: return "settings"
        }
    }
}
