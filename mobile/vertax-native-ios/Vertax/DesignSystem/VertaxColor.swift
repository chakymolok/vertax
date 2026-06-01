import SwiftUI
import UIKit

// MARK: - Hex helpers

extension UIColor {
    convenience init(rgb: UInt, alpha: Double = 1) {
        self.init(
            red:   CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue:  CGFloat(rgb & 0xFF) / 255,
            alpha: alpha)
    }
}

extension Color {
    init(rgb: UInt, alpha: Double = 1) { self.init(uiColor: UIColor(rgb: rgb, alpha: alpha)) }

    /// Adaptive color: resolves per light/dark at render time.
    init(light: UInt, dark: UInt, lightAlpha: Double = 1, darkAlpha: Double = 1) {
        self.init(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(rgb: dark, alpha: darkAlpha)
                : UIColor(rgb: light, alpha: lightAlpha)
        })
    }

    /// Linear mix toward another color (used for readable accent-on-light).
    func mixed(with other: Color, amount: Double) -> Color {
        let a = UIColor(self), b = UIColor(other)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let t = CGFloat(amount)
        return Color(.sRGB,
            red: Double(ar + (br - ar) * t),
            green: Double(ag + (bg - ag) * t),
            blue: Double(ab + (bb - ab) * t),
            opacity: Double(aa + (ba - aa) * t))
    }
}

// MARK: - Vertax color tokens (Direction A · Nordic Dark Utility)
// Values are taken verbatim from the approved prototype (vertax.css).

public enum VxColor {
    // surfaces
    public static let bg             = Color(light: 0xF3F2ED, dark: 0x0E1110)
    public static let surface        = Color(light: 0xECEBE4, dark: 0x15191A)
    public static let card           = Color(light: 0xFFFFFF, dark: 0x1A1F1F)
    public static let cardElevated   = Color(light: 0xF1EFE8, dark: 0x202627)
    // hairlines
    public static let hairline       = Color(light: 0x161A18, dark: 0xFFFFFF, lightAlpha: 0.09, darkAlpha: 0.075)
    public static let hairlineStrong = Color(light: 0x161A18, dark: 0xFFFFFF, lightAlpha: 0.15, darkAlpha: 0.12)
    // text
    public static let text           = Color(light: 0x161A18, dark: 0xECEFEC)
    public static let textSecondary  = Color(light: 0x5B635E, dark: 0x9AA39F)
    public static let textTertiary   = Color(light: 0x949B95, dark: 0x69716E)
    // accent (identity) — default; runtime accent lives in VertaxTheme
    public static let lime           = Color(light: 0xBDEC1F, dark: 0xC8FF2E)
    public static let limeInk        = Color(light: 0x1A2400, dark: 0x0E1110)
    // secondary / status
    public static let cyan           = Color(light: 0x1D8AA0, dark: 0x67D4E6)
    public static let amber          = Color(light: 0xB9791A, dark: 0xE8B15F)

    // tints (use sparingly, never as large fills)
    public static func limeDim(_ accent: Color) -> Color { accent.opacity(0.14) }
    public static func limeLine(_ accent: Color) -> Color { accent.opacity(0.38) }
    public static let cyanDim        = Color(light: 0x1D8AA0, dark: 0x67D4E6).opacity(0.14)
}
