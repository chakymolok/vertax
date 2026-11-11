import Foundation

// MARK: - Transition quality between two records (Build flow)
// Port of transition() from vertax-app-data.jsx.

public struct SetTransition {
    public enum Tone { case good, warn }
    public let tone: Tone
    public let text: String
    public let bpmDelta: Int

    public init(from a: Record, to b: Record, lang: String = "en") {
        guard a.hasMixMetadata, b.hasMixMetadata, let from = a.validCamelot, let to = b.validCamelot else {
            tone = .warn
            text = L.t("mix.missing", lang)
            bpmDelta = 0
            return
        }
        let rel = from.relation(to: to)
        let db = b.bpm - a.bpm
        let adb = abs(db)
        var tone: Tone = .good
        var text: String

        switch rel {
        case .some(.same):     text = L.t("mix.same", lang)
        case .some(.adjacent): text = from.stepped(by: 1) == to ? "+1 Camelot" : "−1 Camelot"
        case .some(.relative): text = L.t("mix.relative", lang)
        case .none:            tone = .warn; text = L.t("mix.clash", lang)
        }

        if adb >= 4 && tone == .good {
            tone = .warn
            text = (db > 0 ? "+" : "−") + "\(adb) BPM"
        } else if adb >= 1 {
            text += " · " + (db > 0 ? "+" : "−") + "\(adb) BPM"
        }

        self.tone = tone; self.text = text; self.bpmDelta = db
    }
}
