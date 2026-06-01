import Foundation

// MARK: - Camelot wheel
// Direct port of the prototype's harmonic logic (vertax-app-data.jsx).
// Key notation: <1...12><A|B>, A = minor, B = major.

public struct Camelot: Hashable, Codable {
    public let number: Int   // 1...12
    public let letter: Letter
    public enum Letter: String, Codable { case A, B }

    public init?(_ raw: String) {
        let s = raw.uppercased()
        guard let last = s.last, let l = Letter(rawValue: String(last)),
              let n = Int(s.dropLast()), (1...12).contains(n) else { return nil }
        self.number = n; self.letter = l
    }
    public init(number: Int, letter: Letter) { self.number = number; self.letter = letter }

    public var code: String { "\(number)\(letter.rawValue)" }

    /// Musical key name, e.g. "8A" -> "A min".
    public var musicalKey: String { Camelot.keyNames[code] ?? code }

    /// Step around the wheel keeping the same letter (±1 = energy lift/cooldown).
    public func stepped(by delta: Int) -> Camelot {
        let n = ((number - 1 + delta) % 12 + 12) % 12 + 1
        return Camelot(number: n, letter: letter)
    }
    /// Relative major/minor (same number, flipped letter).
    public var relative: Camelot { Camelot(number: number, letter: letter == .A ? .B : .A) }

    /// Harmonic relationship to another key (nil = clash).
    public enum Relation { case same, relative, adjacent }
    public func relation(to other: Camelot) -> Relation? {
        if number == other.number && letter == other.letter { return .same }
        if number == other.number { return .relative }
        let d = min((number - other.number + 12) % 12, (other.number - number + 12) % 12)
        if letter == other.letter && d == 1 { return .adjacent }
        return nil
    }

    static let keyNames: [String: String] = [
        "8A":"A min","8B":"C maj","9A":"E min","9B":"G maj","7A":"D min","7B":"F maj",
        "4A":"F min","4B":"Ab maj","10A":"B min","10B":"D maj","5A":"C min","11A":"F# min",
        "6A":"G min","3A":"Bb min","12A":"Db min","1A":"Ab min","2A":"Eb min"
    ]
}
