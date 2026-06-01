import SwiftUI

@main
struct VertaxApp: App {
    @StateObject private var theme = VertaxTheme()
    @StateObject private var crate = CrateStore()
    @StateObject private var setS = SetStore()
    @StateObject private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(theme)
                .environmentObject(crate)
                .environmentObject(setS)
                .environmentObject(router)
                .preferredColorScheme(theme.preferredScheme)
                .tint(theme.accent)
        }
    }
}
