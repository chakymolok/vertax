import SwiftUI

// MARK: - App entry
// Drop this into your @main App:
//
//   @main struct VertaxApp: App {
//       @StateObject var theme = VertaxTheme()
//       @StateObject var crate = CrateStore()
//       @StateObject var set   = SetStore()
//       @StateObject var router = AppRouter()
//       var body: some Scene {
//           WindowGroup {
//               RootView()
//                   .environmentObject(theme)
//                   .environmentObject(crate)
//                   .environmentObject(set)
//                   .environmentObject(router)
//                   .preferredColorScheme(theme.preferredScheme)
//                   .tint(theme.accent)
//           }
//       }
//   }

public struct RootView: View {
    @EnvironmentObject var theme: VertaxTheme
    @EnvironmentObject var router: AppRouter

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            VxColor.bg.ignoresSafeArea()

            // active tab content
            Group {
                switch router.tab {
                case .crate:
                    NavigationStack(path: $router.cratePath) {
                        CrateView().navigationDestination(for: Record.self) { ReleaseView(record: $0) }
                    }
                case .find:
                    NavigationStack(path: $router.findPath) {
                        FindView().navigationDestination(for: Record.self) { ReleaseView(record: $0) }
                    }
                case .build:
                    NavigationStack(path: $router.buildPath) {
                        BuildView().navigationDestination(for: Record.self) { ReleaseView(record: $0) }
                    }
                case .dig:
                    NavigationStack(path: $router.digPath) {
                        DigView().navigationDestination(for: Record.self) { ReleaseView(record: $0) }
                    }
                }
            }
            .padding(.bottom, VxSize.tabBar)   // keep content above the bar

            VxTabBar(selection: $router.tab)
        }
        // contextual action sheets
        .sheet(item: $router.sheet) { sheet in
            switch sheet {
            case .recordActions(let r): RecordActionsSheet(record: r).presentationDetents([.medium])
            case .discogsImport:        ImportSheet()
            case .settings:             SettingsSheet().presentationDetents([.medium, .large])
            }
        }
        // first-run onboarding
        .fullScreenCover(isPresented: $router.showOnboarding) { OnboardingView() }
        // Live Set Mode — club-readable performance screen
        .fullScreenCover(isPresented: $router.showLiveSet) { LiveSetView() }
        .preferredColorScheme(theme.preferredScheme)
        .tint(theme.accent)
    }
}