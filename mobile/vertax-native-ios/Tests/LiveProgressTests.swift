import Foundation

@main
struct LiveProgressTests {
    static func main() throws {
        let start = Date(timeIntervalSince1970: 1_000)
        func at(_ seconds: TimeInterval) -> Date { start.addingTimeInterval(seconds) }

        var one = LiveProgress(setIDs: ["A", "A"], freestyleIDs: ["B", "C"], at: start)
        precondition(one.queue.ids == ["A"])
        one.advance(at: at(10))
        one.advance(at: at(11))
        precondition(one.queue.finished && one.queue.playedCount == 1 && one.seconds(at: at(20)) == 10)
        one.undo(at: at(20))
        precondition(!one.queue.finished && one.queue.playedCount == 0 && one.queue.index == 0)
        one.advance(at: at(22))
        one.appendToSet("A", at: at(23))
        precondition(one.queue.finished && one.seconds(at: at(24)) == 12)
        one.appendToSet("B", at: at(24))
        precondition(!one.queue.finished && one.queue.index == 1 && one.queue.playedCount == 1)
        one.select(.freestyle, at: at(27))
        one.advance(at: at(28))
        one.appendToSet("D", at: at(30))
        precondition(one.freestyle.ids == ["B", "C"])
        one.select(.set, at: at(31))
        precondition(one.queue.index == 1 && one.set.ids == ["A", "B"])
        one.pause(at: at(32))
        precondition(one.seconds(at: at(132)) == 20)
        one.resume(at: at(132))
        precondition(one.seconds(at: at(142)) == 30)
        one.select(.freestyle, at: at(142))
        precondition(one.queue.index == 1 && one.queue.ids == ["B", "C"])

        let ids = (0..<5_000).map { "cue-\($0)" }
        var long = LiveProgress(setIDs: ids, freestyleIDs: [], at: start)
        for n in 1...4_500 { long.advance(at: at(Double(n))) }
        let checkpoint = try JSONEncoder().encode(long)
        long = try JSONDecoder().decode(LiveProgress.self, from: checkpoint)
        long.select(.freestyle, at: at(4_650))
        precondition(long.mode == .set && long.queue.ids == ids && long.queue.index == 4_500)
        precondition(long.seconds(at: at(4_650)) == 4_650)
        let retained = Set(ids).subtracting(["cue-17", "cue-4499", "cue-4501"])
        long.retain(retained, at: at(4_650))
        precondition(long.queue.ids.count == 4_997 && long.queue.playedCount == 4_498)
        precondition(long.queue.ids[long.queue.index] == "cue-4500")

        var freestyleOnly = LiveProgress(setIDs: [], freestyleIDs: ["F"], at: start)
        precondition(freestyleOnly.mode == .freestyle && freestyleOnly.queue.ids == ["F"])
        freestyleOnly.retain([], at: at(10))
        precondition(freestyleOnly.queue.ids.isEmpty && freestyleOnly.seconds(at: at(40)) == 10)
        print("Live progress: queue isolation, single-track undo, continuation, 5,000 cues and checkpoint recovery passed.")
    }
}
