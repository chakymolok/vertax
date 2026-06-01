import CoreGraphics

// MARK: - Spacing scale
public enum VxSpace {
    public static let xs: CGFloat = 4
    public static let s:  CGFloat = 8
    public static let m:  CGFloat = 12
    public static let l:  CGFloat = 16
    public static let xl: CGFloat = 20      // default screen padding
    public static let xxl: CGFloat = 26
}

// MARK: - Corner radii
public enum VxRadius {
    public static let card: CGFloat = 22    // tweakable 10...30 (VertaxTheme.cornerRadius)
    public static let chip: CGFloat = 9
    public static let control: CGFloat = 11 // segmented, inputs, small tiles
    public static let button: CGFloat = 15
    public static let cover: CGFloat = 11
    public static let sheet: CGFloat = 26
    public static let key: CGFloat = 7
}

// MARK: - Fixed sizes
public enum VxSize {
    public static let statusBar: CGFloat = 54
    public static let tabBar: CGFloat = 84
    public static let hitTarget: CGFloat = 44   // minimum
    public static let rowCover: CGFloat = 48
    public static let iconButton: CGFloat = 36
    public static let tabIcon: CGFloat = 25
    public static let primaryButton: CGFloat = 50
}

// MARK: - Density
public struct VxDensityMetrics {
    public let screenPadding: CGFloat
    public let rowPaddingV: CGFloat
}
public enum VxDensity: String, CaseIterable, Identifiable {
    case compact, cozy, roomy
    public var id: String { rawValue }
    public var metrics: VxDensityMetrics {
        switch self {
        case .compact: return .init(screenPadding: 15, rowPaddingV: 7)
        case .cozy:    return .init(screenPadding: 20, rowPaddingV: 9)
        case .roomy:   return .init(screenPadding: 24, rowPaddingV: 12)
        }
    }
}
