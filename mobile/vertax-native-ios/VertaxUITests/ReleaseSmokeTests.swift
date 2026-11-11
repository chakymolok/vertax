import XCTest

final class ReleaseSmokeTests: XCTestCase {
    @MainActor
    func testLongLiveResumeInRussian() {
        continueAfterFailure = false
        let app = fixtureApp("offline")
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["VERTAX_TEST_CRATE"] = "long-live"
        app.launchArguments = ["-vx_lang", "ru", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()

        tap(app.buttons["tab.find"], timeout: 12)
        XCTAssertTrue(app.staticTexts["ПОИСК · BPM / ТОНАЛЬНОСТЬ"].exists)
        tap(app.buttons["tab.build"])
        tap(app.buttons["set.source"])
        tap(app.buttons["Выбрать показанные"])
        XCTAssertTrue(app.buttons["set.track.save"].label.contains("(120)"))
        tap(app.buttons["set.track.save"])
        tap(app.buttons["build.live"])
        let position = app.staticTexts["live.position"]
        let now = app.staticTexts["live.now.track"]
        let next = app.buttons["live.advance"]
        XCTAssertEqual(next.label, "Сыграно · дальше")
        XCTAssertEqual(position.label, "1 / 120")
        tap(next)
        tap(next)
        XCTAssertEqual(position.label, "3 / 120")
        XCTAssertEqual(now.label, "Cue 003")
        let clock = app.staticTexts["live.elapsed"]
        let before = clock.label
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertEqual(position.label, "3 / 120")
        XCTAssertGreaterThanOrEqual(clock.label, before)
        tap(app.buttons["live.mode.freestyle"])
        XCTAssertEqual(position.label, "1 / 120")
        tap(next)
        tap(app.buttons["live.mode.set"])
        XCTAssertEqual(now.label, "Cue 003")

        let queue = app.scrollViews["live.queue"]
        XCTAssertTrue(queue.exists)
        queue.swipeUp(velocity: .fast)
        queue.swipeUp(velocity: .fast)
        XCTAssertTrue(next.isHittable, "Advance must remain reachable when scrolling a long queue")
        tap(next)
        app.terminate()
        app.launch()
        tap(app.buttons["tab.build"], timeout: 12)
        let resume = app.buttons["build.live"]
        XCTAssertEqual(resume.label, "Продолжить сет")
        tap(resume)
        XCTAssertEqual(position.label, "4 / 120")
        XCTAssertEqual(now.label, "Cue 004")
        XCTAssertGreaterThanOrEqual(clock.label, before)
        capture("18-live-resume-ru", app)
        tap(app.buttons["live.mode.freestyle"])
        XCTAssertEqual(position.label, "2 / 120")
        tap(app.buttons["live.mode.set"])
        tap(app.buttons["live.end"])
        XCTAssertTrue(app.alerts["Завершить выступление?"].exists)
        tap(app.alerts.buttons["Отмена"])
        XCTAssertEqual(position.label, "4 / 120")
        tap(app.buttons["live.pause"])
        XCTAssertEqual(resume.label, "Продолжить сет")
    }

    @MainActor
    func testLiveFinishContinuationKeepsDraftAndNamedSet() {
        continueAfterFailure = false
        let app = fixtureApp("offline")
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["VERTAX_TEST_CRATE"] = "timed"
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()
        tap(app.buttons["tab.build"], timeout: 12)
        tap(app.buttons["set.source"])
        let cue = app.buttons.containing(.staticText, identifier: "Mvson — Low Ceiling").firstMatch
        reveal(cue, in: app)
        tap(cue)
        tap(app.buttons["set.track.save"])
        tap(app.buttons["Save set"])
        type("One cue", into: app.alerts.textFields["Set name"], submit: false)
        tap(app.alerts.buttons["Save"])
        tap(app.buttons["set.clear"])
        XCTAssertTrue(app.alerts["Clear this draft?"].exists)
        tap(app.alerts.buttons["Cancel"])

        tap(app.buttons["build.live"])
        let position = app.staticTexts["live.position"]
        XCTAssertEqual(position.label, "1 / 1")
        tap(app.buttons["live.advance"])
        XCTAssertTrue(app.staticTexts["Set complete"].waitForExistence(timeout: 6))
        tap(app.buttons["live.finish.undo"])
        XCTAssertEqual(position.label, "1 / 1")
        XCTAssertEqual(app.staticTexts["live.played.count"].label, "0 PLAYED")
        tap(app.buttons["live.advance"])
        capture("19-live-finish-en", app)
        tap(app.buttons["live.finish.add"])
        XCTAssertEqual(position.label, "2 / 2")
        XCTAssertNotEqual(app.staticTexts["live.now.track"].label, "Low Ceiling")
        tap(app.buttons["live.pause"])

        XCTAssertTrue(app.staticTexts["Mvson — Low Ceiling"].exists)
        tap(app.buttons["set.clear"])
        tap(app.alerts.buttons["set.clear.confirm"].firstMatch)
        XCTAssertFalse(app.staticTexts["Mvson — Low Ceiling"].exists)
        tap(app.buttons["build.live"])
        XCTAssertEqual(position.label, "2 / 2", "The active queue must survive a draft clear")
        tap(app.buttons["live.advance"])
        app.terminate()
        app.launch()
        tap(app.buttons["tab.build"], timeout: 12)
        tap(app.buttons["build.live"])
        XCTAssertTrue(app.staticTexts["Set complete"].waitForExistence(timeout: 6))
        tap(app.buttons["live.finish"])
        XCTAssertEqual(app.buttons["build.live"].label, "Start Live")
        XCTAssertFalse(app.buttons["build.live"].isEnabled)
        tap(app.buttons["Saved sets"])
        tap(app.buttons.containing(.staticText, identifier: "One cue").firstMatch)
        XCTAssertTrue(app.staticTexts["Mvson — Low Ceiling"].exists)
    }

    @MainActor
    func testTargetControlsAccessibilityOrder() {
        continueAfterFailure = false
        let app = fixtureApp("offline")
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["VERTAX_TEST_CRATE"] = "timed"
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()
        tap(app.buttons["tab.settings"], timeout: 12)
        tap(app.buttons["Light"])
        tap(app.buttons["tab.build"], timeout: 12)
        tap(app.buttons["set.actions"])
        tap(app.buttons["Targeted set"])
        let ids = ["set.target.source", "set.target.genre", "set.target.duration"]
        for id in ids {
            let element = app.descendants(matching: .any)[id].firstMatch
            reveal(element, in: app)
            XCTAssertTrue(element.isHittable && !element.label.isEmpty, "\(id) must be labeled and reachable")
            XCTAssertGreaterThanOrEqual(element.frame.height, 44)
        }
        let hierarchy = app.debugDescription
        let indices = ids.compactMap { hierarchy.range(of: "identifier: '\($0)'")?.lowerBound }
        XCTAssertEqual(indices.count, ids.count)
        XCTAssertEqual(indices, indices.sorted(), "Picker order should follow source, genre, and target duration")
        capture("16-target-accessibility-controls", app)
        let apply = app.buttons["set.target.apply"]
        reveal(apply, in: app)
        XCTAssertTrue(apply.isHittable)
        capture("17-target-accessibility-preview", app)
        tap(app.buttons["Cancel"])
        XCTAssertFalse(app.buttons["Start Live"].isEnabled)
    }

    @MainActor
    func testOfflineTargetAndAnalysis() {
        continueAfterFailure = false
        let app = fixtureApp("offline")
        let token = UUID().uuidString
        let exportName = "vertax-qa-set-\(token.prefix(8))"
        app.launchEnvironment["VERTAX_TEST_STORE"] = token
        app.launchEnvironment["VERTAX_TEST_CRATE"] = "timed"
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()

        tap(app.buttons["tab.build"], timeout: 12)
        tap(app.buttons["set.actions"])
        tap(app.buttons["Targeted set"])
        tap(app.descendants(matching: .any)["set.target.duration"].firstMatch)
        tap(app.buttons["15 min"])
        tap(app.descendants(matching: .any)["set.target.genre"].firstMatch)
        tap(app.buttons["Jungle"])
        let summary = app.staticTexts["set.target.summary"]
        reveal(summary, in: app)
        XCTAssertTrue(summary.label.contains("Tracks: 2"))
        XCTAssertTrue(summary.label.contains("10:00"))
        XCTAssertTrue(app.staticTexts["Excluded because duration is unknown: 1"].exists)
        XCTAssertTrue(app.staticTexts["Included without BPM or Camelot: 1"].exists)
        capture("12-targeted-set", app)
        let apply = app.buttons["set.target.apply"]
        reveal(apply, in: app)
        tap(apply)
        XCTAssertTrue(app.staticTexts["Mvson — Low Ceiling"].exists)
        XCTAssertTrue(app.staticTexts["Test Press — Incomplete Track"].exists)

        tap(app.buttons["set.actions"])
        tap(app.buttons["Share set"])
        let copy = app.cells.matching(NSPredicate(format: "label IN %@", ["Copy", "Скопировать", "Копировать"])).firstMatch
        XCTAssertTrue(copy.waitForExistence(timeout: 10))
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ AND label CONTAINS %@", "LP.CaptionBar.BottomCaption", "BPM: Unknown")).firstMatch.exists)
        capture("13-set-share-sheet", app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
        XCTAssertTrue(copy.waitForNonExistence(timeout: 6))

        tap(app.buttons["set.actions"])
        tap(app.buttons["Export TXT"])
        let pickerSave = app.buttons["DOCPicker.actionButton"]
        XCTAssertTrue(pickerSave.waitForExistence(timeout: 10))
        let local = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage")).firstMatch
        XCTAssertTrue(local.exists, "Only write this fixture to the simulator's local Files provider")
        XCTAssertEqual(app.textFields["DOCPicker.filenameTextField"].value as? String, exportName)
        tap(pickerSave)
        XCTAssertTrue(pickerSave.waitForNonExistence(timeout: 6))
        print("VERTAX_TXT_FIXTURE: \(exportName).txt")

        tap(app.buttons["set.actions"])
        tap(app.buttons["Export TXT"])
        XCTAssertTrue(pickerSave.waitForExistence(timeout: 10))
        let picker = app.otherElements["Browse View (Picker)"]
        XCTAssertTrue(picker.exists)
        picker.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.012))
            .press(forDuration: 0.05, thenDragTo: picker.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65)))
        XCTAssertTrue(pickerSave.waitForNonExistence(timeout: 6), "Dismiss the second Files export without saving")
        XCTAssertTrue(app.staticTexts["Mvson — Low Ceiling"].exists)
        XCTAssertTrue(app.staticTexts["Test Press — Incomplete Track"].exists)
        app.terminate()
        app.launch()
        tap(app.buttons["tab.build"], timeout: 12)
        XCTAssertTrue(app.staticTexts["Test Press — Incomplete Track"].exists)

        tap(app.buttons["tab.crate"])
        type("Test Pressing", into: app.textFields["Search artist, label, cat #"], submit: false)
        tap(app.staticTexts["Test Press — Test Pressing"])
        tap(app.buttons["Check a release"])
        let coverage = app.staticTexts["release-fit.coverage"]
        XCTAssertTrue(coverage.waitForExistence(timeout: 6))
        XCTAssertTrue(coverage.label.contains("0 of 1"))
        XCTAssertTrue(app.staticTexts["Saved tracks only. The full release tracklist is unavailable."].exists)
        XCTAssertTrue(app.staticTexts["No connection. Saved tracks are still available."].exists)
        let edit = app.buttons["release-fit.edit.0"]
        reveal(edit, in: app)
        tap(edit)
        let bpm = app.textFields["fit.edit.bpm"]
        type("130", into: bpm, submit: false)
        XCTAssertFalse(app.buttons["edit.double_bpm"].isEnabled)
        replaceText(bpm, old: "130", with: "86", submit: false)
        tap(app.buttons["edit.double_bpm"])
        XCTAssertEqual(bpm.value as? String, "172")
        tap(app.buttons["edit.half_bpm"])
        XCTAssertEqual(bpm.value as? String, "86")
        tap(app.buttons["edit.double_bpm"])
        let key = app.textFields["fit.edit.camelot"]
        type("13C", into: key, submit: false)
        XCTAssertFalse(app.buttons["fit.edit.save"].isEnabled)
        replaceText(key, old: "13C", with: "9A", submit: false)
        capture("14-analysis-edit", app)
        tap(app.buttons["fit.edit.save"])
        XCTAssertTrue(coverage.label.contains("1 of 1"))
        XCTAssertTrue(app.staticTexts["release-fit.score"].exists)

        app.terminate()
        app.launch()
        tap(app.buttons["tab.build"], timeout: 12)
        XCTAssertTrue(app.staticTexts["Test Press — Incomplete Track"].exists)
        tap(app.buttons["tab.crate"])
        type("Incomplete Track", into: app.textFields["Search artist, label, cat #"], submit: false)
        tap(app.staticTexts["Test Press — Incomplete Track"])
        tap(app.buttons["record.edit-meta"])
        XCTAssertEqual(app.textFields["BPM"].value as? String, "BPM")
        XCTAssertEqual(app.textFields["Camelot"].value as? String, "8A")
        type("86", into: app.textFields["BPM"], submit: false)
        tap(app.buttons["edit.double_bpm"])
        tap(app.buttons["Save"])
        app.terminate()
        app.launch()
        tap(app.buttons["tab.crate"], timeout: 12)
        type("Incomplete Track", into: app.textFields["Search artist, label, cat #"], submit: false)
        tap(app.staticTexts["Test Press — Incomplete Track"])
        tap(app.buttons["record.edit-meta"])
        XCTAssertEqual(app.textFields["BPM"].value as? String, "172")
    }

    @MainActor
    func testReleaseLookupFailuresAndCancellation() {
        continueAfterFailure = false
        let app = fixtureApp()
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchEnvironment["VERTAX_TEST_CRATE"] = "timed"
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()
        tap(app.buttons["tab.dig"], timeout: 12)
        tap(app.buttons["release-fit.open"])
        let field = app.textFields["release-fit.query"]
        type("Timeout", into: field)
        XCTAssertTrue(app.staticTexts["The request timed out. Try again."].waitForExistence(timeout: 6))
        tap(app.buttons["release-fit.search"])
        XCTAssertTrue(app.staticTexts["The request timed out. Try again."].waitForExistence(timeout: 6))
        replaceText(field, old: "Timeout", with: "Busy")
        XCTAssertTrue(app.staticTexts["Too many requests. Wait a moment and try again."].waitForExistence(timeout: 6))
        replaceText(field, old: "Busy", with: "Empty")
        XCTAssertTrue(app.staticTexts["No vinyl editions found. Try a different title or catalog number."].waitForExistence(timeout: 6))
        replaceText(field, old: "Empty", with: "Slow")
        tap(app.buttons["release-fit.search.cancel"])
        replaceText(field, old: "Slow", with: "Calibre Even If")
        tap(app.buttons["release-fit.edition.2541196"])
        XCTAssertTrue(app.staticTexts["release-fit.coverage"].waitForExistence(timeout: 6))
        XCTAssertTrue(app.staticTexts["Too many requests. Wait a moment and try again."].waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["release-fit.coverage"].label.contains("1 of 6"))
        XCTAssertTrue(app.staticTexts["release-fit.score"].exists)
        let missing = app.buttons["release-fit.missing"]
        reveal(missing, in: app)
        tap(missing)
        let partial = app.staticTexts["174 BPM · Camelot unknown"].firstMatch
        reveal(partial, in: app)
        XCTAssertTrue(partial.exists)
        capture("15-release-partial", app)
        tap(app.navigationBars.buttons.firstMatch)
        XCTAssertFalse(app.buttons["release-fit.edition.501"].exists)
        XCTAssertTrue(app.buttons["release-fit.edition.10407820"].exists)
    }

    @MainActor
    func testReleaseFitAndCrateGaps() {
        continueAfterFailure = false
        let app = fixtureApp()
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "NO"]
        app.launch()
        tap(app.buttons["Continue"], timeout: 12)
        tap(app.buttons["Continue"])
        tap(app.buttons["Continue with demo crate"])
        tap(app.buttons["tab.dig"])
        tap(app.buttons["Gaps"])
        XCTAssertTrue(app.staticTexts["BPM + Camelot: 12 of 12 tracks"].waitForExistence(timeout: 6))
        XCTAssertTrue(app.staticTexts["Dig here next"].exists)
        capture("09-crate-gaps", app)

        tap(app.buttons["Analyze"])
        tap(app.buttons["release-fit.open"])
        type("Calibre Even If", into: app.textFields["Release title"])
        XCTAssertTrue(app.descendants(matching: .any)["discogs.attribution.2541196"].firstMatch.waitForExistence(timeout: 30))
        tap(app.buttons["release-fit.edition.2541196"], timeout: 30)
        XCTAssertTrue(app.staticTexts["release-fit.coverage"].waitForExistence(timeout: 30))
        XCTAssertTrue(app.staticTexts["This pressing has multiple formats. Only identifiable vinyl tracks are included."].exists)
        XCTAssertTrue(app.staticTexts["release-fit.score"].waitForExistence(timeout: 35))
        XCTAssertTrue((app.staticTexts["release-fit.coverage"].label).contains("of 6 tracks"))
        capture("10-release-fit", app)
        if app.buttons["release-fit.cancel"].isHittable {
            tap(app.buttons["release-fit.cancel"])
            XCTAssertTrue(app.staticTexts["release-fit.score"].exists)
            XCTAssertTrue(app.buttons["release-fit.check-more"].exists)
        }
        tap(app.navigationBars.buttons.firstMatch)

        // A different pressing must load its own heading and must not reuse a partial result.
        tap(app.buttons["release-fit.edition.10407820"])
        XCTAssertTrue(app.staticTexts["release-fit.title"].waitForExistence(timeout: 30))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "SIGLP006RP")).firstMatch.exists)
        tap(app.navigationBars.buttons.firstMatch)
        XCTAssertTrue(app.buttons["release-fit.edition.10407820"].exists)
    }

    @MainActor
    func testDigEmptyInJapanese() {
        continueAfterFailure = false
        let app = fixtureApp()
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchArguments = ["-vx_lang", "ja", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()
        tap(app.buttons["tab.dig"], timeout: 12)
        tap(app.buttons["不足"])
        XCTAssertTrue(app.staticTexts["比較できる曲がありません"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.staticTexts["Dig here next"].exists)
        capture("11-empty-gaps-ja", app)
    }

    @MainActor
    func testCrateLookupImportAndLive() {
        continueAfterFailure = false
        let app = fixtureApp()
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "NO"]
        app.launch()

        XCTAssertTrue(app.buttons["Русский"].waitForExistence(timeout: 12))
        capture("00-onboarding", app)
        tap(app.buttons["Continue"], timeout: 12)
        tap(app.buttons["Continue"])
        tap(app.buttons["Continue with demo crate"])
        XCTAssertTrue(app.staticTexts["Mvson — Cassette Ghost"].waitForExistence(timeout: 6))
        capture("01-crate", app)

        tap(app.buttons["tab.find"])
        let find = app.textFields["Artist — track title"]
        type("Calibre — Even If", into: find)
        XCTAssertTrue(app.staticTexts["Even If"].waitForExistence(timeout: 35))
        if app.buttons["Save to crate"].exists { tap(app.buttons["Save to crate"]) }
        XCTAssertTrue(app.staticTexts["Even If"].exists)
        XCTAssertTrue(app.buttons["Saved to crate"].exists)
        capture("02-find", app)

        tap(app.buttons["tab.dig"])
        type("Calibre — Even If", into: app.textFields["Artist — track title"], submit: false)
        tap(app.buttons["Check track"])
        XCTAssertTrue(app.staticTexts["Calibre — Even If"].waitForExistence(timeout: 35))
        capture("03-dig", app)

        tap(app.buttons["tab.build"])
        if app.buttons["set.clear"].exists {
            tap(app.buttons["set.clear"])
            tap(app.alerts.buttons["set.clear.confirm"].firstMatch)
        }
        tap(app.buttons["Build from crate"])
        tap(app.buttons["Start Live"])
        XCTAssertTrue(app.staticTexts["NOW PLAYING"].waitForExistence(timeout: 6))
        capture("04-live", app)
        for _ in 0..<8 { tap(app.buttons["Mark played · Next"]) }
        XCTAssertTrue(app.staticTexts["Set complete"].waitForExistence(timeout: 6))
        tap(app.buttons["live.finish"])

        tap(app.buttons["tab.find"])
        tap(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Import from Discogs")).firstMatch)
        let profile = app.textFields["Profile link or username"]
        type("Discogs", into: profile, submit: false)
        tap(app.buttons["Import collection"])
        XCTAssertTrue(app.staticTexts["This Discogs collection is private."].waitForExistence(timeout: 35))
        tap(app.buttons["Try again"])
        tap(profile)
        profile.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Discogs".count))
        profile.typeText("vinyljunkie")
        tap(app.buttons["Import collection"])
        tap(app.buttons["Go to crate"], timeout: 35)

        let crateSearch = app.textFields["Search artist, label, cat #"]
        type("!K7072LP", into: crateSearch, submit: false)
        XCTAssertTrue(app.descendants(matching: .any)["discogs.attribution.29823"].firstMatch.waitForExistence(timeout: 6))
        tap(app.staticTexts.containing(NSPredicate(format: "label ENDSWITH %@", " — Skills")).firstMatch)
        XCTAssertTrue(app.staticTexts["Can You Feel It"].waitForExistence(timeout: 35))
        capture("05-release", app)

        app.terminate()
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "YES"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Mvson — Cassette Ghost"].waitForExistence(timeout: 6))
        type("!K7072LP", into: crateSearch, submit: false)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label ENDSWITH %@", " — Skills")).firstMatch.exists)

        tap(app.buttons["tab.build"])
        tap(app.buttons["set.source"])
        tap(app.buttons["Select shown"])
        tap(app.buttons["Deselect all"])
        let save = app.buttons["set.track.save"]
        XCTAssertFalse(save.isEnabled)
        type("Calibre", into: app.textFields["Search artist or track"])
        tap(app.staticTexts["Calibre — Even If"])
        XCTAssertEqual(save.label, "Save (1)")
        tap(app.buttons["Records"])
        XCTAssertEqual(save.label, "Save (1)")
        XCTAssertTrue(app.staticTexts["set.selection.hidden"].exists)
        tap(app.buttons["Tracks"])
        XCTAssertEqual(save.label, "Save (1)")
        tap(save)
        tap(app.buttons["Sort set"])
        tap(app.buttons["Camelot"])
        XCTAssertTrue(app.staticTexts["Calibre — Even If"].exists)
        capture("06-build", app)

        tap(app.buttons["Save set"])
        type("Late shift", into: app.textFields["Set name"], submit: false)
        tap(app.alerts.buttons["Save"])
        tap(app.buttons["set.clear"])
        tap(app.alerts.buttons["set.clear.confirm"].firstMatch)
        tap(app.buttons["Saved sets"])
        tap(app.staticTexts["Late shift"].firstMatch)
        XCTAssertTrue(app.staticTexts["Calibre — Even If"].exists)
    }

    @MainActor
    func testDiscogsEditionSelection() {
        continueAfterFailure = false
        let app = fixtureApp()
        app.launchEnvironment["VERTAX_TEST_STORE"] = UUID().uuidString
        app.launch()
        tap(app.buttons["Skip — just look around"], timeout: 12)
        tap(app.buttons["tab.find"])
        tap(app.buttons["discogs.editions"])
        type("Calibre Second Sun", into: app.textFields["Release title"])
        XCTAssertTrue(app.buttons["discogs.edition.522676"].waitForExistence(timeout: 25))
        XCTAssertTrue(app.descendants(matching: .any)["discogs.attribution.522676"].firstMatch.exists)
        XCTAssertTrue(app.buttons["discogs.edition.1356823"].exists)
        capture("07-discogs-editions", app)
        tap(app.buttons["Catalog number"])
        let catalog = app.textFields["Catalog number"]
        type("K7072LP", into: catalog)
        tap(app.buttons["discogs.edition.29823"], timeout: 25)
        XCTAssertTrue(app.staticTexts["Skills"].waitForExistence(timeout: 25))
        XCTAssertTrue(app.staticTexts["Can You Feel It"].waitForExistence(timeout: 25))
    }

    @MainActor
    func testNativeFilesBackupRoundTrip() {
        continueAfterFailure = false
        let app = fixtureApp()
        let testID = UUID().uuidString
        let filename = "vertax-qa-\(testID.prefix(8))"
        app.launchEnvironment["VERTAX_TEST_STORE"] = testID
        app.launchArguments = ["-vx_lang", "en", "-vertax.native.onboarding.dismissed.v1", "NO"]
        app.launch()
        tap(app.buttons["Continue"], timeout: 12)
        tap(app.buttons["Continue"])
        tap(app.buttons["Continue with demo crate"])
        tap(app.buttons["tab.build"])
        tap(app.buttons["Build from crate"])
        tap(app.buttons["Save set"])
        type("Portable set", into: app.textFields["Set name"], submit: false)
        tap(app.alerts.buttons["Save"])
        tap(app.buttons["build.live"])
        tap(app.buttons["live.advance"])
        tap(app.buttons["live.pause"])
        XCTAssertEqual(app.buttons["build.live"].label, "Resume Live")
        tap(app.buttons["tab.settings"])
        reveal(app.buttons["backup.export"], in: app)
        tap(app.buttons["backup.export"])
        let pickerSave = app.buttons["DOCPicker.actionButton"]
        XCTAssertTrue(pickerSave.waitForExistence(timeout: 15))
        let local = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage")).firstMatch
        XCTAssertTrue(local.exists, "Only write this fixture to the simulator's local Files provider")
        XCTAssertEqual(app.textFields["DOCPicker.filenameTextField"].value as? String, filename)
        tap(pickerSave)
        XCTAssertTrue(pickerSave.waitForNonExistence(timeout: 6))
        reveal(app.buttons["backup.clear"], in: app)
        tap(app.buttons["backup.clear"])
        tap(app.buttons["Clear local data"])
        tap(app.buttons["tab.crate"])
        XCTAssertTrue(app.staticTexts["No records match"].waitForExistence(timeout: 6))
        XCTAssertFalse(app.buttons["crate.live"].isEnabled)
        tap(app.buttons["tab.settings"])
        reveal(app.buttons["backup.restore"], in: app)
        tap(app.buttons["backup.restore"])
        let backup = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@ OR label == %@", filename, filename + ".json")).firstMatch
        XCTAssertTrue(backup.waitForExistence(timeout: 15))
        let fileCell = app.cells.containing(.staticText, identifier: filename + ".json").firstMatch
        if fileCell.exists {
            fileCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).tap()
        } else {
            backup.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                .withOffset(CGVector(dx: 0, dy: -50)).tap()
        }
        let confirmation = app.sheets["Restore collection"]
        let merge = confirmation.buttons["Add from backup"]
        let counts = "Entries: 12 · Sets: 1"
        let preview = confirmation.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", counts)).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 10))
        XCTAssertTrue(backup.waitForNonExistence(timeout: 6), "Files picker did not dismiss")
        waitForStableHitTarget(merge)
        merge.tap()
        XCTAssertTrue(confirmation.waitForNonExistence(timeout: 6), "Restore confirmation stayed open after tapping Add from backup")
        XCTAssertTrue(app.alerts.staticTexts[counts].waitForExistence(timeout: 6), "Restore did not report adding the demo crate and named set")
        tap(app.alerts.buttons["OK"])
        tap(app.buttons["tab.crate"])
        XCTAssertTrue(app.staticTexts["Mvson — Cassette Ghost"].waitForExistence(timeout: 6))
        tap(app.buttons["tab.build"])
        XCTAssertEqual(app.buttons["build.live"].label, "Start Live")
        tap(app.buttons["Saved sets"])
        XCTAssertTrue(app.staticTexts["Portable set"].waitForExistence(timeout: 6))
        capture("08-restored-saved-set", app)
    }

    @MainActor
    private func fixtureApp(_ network: String = "mock") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["VERTAX_TEST_NETWORK"] = network
        return app
    }

    @MainActor
    private func replaceText(_ field: XCUIElement, old: String, with new: String, submit: Bool = true) {
        tap(field)
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old.count) + new + (submit ? "\n" : ""))
    }

    @MainActor
    private func waitForStableHitTarget(_ element: XCUIElement) {
        // Files dismissal and the anchored confirmation animate separately.
        var lastFrame = CGRect.null
        var stableSince = 0.0
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard element.exists, element.isHittable, element.isEnabled else {
                lastFrame = .null
                return false
            }
            let now = ProcessInfo.processInfo.systemUptime
            let frame = element.frame
            guard !frame.isEmpty else { return false }
            if frame != lastFrame {
                lastFrame = frame
                stableSince = now
                return false
            }
            return now - stableSince >= 0.4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 6), .completed, "Restore action did not become stable and hittable")
    }

    @MainActor
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<5 {
            if element.isHittable, element.frame.midY < app.frame.height * 0.9 { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.73))
                .press(forDuration: 0.03, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.42)))
        }
    }

    @MainActor
    private func tap(_ element: XCUIElement, timeout: TimeInterval = 6) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Missing \(element)")
        element.tap()
    }

    @MainActor
    private func type(_ value: String, into field: XCUIElement, submit: Bool = true) {
        tap(field)
        field.typeText(value + (submit ? "\n" : ""))
    }

    @MainActor
    private func capture(_ name: String, _ app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
