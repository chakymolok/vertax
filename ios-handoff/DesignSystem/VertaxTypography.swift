import SwiftUI

// MARK: - Type scale
// UI text: SF Pro (system). Technical data (BPM, Camelot, catalog #, labels): monospaced.
// To use the brand mono "Share Tech Mono", add the .ttf to the target and swap
// VxFont.mono to .custom("ShareTechMono-Regular", size:). SF Mono is the default.

public enum VxFont {
    // display / titles
    public static let largeTitle  = Font.system(size: 30, weight: .bold)      // tracking -0.03em
    public static let title       = Font.system(size: 22, weight: .semibold)  // -0.02em
    public static let headline    = Font.system(size: 17, weight: .semibold)
    public static let bodyStrong  = Font.system(size: 15, weight: .semibold)
    public static let body        = Font.system(size: 15, weight: .medium)
    public static let subhead     = Font.system(size: 13.5, weight: .medium)
    public static let caption     = Font.system(size: 12.5, weight: .medium)
    public static let footnote    = Font.system(size: 11.5, weight: .medium)

    // monospaced (technical)
    public static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
    public static let labelMono   = Font.system(size: 10, weight: .regular, design: .monospaced) // UPPERCASE, tracking 0.14em
    public static let keyBadge    = Font.system(size: 13, weight: .regular, design: .monospaced)
    // BPM display sizes used in the prototype: 30 (detail), 26 (find), 22, 17, 15
    public static func bpm(_ size: CGFloat = 22) -> Font { .system(size: size, weight: .regular, design: .monospaced) }
}

// Letter-spacing helpers (SwiftUI uses absolute tracking, not em).
public enum VxTracking {
    public static let largeTitle: CGFloat = -0.9   // ~ -0.03em @ 30
    public static let title: CGFloat = -0.4
    public static let labelMono: CGFloat = 1.4     // ~ 0.14em @ 10
}
