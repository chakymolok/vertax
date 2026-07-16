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
            "common.demo": "Load demo crate",
            "common.clear": "Clear local data",
            "common.version": "Version 1.0",
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
            "onboarding.start_body": "Bring your records in from Discogs, or try Vertax with a demo crate first.",
            "onboarding.start_card": "Import from Discogs, search BPM/Key, save records, and build your first set.",
            "action.continue": "Continue",
            "action.demo_crate": "Continue with demo crate",
            "action.import_discogs": "Import from Discogs",
            "action.skip": "Skip — just look around",
            "crate.title": "Crate",
            "crate.sorted": "Sorted by tempo",
            "crate.empty_title": "No records match",
            "crate.empty_body": "Import from Discogs, save a BPM/Key lookup, or load the demo crate.",
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
            "find.recent": "Recent",
            "find.recent_hint": "Tap to look up again",
            "find.import_hint": "Pull a whole collection by profile link",
            "build.title": "Warehouse",
            "build.start_live": "Start Live",
            "build.auto": "Auto",
            "build.manual": "Manual",
            "build.from_crate": "Build from crate",
            "build.clear": "Clear",
            "build.no_crate_title": "Your crate is empty",
            "build.no_crate_body": "Import your Discogs collection or load the demo crate before building a set.",
            "build.empty_title": "No set yet",
            "build.empty_body": "Build a tempo-sorted set from your crate, or add records manually from release actions.",
            "build.opener": "Opener · first record",
            "dig.title": "Dig",
            "dig.analyze": "Analyze",
            "dig.gaps": "Gaps",
            "dig.empty_title": "No records yet",
            "dig.empty_body": "Import from Discogs or save a BPM/Key lookup to start analyzing.",
            "dig.tempo_coverage": "Tempo coverage",
            "dig.records_bpm": "RECORDS / BPM",
            "dig.camelot_map": "Camelot map",
            "dig.minor_row": "A · MINOR ROW",
            "dig.next": "Dig here next",
            "dig.suggestion_1_title": "174–178 · 9A",
            "dig.suggestion_1_body": "Thin bridge after your 170–174 core",
            "dig.suggestion_2_title": "11A · cold keys",
            "dig.suggestion_2_body": "Useful harmonic exit from 12A and 10A",
            "dig.suggestion_3_title": "Halftime · 84–90",
            "dig.suggestion_3_body": "Strong opener pool, still easy to expand",
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
            "settings.demo": "Load demo crate",
            "settings.clear_local": "Clear local crate, set and wishlist",
            "settings.appearance": "APPEARANCE",
            "settings.general": "GENERAL",
            "settings.data": "COLLECTION & DATA",
            "settings.privacy": "PRIVACY",
            "settings.support": "SUPPORT",
            "settings.accent": "Accent",
            "settings.default_bpm": "Default BPM range",
            "settings.import_hint": "Re-sync or add a collection",
            "settings.export_hint": "Share crate JSON",
            "settings.local_only": "Keep collection on device",
            "settings.no_cloud": "No cloud sync",
            "settings.support_author": "Support the author",
            "settings.support_hint": "Tip to keep Vertax independent",
            "settings.about_body": "A smart crate assistant for vinyl DJs.",
            "settings.about_title": "About",
            "live.end": "End",
            "live.time": "TIME IN SET",
            "live.now": "NOW PLAYING",
            "live.set_mode": "SET",
            "live.free_mode": "FREE",
            "live.sleeve": "SLEEVE",
            "live.setlist": "SETLIST",
            "live.crate_queue": "CRATE QUEUE",
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
            "release.tempo": "Tempo",
            "release.tracklist": "Tracklist",
            "release.tracks": "tracks",
            "release.mixes_well": "Mixes well into",
            "release.in_crate": "in crate",
            "release.notes": "Notes",
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
            "import.step_profile": "Fetching Discogs profile",
            "import.step_collection": "Reading collection",
            "import.step_matching": "Matching BPM & Key",
            "import.step_crate": "Building your crate",
            "import.done": "Collection imported",
            "import.failed": "Import failed",
            "import.empty": "No public records found for this Discogs profile.",
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
            "common.demo": "Загрузить демо-ящик",
            "common.clear": "Очистить локальные данные",
            "common.version": "Версия 1.0",
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
            "onboarding.start_body": "Импортируй коллекцию из Discogs или сначала попробуй Vertax с демо-ящиком.",
            "onboarding.start_card": "Импортируй Discogs, ищи BPM/Key, сохраняй пластинки и собирай первый сет.",
            "action.continue": "Дальше",
            "action.demo_crate": "Открыть демо-ящик",
            "action.import_discogs": "Импорт из Discogs",
            "action.skip": "Пропустить и посмотреть",
            "crate.title": "Ящик",
            "crate.sorted": "По темпу",
            "crate.empty_title": "Ничего не найдено",
            "crate.empty_body": "Импортируй Discogs, сохрани результат BPM/Key или загрузи демо-ящик.",
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
            "find.recent": "Недавнее",
            "find.recent_hint": "Нажми, чтобы проверить ещё раз",
            "find.import_hint": "Загрузи всю коллекцию по ссылке профиля",
            "build.title": "Собрать сет",
            "build.start_live": "Играть",
            "build.auto": "Авто",
            "build.manual": "Вручную",
            "build.from_crate": "Собрать из ящика",
            "build.clear": "Очистить",
            "build.no_crate_title": "Ящик пуст",
            "build.no_crate_body": "Импортируй коллекцию из Discogs или загрузи демо-ящик, чтобы собрать сет.",
            "build.empty_title": "Сет ещё не собран",
            "build.empty_body": "Собери сет по темпу из ящика или добавляй пластинки вручную из меню релиза.",
            "build.opener": "Открывающий · первая пластинка",
            "dig.title": "Докопать",
            "dig.analyze": "Проверить",
            "dig.gaps": "Пробелы",
            "dig.empty_title": "Пластинок пока нет",
            "dig.empty_body": "Импортируй Discogs или сохрани результат BPM/Key, чтобы начать анализ.",
            "dig.tempo_coverage": "Покрытие темпов",
            "dig.records_bpm": "ПЛАСТИНКИ / BPM",
            "dig.camelot_map": "Карта Camelot",
            "dig.minor_row": "A · МИНОРНЫЙ РЯД",
            "dig.next": "Куда копать дальше",
            "dig.suggestion_1_title": "174–178 · 9A",
            "dig.suggestion_1_body": "Тонкий мост после твоего ядра 170–174",
            "dig.suggestion_2_title": "11A · холодные ключи",
            "dig.suggestion_2_body": "Полезный гармонический выход из 12A и 10A",
            "dig.suggestion_3_title": "Halftime · 84–90",
            "dig.suggestion_3_body": "Хороший пул для начала сета, его легко расширить",
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
            "settings.demo": "Загрузить демо-ящик",
            "settings.clear_local": "Очистить ящик, сет и вишлист",
            "settings.appearance": "ВИД",
            "settings.general": "ОБЩЕЕ",
            "settings.data": "КОЛЛЕКЦИЯ И ДАННЫЕ",
            "settings.privacy": "ПРИВАТНОСТЬ",
            "settings.support": "ПОДДЕРЖКА",
            "settings.accent": "Акцент",
            "settings.default_bpm": "Базовый BPM-диапазон",
            "settings.import_hint": "Обновить или добавить коллекцию",
            "settings.export_hint": "Поделиться JSON ящика",
            "settings.local_only": "Коллекция хранится на устройстве",
            "settings.no_cloud": "Без облачного синка",
            "settings.support_author": "Поддержать автора",
            "settings.support_hint": "Помочь Vertax оставаться независимым",
            "settings.about_body": "Умный помощник для виниловых DJ.",
            "settings.about_title": "О Vertax",
            "live.end": "Завершить",
            "live.time": "ВРЕМЯ СЕТА",
            "live.now": "ИГРАЕТ СЕЙЧАС",
            "live.set_mode": "СЕТ",
            "live.free_mode": "FREE",
            "live.sleeve": "СТОРОНА",
            "live.setlist": "СЕТЛИСТ",
            "live.crate_queue": "ОЧЕРЕДЬ ИЗ ЯЩИКА",
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
            "release.tempo": "Темп",
            "release.tracklist": "Треклист",
            "release.tracks": "треков",
            "release.mixes_well": "Хорошо сводится с",
            "release.in_crate": "в ящике",
            "release.notes": "Заметки",
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
            "import.step_profile": "Ищу профиль Discogs",
            "import.step_collection": "Читаю коллекцию",
            "import.step_matching": "Сопоставляю BPM и Key",
            "import.step_crate": "Собираю ящик",
            "import.done": "Коллекция импортирована",
            "import.failed": "Импорт не получился",
            "import.empty": "У этого Discogs-профиля не найдено публичных пластинок.",
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
            "common.demo": "载入演示唱片箱",
            "common.clear": "清除本地数据",
            "common.version": "版本 1.0",
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
            "crate.empty_body": "从 Discogs 导入、保存 BPM/Key 搜索结果，或载入演示唱片箱。",
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
            "find.recent": "最近",
            "find.recent_hint": "点按再次查询",
            "find.import_hint": "通过个人主页链接导入整套收藏",
            "build.title": "编排 Set",
            "build.start_live": "开始 Live",
            "build.auto": "自动",
            "build.manual": "手动",
            "build.from_crate": "从唱片箱生成",
            "build.clear": "清空",
            "build.no_crate_title": "唱片箱为空",
            "build.no_crate_body": "先导入 Discogs 收藏，或载入演示唱片箱再编排 set。",
            "build.empty_title": "还没有 set",
            "build.empty_body": "从唱片箱按速度生成 set，或在发行操作中手动加入唱片。",
            "build.opener": "开场 · 第一张",
            "dig.title": "Dig",
            "dig.analyze": "分析",
            "dig.gaps": "缺口",
            "dig.empty_title": "还没有唱片",
            "dig.empty_body": "从 Discogs 导入，或保存 BPM/Key 查询结果后开始分析。",
            "dig.tempo_coverage": "速度覆盖",
            "dig.records_bpm": "唱片 / BPM",
            "dig.camelot_map": "Camelot 图",
            "dig.minor_row": "A · 小调行",
            "dig.next": "下一步挖掘",
            "dig.suggestion_1_title": "174–178 · 9A",
            "dig.suggestion_1_body": "补强 170–174 核心后的薄弱桥接",
            "dig.suggestion_2_title": "11A · 冷色调 Key",
            "dig.suggestion_2_body": "从 12A 和 10A 退出时很有用",
            "dig.suggestion_3_title": "Halftime · 84–90",
            "dig.suggestion_3_body": "适合作为开场池，也容易继续扩展",
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
            "settings.demo": "载入演示唱片箱",
            "settings.clear_local": "清除本地唱片箱、Set 和愿望单",
            "settings.appearance": "外观",
            "settings.general": "通用",
            "settings.data": "收藏与数据",
            "settings.privacy": "隐私",
            "settings.support": "支持",
            "settings.accent": "强调色",
            "settings.default_bpm": "默认 BPM 范围",
            "settings.import_hint": "重新同步或添加收藏",
            "settings.export_hint": "分享唱片箱 JSON",
            "settings.local_only": "收藏保存在设备上",
            "settings.no_cloud": "无云端同步",
            "settings.support_author": "支持作者",
            "settings.support_hint": "帮助 Vertax 保持独立",
            "settings.about_body": "给黑胶 DJ 的智能唱片箱助手。",
            "settings.about_title": "关于",
            "live.end": "结束",
            "live.time": "SET 时间",
            "live.now": "正在播放",
            "live.set_mode": "SET",
            "live.free_mode": "FREE",
            "live.sleeve": "面",
            "live.setlist": "SET 列表",
            "live.crate_queue": "唱片箱队列",
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
            "release.tempo": "速度",
            "release.tracklist": "曲目列表",
            "release.tracks": "首曲目",
            "release.mixes_well": "适合接入",
            "release.in_crate": "在唱片箱中",
            "release.notes": "备注",
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
            "import.step_profile": "读取 Discogs 资料",
            "import.step_collection": "读取收藏",
            "import.step_matching": "匹配 BPM 与 Key",
            "import.step_crate": "生成唱片箱",
            "import.done": "收藏已导入",
            "import.failed": "导入失败",
            "import.empty": "这个 Discogs 资料没有找到公开唱片。",
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
            "common.demo": "デモCrateを読み込む",
            "common.clear": "ローカルデータを消去",
            "common.version": "バージョン 1.0",
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
            "crate.empty_body": "Discogsから読み込む、BPM/Key検索を保存する、またはデモCrateを読み込んでください。",
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
            "find.recent": "最近",
            "find.recent_hint": "タップして再検索",
            "find.import_hint": "プロフィールリンクからコレクション全体を読み込みます",
            "build.title": "Set作成",
            "build.start_live": "Live開始",
            "build.auto": "自動",
            "build.manual": "手動",
            "build.from_crate": "Crateから作成",
            "build.clear": "クリア",
            "build.no_crate_title": "Crate が空です",
            "build.no_crate_body": "Discogs コレクションを読み込むか、デモCrateを読み込んでから Set を作成してください。",
            "build.empty_title": "Set はまだ空です",
            "build.empty_body": "Crateからテンポ順のSetを作るか、リリース操作から手動で追加してください。",
            "build.opener": "オープナー · 1枚目",
            "dig.title": "Dig",
            "dig.analyze": "分析",
            "dig.gaps": "不足",
            "dig.empty_title": "まだレコードがありません",
            "dig.empty_body": "Discogsから読み込むか、BPM/Key検索を保存すると分析できます。",
            "dig.tempo_coverage": "テンポ分布",
            "dig.records_bpm": "レコード / BPM",
            "dig.camelot_map": "Camelot マップ",
            "dig.minor_row": "A · マイナー列",
            "dig.next": "次に掘る方向",
            "dig.suggestion_1_title": "174–178 · 9A",
            "dig.suggestion_1_body": "170–174 の中心から先の細い橋を補強",
            "dig.suggestion_2_title": "11A · cold keys",
            "dig.suggestion_2_body": "12A と 10A から抜ける時に使いやすい",
            "dig.suggestion_3_title": "Halftime · 84–90",
            "dig.suggestion_3_body": "オープナー候補として強く、広げやすい領域",
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
            "settings.demo": "デモCrateを読み込む",
            "settings.clear_local": "ローカルのCrate、Set、Wishlistを消去",
            "settings.appearance": "外観",
            "settings.general": "一般",
            "settings.data": "コレクションとデータ",
            "settings.privacy": "プライバシー",
            "settings.support": "サポート",
            "settings.accent": "アクセント",
            "settings.default_bpm": "標準BPM範囲",
            "settings.import_hint": "再同期または追加",
            "settings.export_hint": "Crate JSONを共有",
            "settings.local_only": "コレクションは端末内に保存",
            "settings.no_cloud": "クラウド同期なし",
            "settings.support_author": "作者をサポート",
            "settings.support_hint": "Vertaxの独立運営を支援",
            "settings.about_body": "ヴァイナルDJのためのスマートCrateアシスタント。",
            "settings.about_title": "About",
            "live.end": "終了",
            "live.time": "SET時間",
            "live.now": "再生中",
            "live.set_mode": "SET",
            "live.free_mode": "FREE",
            "live.sleeve": "面",
            "live.setlist": "SETLIST",
            "live.crate_queue": "CRATE QUEUE",
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
            "release.tempo": "テンポ",
            "release.tracklist": "トラックリスト",
            "release.tracks": "曲",
            "release.mixes_well": "相性が良い",
            "release.in_crate": "Crate内",
            "release.notes": "メモ",
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
            "import.step_profile": "Discogsプロフィールを取得",
            "import.step_collection": "コレクションを読み込み",
            "import.step_matching": "BPM と Key を照合",
            "import.step_crate": "Crateを作成",
            "import.done": "読み込み完了",
            "import.failed": "読み込み失敗",
            "import.empty": "このDiscogsプロフィールには公開レコードが見つかりませんでした。",
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
            ?? []
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

    public func loadDemo() { records = Record.sample }
    public func clear() { records = [] }

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
            ?? []
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
    public func clear() { recordIDs.removeAll() }
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
