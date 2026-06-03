import SwiftUI

// MARK: - Bottom tab bar (Crate / Find / Build / Dig / Wishlist / Settings)
public struct VxTabBar: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    @AppStorage("vx_lang") private var lang = "en"
    @Binding var selection: AppRouter.Tab
    public init(selection: Binding<AppRouter.Tab>) { self._selection = selection }

    private let items: [(AppRouter.Tab, String, String)] = [
        (.crate, "tab.crate", "square.stack.3d.up"),
        (.find,  "tab.find",  "magnifyingglass"),
        (.build, "tab.build", "slider.horizontal.3"),
        (.dig,   "tab.dig",   "shippingbox"),
        (.wishlist, "tab.wishlist", "heart"),
        (.settings, "tab.settings", "gearshape"),
    ]
    public var body: some View {
        HStack {
            ForEach(items, id: \.0) { tab, label, icon in
                Button { selection = tab } label: {
                    VStack(spacing: 2) {
                        Image(systemName: icon).font(.system(size: 20, weight: selection == tab ? .semibold : .regular))
                        Text(L.t(label, lang))
                            .font(.system(size: 9.5, weight: .medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .foregroundStyle(selection == tab ? theme.accentText(scheme) : VxColor.textTertiary)
                    .frame(maxWidth: .infinity)
                }.buttonStyle(.plain)
            }
        }
        .padding(.top, 7)
        .padding(.bottom, 0)
        .frame(height: VxSize.tabBar, alignment: .top)
        .background(.ultraThinMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(VxColor.hairline), alignment: .top)
        .ignoresSafeArea(.container, edges: .bottom)
    }
}
