import SwiftUI

// MARK: - Bottom tab bar (Crate / Find / Build / Dig)
public struct VxTabBar: View {
    @EnvironmentObject var theme: VertaxTheme
    @Environment(\.colorScheme) var scheme
    @Binding var selection: AppRouter.Tab
    public init(selection: Binding<AppRouter.Tab>) { self._selection = selection }

    private let items: [(AppRouter.Tab, String, String)] = [
        (.crate, "Crate", "square.stack.3d.up"),
        (.find,  "Find",  "magnifyingglass"),
        (.build, "Build", "slider.horizontal.3"),
        (.dig,   "Dig",   "shippingbox"),
    ]
    public var body: some View {
        HStack {
            ForEach(items, id: \.0) { tab, label, icon in
                Button { selection = tab } label: {
                    VStack(spacing: 4) {
                        Image(systemName: icon).font(.system(size: 21, weight: selection == tab ? .semibold : .regular))
                        Text(label).font(.system(size: 10.5, weight: .medium))
                    }
                    .foregroundStyle(selection == tab ? theme.accentText(scheme) : VxColor.textTertiary)
                    .frame(maxWidth: .infinity)
                }.buttonStyle(.plain)
            }
        }
        .padding(.top, 9)
        .frame(height: VxSize.tabBar, alignment: .top)
        .background(.ultraThinMaterial)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(VxColor.hairline), alignment: .top)
    }
}
