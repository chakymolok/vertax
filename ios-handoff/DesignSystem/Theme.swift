import SwiftUI

// MARK: - Runtime theme (also the Tweaks model)
// One instance lives at the app root as @StateObject and is passed down via
// .environmentObject. Components read it from @EnvironmentObject.

public final class VertaxTheme: ObservableObject {
    @Published public var accentHex: UInt          // identity accent (lime by default)
    @Published public var density: VxDensity
    @Published public var preferredScheme: ColorScheme?   // nil = follow system
    @Published public var cornerRadius: CGFloat    // overrides VxRadius.card (10...30)

    public init(accentHex: UInt = 0xC8FF2E,
                density: VxDensity = .cozy,
                preferredScheme: ColorScheme? = .dark,
                cornerRadius: CGFloat = VxRadius.card) {
        self.accentHex = accentHex
        self.density = density
        self.preferredScheme = preferredScheme
        self.cornerRadius = cornerRadius
    }

    /// Tweak presets surfaced in the debug Tweaks screen.
    public static let accentOptions: [UInt] = [0xC8FF2E, 0x67D4E6, 0xE8B15F, 0xE58FB0, 0x9CA8FF]

    public var accent: Color { Color(rgb: accentHex) }
    public var accentDim: Color { accent.opacity(0.14) }
    public var accentLine: Color { accent.opacity(0.38) }

    /// Accent as TEXT. On dark it's the accent itself; on light it's darkened
    /// for contrast (lime is unreadable on paper).
    public func accentText(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? accent : accent.mixed(with: Color(rgb: 0x122600), amount: 0.42)
    }

    public var metrics: VxDensityMetrics { density.metrics }
}

// Convenience environment read.
public extension EnvironmentValues {
    var vxScheme: ColorScheme {
        // Helper for components that need to branch on resolved scheme.
        self.colorScheme
    }
}
