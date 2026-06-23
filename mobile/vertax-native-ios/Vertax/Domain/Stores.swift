import SwiftUI

// MARK: - Lightweight prototype i18n

public enum L {
    public static func t(_ key: String, _ lang: String) -> String {
        strings[lang]?[key] ?? strings["en"]?[key] ?? key
    }

    private static let strings: [String: [String: String]] = [
        "en": [
            "tab.crate": "Crate",
            "tab.find": "Find",
            "tab.build": "Build",
            "tab.dig": "Dig",
            "tab.wishlist": "Wish",
            "tab.settings": "Settings",
            "common.records": "RECORDS",
            "common.labels": "LABELS",
            "common.shown": "shown",
            "search.crate": "Search artist, label, cat #",
            "search.find": "Artist, title or catalog #",
            "filter.all": "All",
            "onboarding.choose_language": "Choose language",
            "onboarding.hero_title": "A smart crate for\nvinyl DJs.",
            "onboarding.hero_body": "Vertax knows your collection — what you own, what fits the record in your hand, and what to dig next.",
            "onboarding.smart_kicker": "THE SMART PART",
            "onboarding.smart_title": "Math decides the fit.\nVertax explains it.",
            "onboarding.smart_hint": "Fills your 170–174 / 8A bridge.",
            "onboarding.start_title": "Start your crate",
            "onboarding.start_body": "Bring your records in — or look around first with a demo.",
            "onboarding.start_card": "Import from Discogs, add manually, or continue with the sample crate.",
            "action.continue": "Continue",
            "action.demo_crate": "Continue with demo crate",
            "action.import_discogs": "Import from Discogs",
            "action.skip": "Skip — just look around",
            "crate.title": "Crate",
            "crate.sorted": "Sorted by tempo",
            "crate.empty_title": "No records match",
            "crate.empty_body": "Try clearing filters or searching a different label.",
            "find.title": "Find",
            "find.not_found": "No reliable match",
            "find.loading": "Checking Vertax BPM/Key…",
            "find.not_found_body": "Could not confirm BPM & key. Try artist — title or add it manually.",
            "find.confidence": "Confidence",
            "find.source": "Source",
            "find.label_cat": "Label · Cat",
            "find.save_crate": "Save to crate",
            "find.saved_crate": "Saved to crate",
            "find.use_set": "Use in set",
            "find.new_search": "New search",
            "build.title": "Warehouse",
            "build.start_live": "Start Live",
            "build.auto": "Auto",
            "build.manual": "Manual",
            "build.from_crate": "Build from crate",
            "build.clear": "Clear",
            "dig.title": "Dig",
            "dig.analyze": "Analyze",
            "dig.gaps": "Gaps",
            "wishlist.title": "Wishlist",
            "wishlist.kicker": "DIG · SAVED RELEASES",
            "wishlist.empty_title": "Wishlist is empty",
            "wishlist.empty_body": "Save records from release actions and they will appear here.",
            "settings.title": "Settings",
            "settings.language": "Language",
            "settings.theme": "Theme",
            "settings.dark": "Dark",
            "settings.light": "Light",
            "settings.density": "Density",
            "settings.import": "Import from Discogs",
            "settings.export": "Export collection",
            "settings.about": "About Vertax",
            "live.end": "End",
            "live.time": "TIME IN SET",
            "live.now": "NOW PLAYING",
            "live.played": "PLAYED",
            "live.next": "NEXT",
            "live.suggested": "SUGGESTED FROM CRATE",
            "live.from_now": "FROM NOW",
            "live.affordance": "SWIPE OR PRESS NEXT WHEN MIXED IN",
            "live.complete_title": "Set complete",
            "live.complete_body": "Nice run. Add one more from suggestions below, restart the set, or leave Live Mode.",
            "live.add_more": "Add more",
            "live.mark_next": "Mark played · Next",
            "record.add_to_set": "Add to set",
            "record.in_set": "In your set",
            "record.find_similar": "Find similar to dig",
            "record.edit_meta": "Edit BPM / Key / Side",
            "record.save_wishlist": "Save to wishlist",
            "record.remove_wishlist": "Remove from wishlist",
            "action.cancel": "Cancel",
            "action.save": "Save",
            "edit.title": "Edit track",
            "edit.section": "Track metadata",
            "edit.note": "Saved on this device. Server sync will be added after the native data model stabilizes.",
            "import.title": "Import from Discogs",
            "import.subtitle": "Yours or anyone's public collection",
            "import.placeholder": "Profile link or username",
            "import.body": "Vertax pulls every release — artist, label, catalog # and year — then matches BPM & Camelot key automatically. Your collection stays on device.",
            "import.button": "Import collection",
            "import.done": "Collection imported",
            "import.failed": "Import failed",
            "import.retry": "Try again",
            "import.go_crate": "Go to crate",
            "common.analyzed": "ANALYZED"
        ],
        "ru": [
            "tab.crate": "Ящик",
            "tab.find": "Найти",
            "tab.build": "Сет",
            "tab.dig": "Докопать",
            "tab.wishlist": "Виш",
            "tab.settings": "Настр.",
            "common.records": "ПЛАСТИНОК",
            "common.labels": "ЛЕЙБЛОВ",
            "common.shown": "показано",
            "search.crate": "Артист, лейбл, кат. номер",
            "search.find": "Артист, трек или кат. номер",
            "filter.all": "Все",
            "onboarding.choose_language": "Выбери язык",
            "onboarding.hero_title": "Умный ящик\nдля vinyl DJ.",
            "onboarding.hero_body": "Vertax знает твою коллекцию: что у тебя есть, что подходит к пластинке в руках и что стоит докопать.",
            "onboarding.smart_kicker": "УМНАЯ ЧАСТЬ",
            "onboarding.smart_title": "Совместимость считает математика.\nVertax объясняет результат.",
            "onboarding.smart_hint": "Закрывает мост 170–174 / 8A.",
            "onboarding.start_title": "Начни собирать ящик",
            "onboarding.start_body": "Импортируй коллекцию или сначала посмотри демо.",
            "onboarding.start_card": "Импорт из Discogs, ручное добавление или демо-коллекция.",
            "action.continue": "Дальше",
            "action.demo_crate": "Открыть демо-ящик",
            "action.import_discogs": "Импорт из Discogs",
            "action.skip": "Пропустить и посмотреть",
            "crate.title": "Ящик",
            "crate.sorted": "По темпу",
            "crate.empty_title": "Ничего не найдено",
            "crate.empty_body": "Сбрось фильтры или попробуй другой лейбл.",
            "find.title": "Найти",
            "find.not_found": "Надёжного совпадения нет",
            "find.loading": "Проверяю Vertax BPM/Key…",
            "find.not_found_body": "Не удалось подтвердить BPM и Key. Попробуй формат артист — трек или добавь вручную.",
            "find.confidence": "Уверенность",
            "find.source": "Источник",
            "find.label_cat": "Лейбл · Кат.",
            "find.save_crate": "В ящик",
            "find.saved_crate": "В ящике",
            "find.use_set": "В сет",
            "find.new_search": "Новый поиск",
            "build.title": "Собрать сет",
            "build.start_live": "Играть",
            "build.auto": "Авто",
            "build.manual": "Вручную",
            "build.from_crate": "Собрать из ящика",
            "build.clear": "Очистить",
            "dig.title": "Докопать",
            "dig.analyze": "Проверить",
            "dig.gaps": "Пробелы",
            "wishlist.title": "Вишлист",
            "wishlist.kicker": "DIG · СОХРАНЁННЫЕ РЕЛИЗЫ",
            "wishlist.empty_title": "Вишлист пуст",
            "wishlist.empty_body": "Сохраняй пластинки из меню релиза, и они появятся здесь.",
            "settings.title": "Настройки",
            "settings.language": "Язык",
            "settings.theme": "Тема",
            "settings.dark": "Тёмная",
            "settings.light": "Светлая",
            "settings.density": "Плотность",
            "settings.import": "Импорт из Discogs",
            "settings.export": "Экспорт коллекции",
            "settings.about": "О Vertax",
            "live.end": "Завершить",
            "live.time": "ВРЕМЯ СЕТА",
            "live.now": "ИГРАЕТ СЕЙЧАС",
            "live.played": "СЫГРАНО",
            "live.next": "ДАЛЬШЕ",
            "live.suggested": "ПОДХОДИТ ИЗ ЯЩИКА",
            "live.from_now": "ОТ ТЕКУЩЕГО",
            "live.affordance": "СВАЙПНИ ИЛИ ЖМИ NEXT ПОСЛЕ СВЕДЕНИЯ",
            "live.complete_title": "Сет доигран",
            "live.complete_body": "Красиво. Можно добавить ещё трек из подсказок ниже или завершить Live Mode.",
            "live.add_more": "Добавить ещё",
            "live.mark_next": "Сыграно · дальше",
            "record.add_to_set": "Добавить в сет",
            "record.in_set": "Уже в сете",
            "record.find_similar": "Найти похожее",
            "record.edit_meta": "Править BPM / Key / сторону",
            "record.save_wishlist": "В вишлист",
            "record.remove_wishlist": "Убрать из вишлиста",
            "action.cancel": "Отмена",
            "action.save": "Сохранить",
            "edit.title": "Правка трека",
            "edit.section": "Метаданные трека",
            "edit.note": "Сохраняется на этом устройстве. Серверный синк добавим после стабилизации нативной модели данных.",
            "import.title": "Импорт из Discogs",
            "import.subtitle": "Твоя или любая публичная коллекция",
            "import.placeholder": "Ссылка профиля или username",
            "import.body": "Vertax загрузит релизы, артистов, лейблы, каталожные номера и год, а потом автоматически сопоставит BPM и Camelot. Коллекция остаётся на устройстве.",
            "import.button": "Импортировать коллекцию",
            "import.done": "Коллекция импортирована",
            "import.failed": "Импорт не получился",
            "import.retry": "Попробовать ещё",
            "import.go_crate": "Перейти в ящик",
            "common.analyzed": "ПРОВЕРЕНО"
        ],
        "zh": [
            "tab.crate": "唱片箱",
            "tab.find": "搜索",
            "tab.build": "编排",
            "tab.dig": "挖掘",
            "tab.wishlist": "想要",
            "tab.settings": "设置",
            "common.records": "张唱片",
            "common.labels": "厂牌",
            "common.shown": "显示",
            "search.crate": "搜索艺人、厂牌、编号",
            "search.find": "艺人、曲名或编号",
            "filter.all": "全部",
            "onboarding.choose_language": "选择语言",
            "onboarding.hero_title": "给黑胶 DJ 的\n智能唱片箱。",
            "onboarding.hero_body": "Vertax 了解你的收藏：你拥有什么、手上的唱片适合什么、下一张该挖什么。",
            "onboarding.smart_kicker": "智能部分",
            "onboarding.smart_title": "数学计算匹配度。\nVertax 解释结果。",
            "onboarding.smart_hint": "补上 170–174 / 8A 的桥。",
            "onboarding.start_title": "开始你的唱片箱",
            "onboarding.start_body": "导入收藏，或先用演示数据看看。",
            "onboarding.start_card": "从 Discogs 导入、手动添加，或继续使用演示唱片箱。",
            "action.continue": "继续",
            "action.demo_crate": "进入演示唱片箱",
            "action.import_discogs": "从 Discogs 导入",
            "action.skip": "跳过，先看看",
            "crate.title": "唱片箱",
            "crate.sorted": "按速度排序",
            "crate.empty_title": "没有匹配的唱片",
            "crate.empty_body": "清除筛选，或试试其他厂牌。",
            "find.title": "搜索",
            "find.not_found": "没有可靠匹配",
            "find.loading": "正在检查 Vertax BPM/Key…",
            "find.not_found_body": "无法确认 BPM 和 Key。试试“艺人 — 曲名”格式，或手动添加。",
            "find.confidence": "置信度",
            "find.source": "来源",
            "find.label_cat": "厂牌 · 编号",
            "find.save_crate": "存入唱片箱",
            "find.saved_crate": "已存入",
            "find.use_set": "加入 Set",
            "find.new_search": "重新搜索",
            "build.title": "编排 Set",
            "build.start_live": "开始 Live",
            "build.auto": "自动",
            "build.manual": "手动",
            "build.from_crate": "从唱片箱生成",
            "build.clear": "清空",
            "dig.title": "Dig",
            "dig.analyze": "分析",
            "dig.gaps": "缺口",
            "wishlist.title": "愿望单",
            "wishlist.kicker": "DIG · 已保存发行",
            "wishlist.empty_title": "愿望单为空",
            "wishlist.empty_body": "在发行菜单里保存唱片后，会显示在这里。",
            "settings.title": "设置",
            "settings.language": "语言",
            "settings.theme": "主题",
            "settings.dark": "深色",
            "settings.light": "浅色",
            "settings.density": "密度",
            "settings.import": "从 Discogs 导入",
            "settings.export": "导出收藏",
            "settings.about": "关于 Vertax",
            "live.end": "结束",
            "live.time": "SET 时间",
            "live.now": "正在播放",
            "live.played": "已播放",
            "live.next": "下一个",
            "live.suggested": "唱片箱推荐",
            "live.from_now": "从当前曲目",
            "live.affordance": "混入后滑动或点击 NEXT",
            "live.complete_title": "Set 完成",
            "live.complete_body": "不错。可以从下方推荐再加一首，或退出 Live Mode。",
            "live.add_more": "再加一首",
            "live.mark_next": "标记已播 · 下一个",
            "record.add_to_set": "加入 set",
            "record.in_set": "已在 set 中",
            "record.find_similar": "找相似唱片",
            "record.edit_meta": "编辑 BPM / Key / 面",
            "record.save_wishlist": "加入愿望单",
            "record.remove_wishlist": "移出愿望单",
            "action.cancel": "取消",
            "action.save": "保存",
            "edit.title": "编辑曲目",
            "edit.section": "曲目元数据",
            "edit.note": "已保存在此设备上。原生数据模型稳定后会加入服务器同步。",
            "import.title": "从 Discogs 导入",
            "import.subtitle": "你的或任何公开收藏",
            "import.placeholder": "个人主页链接或用户名",
            "import.body": "Vertax 会读取发行、艺人、厂牌、编号和年份，然后自动匹配 BPM 与 Camelot。收藏保留在设备上。",
            "import.button": "导入收藏",
            "import.done": "收藏已导入",
            "import.failed": "导入失败",
            "import.retry": "重试",
            "import.go_crate": "回到唱片箱",
            "common.analyzed": "已分析"
        ],
        "ja": [
            "tab.crate": "箱",
            "tab.find": "検索",
            "tab.build": "Set",
            "tab.dig": "Dig",
            "tab.wishlist": "欲しい",
            "tab.settings": "設定",
            "common.records": "枚",
            "common.labels": "レーベル",
            "common.shown": "表示",
            "search.crate": "アーティスト、レーベル、品番",
            "search.find": "アーティスト、曲名、品番",
            "filter.all": "全て",
            "onboarding.choose_language": "言語を選択",
            "onboarding.hero_title": "ヴァイナルDJのための\nスマートCrate。",
            "onboarding.hero_body": "Vertax はあなたのコレクション、手元のレコードとの相性、次に掘るべき方向を把握します。",
            "onboarding.smart_kicker": "スマート機能",
            "onboarding.smart_title": "相性は数学で計算。\nVertax が結果を説明します。",
            "onboarding.smart_hint": "170–174 / 8A の橋渡しに合います。",
            "onboarding.start_title": "Crate を始める",
            "onboarding.start_body": "コレクションを読み込むか、まずはデモで確認。",
            "onboarding.start_card": "Discogs インポート、手動追加、またはデモCrateで続行。",
            "action.continue": "続ける",
            "action.demo_crate": "デモCrateで続ける",
            "action.import_discogs": "Discogsから読み込む",
            "action.skip": "スキップして見る",
            "crate.title": "Crate",
            "crate.sorted": "テンポ順",
            "crate.empty_title": "一致するレコードがありません",
            "crate.empty_body": "フィルターを解除するか、別のレーベルで検索してください。",
            "find.title": "検索",
            "find.not_found": "信頼できる一致なし",
            "find.loading": "Vertax BPM/Key を確認中…",
            "find.not_found_body": "BPM と Key を確認できませんでした。アーティスト — 曲名で試すか、手動で追加してください。",
            "find.confidence": "信頼度",
            "find.source": "ソース",
            "find.label_cat": "レーベル · 品番",
            "find.save_crate": "Crateに保存",
            "find.saved_crate": "保存済み",
            "find.use_set": "Setで使う",
            "find.new_search": "新規検索",
            "build.title": "Set作成",
            "build.start_live": "Live開始",
            "build.auto": "自動",
            "build.manual": "手動",
            "build.from_crate": "Crateから作成",
            "build.clear": "クリア",
            "dig.title": "Dig",
            "dig.analyze": "分析",
            "dig.gaps": "不足",
            "wishlist.title": "Wishlist",
            "wishlist.kicker": "DIG · 保存したリリース",
            "wishlist.empty_title": "Wishlist は空です",
            "wishlist.empty_body": "リリースメニューから保存すると、ここに表示されます。",
            "settings.title": "設定",
            "settings.language": "言語",
            "settings.theme": "テーマ",
            "settings.dark": "ダーク",
            "settings.light": "ライト",
            "settings.density": "密度",
            "settings.import": "Discogsから読み込む",
            "settings.export": "コレクションを書き出す",
            "settings.about": "Vertaxについて",
            "live.end": "終了",
            "live.time": "SET時間",
            "live.now": "再生中",
            "live.played": "再生済み",
            "live.next": "次",
            "live.suggested": "Crateからおすすめ",
            "live.from_now": "現在から",
            "live.affordance": "ミックス後にスワイプ、または NEXT",
            "live.complete_title": "Set完了",
            "live.complete_body": "いい流れです。下の候補から追加するか、Live Mode を終了できます。",
            "live.add_more": "追加する",
            "live.mark_next": "再生済み · 次へ",
            "record.add_to_set": "Setに追加",
            "record.in_set": "Setに追加済み",
            "record.find_similar": "似たものを探す",
            "record.edit_meta": "BPM / Key / 面を編集",
            "record.save_wishlist": "Wishlistに保存",
            "record.remove_wishlist": "Wishlistから削除",
            "action.cancel": "キャンセル",
            "action.save": "保存",
            "edit.title": "曲を編集",
            "edit.section": "曲メタデータ",
            "edit.note": "この端末に保存されます。ネイティブのデータモデルが安定した後、サーバー同期を追加します。",
            "import.title": "Discogsから読み込む",
            "import.subtitle": "自分、または公開コレクション",
            "import.placeholder": "プロフィールURLまたはユーザー名",
            "import.body": "Vertax はリリース、アーティスト、レーベル、品番、年を読み込み、BPM と Camelot を自動で照合します。コレクションは端末内に残ります。",
            "import.button": "コレクションを読み込む",
            "import.done": "読み込み完了",
            "import.failed": "読み込み失敗",
            "import.retry": "もう一度試す",
            "import.go_crate": "Crateへ",
            "common.analyzed": "分析済み"
        ]
    ]
}

// MARK: - App-level stores & router

private enum VertaxLocalStore {
    private static let defaults = UserDefaults.standard

    static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}

public final class CrateStore: ObservableObject {
    private static let storageKey = "vertax.native.crate.records.v1"
    @Published public var records: [Record] {
        didSet { VertaxLocalStore.save(records, key: Self.storageKey) }
    }

    public init(records: [Record]? = nil) {
        self.records = records
            ?? VertaxLocalStore.load([Record].self, key: Self.storageKey)
            ?? Record.sample
    }

    public func add(_ r: Record) {
        if let index = records.firstIndex(where: { $0.id == r.id }) {
            records[index] = r
        } else {
            records.insert(r, at: 0)
        }
    }
    public func update(_ record: Record) {
        guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
        records[index] = record
    }

    /// Filtered + tempo-sorted view used by CrateView.
    public func filtered(query: String, chips: Set<CrateFilter>) -> [Record] {
        var list = records
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            list = list.filter {
                "\($0.artist) \($0.title) \($0.label) \($0.catalog) \($0.genre)".lowercased().contains(q)
            }
        }
        // chips of the same KIND are OR'd; different kinds are AND'd
        let byKind = Dictionary(grouping: chips, by: { $0.kind })
        for (_, group) in byKind {
            list = list.filter { rec in group.contains { $0.matches(rec) } }
        }
        return list.sorted { $0.bpm > $1.bpm }
    }
}

public final class SetStore: ObservableObject {
    private static let storageKey = "vertax.native.set.ordered_ids.v1"
    @Published public var orderedIDs: [String] {
        didSet { VertaxLocalStore.save(orderedIDs, key: Self.storageKey) }
    }

    public init(orderedIDs: [String]? = nil) {
        self.orderedIDs = orderedIDs
            ?? VertaxLocalStore.load([String].self, key: Self.storageKey)
            ?? ["r3","r1","r11","r5"]
    }

    public func records(in crate: CrateStore) -> [Record] {
        orderedIDs.compactMap { id in crate.records.first { $0.id == id } }
    }
    public func add(_ id: String) { if !orderedIDs.contains(id) { orderedIDs.append(id) } }
    public func remove(_ id: String) { orderedIDs.removeAll { $0 == id } }
    public func move(from: IndexSet, to: Int) { orderedIDs.move(fromOffsets: from, toOffset: to) }
    public func clear() { orderedIDs.removeAll() }
    public func autoBuild(from records: [Record], limit: Int = 8) {
        let sorted = records.sorted { left, right in
            if left.bpm != right.bpm { return left.bpm < right.bpm }
            return left.keyCode < right.keyCode
        }
        orderedIDs = Array(sorted.prefix(limit).map(\.id))
    }
}

public final class WishlistStore: ObservableObject {
    private static let storageKey = "vertax.native.wishlist.record_ids.v1"
    @Published public var recordIDs: [String] {
        didSet { VertaxLocalStore.save(recordIDs, key: Self.storageKey) }
    }

    public init(recordIDs: [String]? = nil) {
        self.recordIDs = recordIDs
            ?? VertaxLocalStore.load([String].self, key: Self.storageKey)
            ?? []
    }
    public func contains(_ id: String) -> Bool { recordIDs.contains(id) }
    public func add(_ id: String) { if !recordIDs.contains(id) { recordIDs.insert(id, at: 0) } }
    public func remove(_ id: String) { recordIDs.removeAll { $0 == id } }
    public func toggle(_ id: String) { contains(id) ? remove(id) : add(id) }
}

// MARK: - Filters

public struct CrateFilter: Hashable, Identifiable {
    public enum Kind: Hashable { case bpm, key, genre, flag }
    public let id: String
    public let label: String
    public let kind: Kind
    let predicate: (Record) -> Bool
    public func matches(_ r: Record) -> Bool { predicate(r) }
    public static func == (l: CrateFilter, r: CrateFilter) -> Bool { l.id == r.id }
    public func hash(into h: inout Hasher) { h.combine(id) }

    public static let all: [CrateFilter] = [
        .init(id:"bpm1", label:"168–174", kind:.bpm) { (168...174).contains($0.bpm) },
        .init(id:"bpm2", label:"84–90",  kind:.bpm) { (84...90).contains($0.bpm) },
        .init(id:"k8a",  label:"8A",     kind:.key) { $0.keyCode == "8A" },
        .init(id:"k9a",  label:"9A",     kind:.key) { $0.keyCode == "9A" },
        .init(id:"gjun", label:"Jungle", kind:.genre) { $0.genre == "Jungle" },
        .init(id:"gliq", label:"Liquid", kind:.genre) { $0.genre == "Liquid" },
        .init(id:"gatm", label:"Atmospheric", kind:.genre) { $0.genre == "Atmospheric" },
        .init(id:"unpl", label:"Unplayed", kind:.flag) { !$0.played },
    ]
}

// MARK: - Router

public final class AppRouter: ObservableObject {
    private static let onboardingKey = "vertax.native.onboarding.dismissed.v1"
    public enum Tab: Hashable { case crate, find, build, dig, wishlist, settings }
    @Published public var tab: Tab = .crate

    // per-tab navigation stacks
    @Published public var cratePath = NavigationPath()
    @Published public var findPath  = NavigationPath()
    @Published public var buildPath = NavigationPath()
    @Published public var digPath   = NavigationPath()

    // modals
    @Published public var sheet: AppSheet?
    @Published public var showOnboarding: Bool {
        didSet { UserDefaults.standard.set(!showOnboarding, forKey: Self.onboardingKey) }
    }
    @Published public var showLiveSet = false   // reserved — next milestone

    public init() {
        self.showOnboarding = !UserDefaults.standard.bool(forKey: Self.onboardingKey)
    }
    public func openRelease(_ r: Record) {
        switch tab {
        case .crate: cratePath.append(r)
        case .build: buildPath.append(r)
        case .dig:   digPath.append(r)
        case .find:  findPath.append(r)
        case .wishlist, .settings: cratePath.append(r)
        }
    }
}

public enum AppSheet: Identifiable {
    case recordActions(Record)
    case editRecord(Record)
    case discogsImport
    case settings
    public var id: String {
        switch self {
        case .recordActions(let r): return "rec-\(r.id)"
        case .editRecord(let r): return "edit-\(r.id)"
        case .discogsImport: return "discogs-import"
        case .settings: return "settings"
        }
    }
}
