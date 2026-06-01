import Foundation

// MARK: - Transition quality between two records (Build flow)
// Port of transition() from vertax-app-data.jsx.

public struct SetTransition {
    public enum Tone { case good, warn }
    public let tone: Tone
    public let text: String
    public let bpmDelta: Int

    public init(from a: Record, to b: Record) {
        let rel = a.camelot.relation(to: b.camelot)
        let db = b.bpm - a.bpm
        let adb = abs(db)
        var tone: Tone = .good
        var text: String

        switch rel {
        case .some(.same):     text = "Same key · seamless"
        case .some(.adjacent): text = b.camelot.number > a.camelot.number ? "+1 · energy lift" : "−1 · cooldown"
        case .some(.relative): text = "Relative · mood shift"
        case .none:            tone = .warn; text = "Key clash — mix carefully"
        }

        if adb >= 4 && tone == .good {
            tone = .warn
            text = (db > 0 ? "+" : "−") + "\(adb) BPM jump"
        } else if adb >= 1 {
            text += " · " + (db > 0 ? "+" : "−") + "\(adb) BPM"
        }

        self.tone = tone; self.text = text; self.bpmDelta = db
    }
}
