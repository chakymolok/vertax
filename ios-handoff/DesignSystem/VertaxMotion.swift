import SwiftUI

// MARK: - Motion tokens
// iOS-native feel. The nav/sheet curve matches the prototype's cubic-bezier(0.32,0.72,0,1).

public enum VxMotion {
    /// Push / large transitions.
    public static let nav   = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.34)
    /// Bottom sheets.
    public static let sheet = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.36)
    /// Tap press feedback (scale to 0.965).
    public static let tap   = Animation.easeOut(duration: 0.12)
    /// Content reveal (fade + 8pt rise).
    public static let fadeUp = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.34)
    /// Pop-in (score card, etc).
    public static let pop    = Animation.spring(response: 0.4, dampingFraction: 0.72)

    /// Score count-up: animate value 0→score over this duration, easeOutCubic.
    public static let scoreCountUp: Double = 0.95
    /// Analyze checklist: ms between steps becoming "done".
    public static let analyzeStepInterval: Double = 0.52
}

// Tap-scale modifier (use on every tappable card/row/button).
public struct VxPressable: ViewModifier {
    @State private var pressed = false
    public func body(content: Content) -> some View {
        content
            .scaleEffect(pressed ? 0.965 : 1)
            .opacity(pressed ? 0.9 : 1)
            .animation(VxMotion.tap, value: pressed)
            .simultaneousGesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false })
    }
}
public extension View {
    func vxPressable() -> some View { modifier(VxPressable()) }
}
