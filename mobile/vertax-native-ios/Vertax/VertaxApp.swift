import SwiftUI

@main
struct VertaxApp: App {
    @StateObject private var theme = VertaxTheme()
    @StateObject private var crate = CrateStore()
    @StateObject private var setS = SetStore()
    @StateObject private var wishlist = WishlistStore()
    @StateObject private var router = AppRouter()
    @StateObject private var live = LiveSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(theme)
                .environmentObject(crate)
                .environmentObject(setS)
                .environmentObject(wishlist)
                .environmentObject(router)
                .environmentObject(live)
                .defaultAppStorage(VertaxLocalStore.defaults)
                .preferredColorScheme(theme.preferredScheme)
                .tint(theme.accent)
        }
    }
}
