/**
 * about.js
 * Language switching, i18n, and links config for /about page.
 * Languages: ru (default), en, zh, ja
 * Priority: ?lang= param > localStorage > 'ru'
 */

// ─── LINKS CONFIG ────────────────────────────────────────────────────────────

const LINKS = {
  vertaxApp: "/",
  vertaxAbout: "/about",
  telegramMiniAppHero:
    "https://t.me/vertaksbot/app?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_launch&utm_content=hero_telegram",
  telegramMiniAppFooter:
    "https://t.me/vertaksbot/app?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=footer_telegram",
  personalSite:
    "https://proskurin.online/proskurin-mikhail?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=personal_site",
  laisoBuck:
    "https://proskurin.online/laiso-buck?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=laiso_buck",
  lab1994:
    "https://1994lab.ru?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=1994lab",
  onedam:
    "https://onedam.me?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=onedam",
  karacha:
    "https://vk.com/karacha_me?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=karacha",
  michaelTelegram:
    "https://t.me/michael1994lab?utm_source=vertax_about&utm_medium=website&utm_campaign=vertax_ecosystem&utm_content=contact_telegram",
  mixesRu: "https://promodj.com/laisobuck",
  mixesInternational:
    "https://www.mixcloud.com/LaisoBuck/not-for-the-dancefloor-06-vinyl-only-uk-bass-ambient-flow/",
};

// ─── I18N DICTIONARY ─────────────────────────────────────────────────────────

const COPY = {
  ru: {
    // meta
    metaTitle: "Vertax - инструмент для виниловых DJ: BPM, Key, Discogs и сборка сетов",
    metaDesc:
      "Vertax помогает виниловым DJ находить BPM и Key, вести коллекцию пластинок, импортировать релизы из Discogs и собирать сеты по BPM, Camelot и flow.",
    // nav
    navWhat: "Что это",
    navFeatures: "Возможности",
    navHow: "Как работает",
    navEcosystem: "Экосистема",
    navContact: "Контакты",
    navCta: "Запустить в Telegram",
    // hero
    heroEyebrow: "DIG. PLAY. SHARE.",
    heroH1: "Vertax - инструмент для виниловых DJ",
    heroSub:
      "BPM, Key, коллекция пластинок, Discogs-импорт и сборка сетов по совместимости. Для тех, кто играет с пластинок, копает релизы и не хочет превращать подготовку к сету в таблицу на коленке.",
    heroCta1: "Запустить в Telegram",
    heroCta2: "Запустить в Telegram",
    heroNote:
      "Сделано под себя. Местами ещё живое и шероховатое, зато уже помогает готовить vinyl-only сеты быстрее.",
    // problem
    problemKicker: "Зачем это нужно",
    problemH2: "Винил живой. Метаданные - нет.",
    problemText:
      "Когда играешь с пластинок, часть привычной цифровой информации просто отсутствует. На конверте обычно не написан BPM. Key тоже приходится искать отдельно. Коллекция растёт, пластинки лежат по полкам, Discogs живёт своей жизнью, а после сета ты иногда вспоминаешь треклист по фотографиям конвертов и остаткам памяти. Vertax закрывает эту бытовую дыру: помогает быстрее разобрать пластинки, сохранить коллекцию и собрать сет с нормальным flow.",
    pain1Title: "BPM не написан",
    pain1Text: "На виниле часто нет темпа. Приходится искать руками или вспоминать на слух.",
    pain2Title: "Key нужно искать отдельно",
    pain2Text: "Для harmonic mixing тональность приходится собирать из внешних источников.",
    pain3Title: "Коллекция расползается",
    pain3Text: "Discogs, полки, заметки, фото конвертов и память живут отдельно друг от друга.",
    pain4Title: "Треклист после сета теряется",
    pain4Text: "После записи или лайва сложно быстро восстановить, что именно игралось.",
    // features
    featuresKicker: "Что умеет Vertax",
    featuresH2: "Построено для копания, сортировки и игры",
    feat1Title: "BPM и Key Finder",
    feat1Text: "Находит темп и тональность по артисту и названию трека.",
    feat2Title: "Коллекция пластинок",
    feat2Text: "Помогает вести vinyl-коллекцию: релизы, треки, лейблы, годы, стили и заметки.",
    feat3Title: "Discogs Import",
    feat3Text: "Импортирует коллекцию из Discogs, чтобы не забивать всё руками.",
    feat4Title: "Set Builder",
    feat4Text: "Собирает порядок для сета по BPM, Camelot, совместимости и общему flow.",
    feat5Title: "Vinyl-only Workflow",
    feat5Text:
      "Подходит для подготовки vinyl-only сетов, когда хочется играть руками, но не вслепую.",
    feat6Title: "Telegram Mini App",
    feat6Text:
      "Работает внутри Telegram и всегда под рукой во время копания, подготовки или записи сета.",
    // how it works
    howKicker: "Как это работает",
    howH2: "От полки к сету",
    step1Num: "01",
    step1Title: "Добавь пластинки",
    step1Text: "Вручную или через импорт из Discogs.",
    step2Num: "02",
    step2Title: "Проверь BPM и Key",
    step2Text: "Vertax подтянет метаданные и поможет привести коллекцию в порядок.",
    step3Num: "03",
    step3Title: "Собери сет",
    step3Text: "Выбери пластинки и получи совместимый порядок по темпу, Camelot и flow.",
    step4Num: "04",
    step4Title: "Играй и делись",
    step4Text: "Используй сет как live-подсказку, сохраняй треклист и делись результатом.",
    // audience
    audienceKicker: "Для кого",
    audienceH2: "Не для всех. Для своих.",
    aud1: "Виниловые DJ",
    aud2: "DnB / Jungle / UK Bass селекторы",
    aud3: "Коллекционеры пластинок",
    aud4: "Те, кто играет vinyl-only",
    aud5: "Те, кто копает Discogs и хочет быстрее разбирать покупки",
    aud6: "Те, кто любит harmonic mixing, но не хочет жить в таблицах",
    // ecosystem
    ecosystemKicker: "Экосистема",
    ecosystemH2: "Больше, чем просто утилита",
    ecosystemText:
      "Vertax вырос из реальной музыкальной практики Laiso Buck: виниловые сеты, deep и atmospheric drum'n'bass, modern jungle, UK bass и серия Not for the Dancefloor. Это не абстрактный DJ-сервис, а инструмент, сделанный человеком, который сам копает, покупает, сортирует и играет пластинки.",
    eco1Title: "Telegram Mini App",
    eco1Text: "Vertax внутри Telegram: коллекция, BPM, Key, Discogs и сборка сетов.",
    eco2Title: "Telegram Mini App",
    eco2Text: "Vertax внутри Telegram. Удобно держать под рукой во время копания и подготовки.",
    eco3Title: "Laiso Buck",
    eco3Text:
      "Виниловый DJ-проект Михаила Проскурина: deep & atmospheric drum'n'bass, modern jungle, UK bass, leftfield.",
    eco4Title: "Not for the Dancefloor",
    eco4Text:
      "Серия сетов не про пик-тайм, а про атмосферу, фактуру, плавный поток и внимательное слушание.",
    eco5Title: "Karacha",
    eco5Text: "Drum'n'bass проект Михаила Проскурина и Ильи Романенкова.",
    eco6Title: "1994lab",
    eco6Text:
      "Digital-агентство Михаила Проскурина и Валерия Фиронова: сайты, брендинг, webapps, mini-apps и digital-продукты.",
    eco7Title: "Onedam",
    eco7Text:
      "Платформа и направление для Telegram / MAX mini-apps, webapps и прикладных digital-сервисов.",
    eco8Title: "Михаил Проскурин",
    eco8Text: "Digital-продюсер, CEO 1994lab / Onedam, музыкант, DJ и автор Vertax.",
    // contact
    contactKicker: "Связь",
    contactH2: "Обратная связь, баги, идеи, букинг",
    contactText:
      "Если играете винил, нашли баг, хотите предложить фичу, позвать на сет или обсудить mini-app проект - пишите. Vertax сейчас развивается как живой инструмент, поэтому нормальная обратная связь важнее красивых презентаций.",
    contactBtn1: "Написать Михаилу",
    contactBtn2: "Личный сайт",
    contactBtn3: "Laiso Buck",
    contactBtn4: "1994lab",
    // footer
    footerCopy: "Vertax by Laiso Buck / 1994lab",
    footerTagline: "DIG. PLAY. SHARE.",
    footerLink1: "Запустить в Telegram",
    footerLink2: "Telegram",
    footerLink3: "About",
    footerLink4: "Михаил Проскурин",
    footerLink5: "1994lab",
  },

  en: {
    metaTitle: "Vertax - Vinyl DJ Tool for BPM, Key, Discogs Import and Set Building",
    metaDesc:
      "Vertax helps vinyl DJs find BPM and Key, manage record collections, import releases from Discogs and build compatible DJ sets by BPM, Camelot and flow.",
    navWhat: "What it is",
    navFeatures: "Features",
    navHow: "How it works",
    navEcosystem: "Ecosystem",
    navContact: "Contact",
    navCta: "Launch in Telegram",
    heroEyebrow: "DIG. PLAY. SHARE.",
    heroH1: "Vertax - a tool for vinyl DJs",
    heroSub:
      "BPM, Key, record collection management, Discogs import and set building by compatibility. Built for DJs who play vinyl, dig records and do not want set preparation to turn into a messy spreadsheet.",
    heroCta1: "Launch in Telegram",
    heroCta2: "Launch in Telegram",
    heroNote:
      "Built for real vinyl practice. Still a bit rough in places, but already useful for preparing vinyl-only sets faster.",
    problemKicker: "Why it exists",
    problemH2: "Vinyl is alive. Metadata is not.",
    problemText:
      "When you play records, a lot of the information you get for free in digital libraries is simply missing. BPM is usually not printed on the sleeve. Key has to be found elsewhere. Your collection grows across shelves, Discogs, notes and photos. After a live set, rebuilding the tracklist can feel like archaeology. Vertax closes that everyday gap: it helps you sort records faster, keep your collection together and build sets with a cleaner flow.",
    pain1Title: "BPM is not printed",
    pain1Text: "Vinyl rarely shows tempo. You have to find it manually or remember by ear.",
    pain2Title: "Key lives elsewhere",
    pain2Text: "For harmonic mixing, musical key has to be pulled from external sources.",
    pain3Title: "Collections get messy",
    pain3Text: "Discogs, shelves, notes, sleeve photos and memory all live separately.",
    pain4Title: "Tracklists disappear",
    pain4Text: "After a recording or live set it is hard to quickly rebuild what was played.",
    featuresKicker: "What Vertax does",
    featuresH2: "Built for digging, sorting and playing",
    feat1Title: "BPM & Key Finder",
    feat1Text: "Find tempo and musical key by artist and track name.",
    feat2Title: "Record Collection",
    feat2Text:
      "Keep your vinyl collection organized: releases, tracks, labels, years, styles and notes.",
    feat3Title: "Discogs Import",
    feat3Text: "Import your Discogs collection instead of entering everything manually.",
    feat4Title: "Set Builder",
    feat4Text: "Build a set order by BPM, Camelot compatibility and overall flow.",
    feat5Title: "Vinyl-only Workflow",
    feat5Text: "Useful for preparing vinyl-only sets when you want to play by hand, not blind.",
    feat6Title: "Telegram Mini App",
    feat6Text: "Runs inside Telegram, so it is always close while digging or preparing a set.",
    howKicker: "How it works",
    howH2: "From shelf to set",
    step1Num: "01",
    step1Title: "Add records",
    step1Text: "Add them manually or import your Discogs collection.",
    step2Num: "02",
    step2Title: "Check BPM and Key",
    step2Text: "Vertax helps enrich your records with useful metadata.",
    step3Num: "03",
    step3Title: "Build a set",
    step3Text: "Select records and get a compatible order by tempo, Camelot and flow.",
    step4Num: "04",
    step4Title: "Play and share",
    step4Text: "Use the result as a live cue, save the tracklist and share it.",
    audienceKicker: "Who it is for",
    audienceH2: "Not for everyone. For those who know.",
    aud1: "Vinyl DJs",
    aud2: "DnB / Jungle / UK Bass selectors",
    aud3: "Record collectors",
    aud4: "Vinyl-only performers",
    aud5: "Discogs diggers who want to sort purchases faster",
    aud6: "DJs who like harmonic mixing but hate messy spreadsheets",
    ecosystemKicker: "Ecosystem",
    ecosystemH2: "More than a utility",
    ecosystemText:
      "Vertax grew out of Laiso Buck's real vinyl practice: deep and atmospheric drum'n'bass, modern jungle, UK bass and the Not for the Dancefloor mix series. It is not an abstract DJ SaaS, but a tool built by someone who actually digs, buys, sorts and plays records.",
    eco1Title: "Telegram Mini App",
    eco1Text: "Vertax inside Telegram: collection, BPM, Key, Discogs and set building.",
    eco2Title: "Telegram Mini App",
    eco2Text: "Vertax inside Telegram. Easy to keep close while digging and preparing sets.",
    eco3Title: "Laiso Buck",
    eco3Text:
      "Michael Proskurin's vinyl DJ project: deep & atmospheric drum'n'bass, modern jungle, UK bass, leftfield.",
    eco4Title: "Not for the Dancefloor",
    eco4Text:
      "A mix series focused not on peak-time pressure, but on atmosphere, texture, flow and careful listening.",
    eco5Title: "Karacha",
    eco5Text: "A drum'n'bass project by Michael Proskurin and Ilya Romanenkov.",
    eco6Title: "1994lab",
    eco6Text:
      "A digital agency by Michael Proskurin and Valery Fironov: websites, branding, web apps, mini-apps and digital products.",
    eco7Title: "Onedam",
    eco7Text:
      "A platform and direction for Telegram / MAX mini-apps, web apps and practical digital services.",
    eco8Title: "Michael Proskurin",
    eco8Text: "Digital producer, CEO of 1994lab / Onedam, musician, DJ and creator of Vertax.",
    contactKicker: "Contact",
    contactH2: "Feedback, bugs, ideas, booking",
    contactText:
      "If you play vinyl, found a bug, want to suggest a feature, book a set or discuss a mini-app project, feel free to reach out. Vertax is growing as a living tool, so real feedback matters more than polished presentations.",
    contactBtn1: "Message Michael",
    contactBtn2: "Personal site",
    contactBtn3: "Laiso Buck",
    contactBtn4: "1994lab",
    footerCopy: "Vertax by Laiso Buck / 1994lab",
    footerTagline: "DIG. PLAY. SHARE.",
    footerLink1: "Launch in Telegram",
    footerLink2: "Telegram",
    footerLink3: "About",
    footerLink4: "Michael Proskurin",
    footerLink5: "1994lab",
  },

  zh: {
    metaTitle: "Vertax - 黑胶 DJ 工具：BPM、Key、Discogs 导入与 Set 编排",
    metaDesc:
      "Vertax 帮助黑胶 DJ 查询 BPM 和 Key，管理唱片收藏，从 Discogs 导入 release，并根据 BPM、Camelot 和 flow 编排 DJ set。",
    navWhat: "是什么",
    navFeatures: "功能",
    navHow: "如何使用",
    navEcosystem: "生态",
    navContact: "联系",
    navCta: "在 Telegram 中启动",
    heroEyebrow: "DIG. PLAY. SHARE.",
    heroH1: "Vertax - 为黑胶 DJ 打造的工具",
    heroSub:
      "BPM、Key、黑胶收藏管理、Discogs 导入，以及基于 BPM、Camelot 和 flow 的 DJ set 编排。适合用黑胶演出的 DJ、挖唱片的人，以及不想把准备 set 变成混乱表格的人。",
    heroCta1: "在 Telegram 中启动",
    heroCta2: "在 Telegram 中启动",
    heroNote:
      "这是从真实黑胶演出流程里做出来的工具。现在还有一些粗糙，但已经可以帮助更快准备 vinyl-only set。",
    problemKicker: "为什么需要它",
    problemH2: "黑胶是活的，元数据不是。",
    problemText:
      "用黑胶演出时，数字音乐库里那些习以为常的信息经常不存在。唱片封套上通常没有 BPM。Key 也要另外查。收藏越来越多，唱片架、Discogs、备注和照片分散在不同地方。演出结束后再还原 tracklist，有时像考古。Vertax 解决的就是这个日常问题：更快整理唱片，集中管理收藏，并用更好的 flow 编排 set。",
    pain1Title: "唱片上通常没有 BPM",
    pain1Text: "黑胶很少标注 BPM，需要手动查找或凭记忆还原。",
    pain2Title: "Key 需要另外查",
    pain2Text: "做 harmonic mixing 时，调性必须从外部来源获取。",
    pain3Title: "收藏很容易变乱",
    pain3Text: "Discogs、唱片架、备注、封套照片和记忆分散在不同地方。",
    pain4Title: "演出后的 tracklist 容易丢",
    pain4Text: "录音或现场演出后，很难快速还原播放内容。",
    featuresKicker: "Vertax 能做什么",
    featuresH2: "为挖唱片、整理和演出而生",
    feat1Title: "BPM 与 Key 查询",
    feat1Text: "通过 artist 和 track name 查询速度与调性。",
    feat2Title: "黑胶收藏管理",
    feat2Text: "管理你的 vinyl collection：release、track、label、年份、风格和备注。",
    feat3Title: "Discogs 导入",
    feat3Text: "从 Discogs 导入收藏，减少手动录入。",
    feat4Title: "Set Builder",
    feat4Text: "根据 BPM、Camelot 兼容性和整体 flow 编排 set 顺序。",
    feat5Title: "Vinyl-only Workflow",
    feat5Text: "适合准备 vinyl-only set：保持手动演出的感觉，但不盲目准备。",
    feat6Title: "Telegram Mini App",
    feat6Text: "在 Telegram 内运行，挖唱片和准备 set 时可以随时打开。",
    howKicker: "如何使用",
    howH2: "从唱片架到 set",
    step1Num: "01",
    step1Title: "添加唱片",
    step1Text: "手动添加，或从 Discogs 导入收藏。",
    step2Num: "02",
    step2Title: "检查 BPM 和 Key",
    step2Text: "Vertax 帮助补全唱片的关键元数据。",
    step3Num: "03",
    step3Title: "编排 set",
    step3Text: "选择唱片，根据 BPM、Camelot 和 flow 得到更顺的顺序。",
    step4Num: "04",
    step4Title: "演出并分享",
    step4Text: "把结果作为 live 提示，保存 tracklist，并分享出去。",
    audienceKicker: "适合谁",
    audienceH2: "不是为所有人。是为真正玩的人。",
    aud1: "黑胶 DJ",
    aud2: "DnB / Jungle / UK Bass selector",
    aud3: "黑胶收藏者",
    aud4: "Vinyl-only 演出者",
    aud5: "挖 Discogs 并想更快整理购买的人",
    aud6: "喜欢 harmonic mixing 但不想维护混乱表格的 DJ",
    ecosystemKicker: "生态系统",
    ecosystemH2: "不只是一个工具",
    ecosystemText:
      "Vertax 来自 Laiso Buck 的真实黑胶实践：deep / atmospheric drum'n'bass、modern jungle、UK bass，以及 Not for the Dancefloor 系列。它不是抽象的 DJ SaaS，而是由真正挖唱片、买唱片、整理唱片并演出的人做出来的工具。",
    eco1Title: "Telegram Mini App",
    eco1Text: "Telegram 内的 Vertax：收藏管理、BPM、Key、Discogs 和 set 编排。",
    eco2Title: "Telegram Mini App",
    eco2Text: "Telegram 内的 Vertax。挖唱片和准备 set 时可以随时打开。",
    eco3Title: "Laiso Buck",
    eco3Text:
      "Michael Proskurin 的黑胶 DJ 项目：deep & atmospheric drum'n'bass、modern jungle、UK bass、leftfield。",
    eco4Title: "Not for the Dancefloor",
    eco4Text:
      "一个不追求 peak-time 的 mix 系列，更关注氛围、质感、flow 和细听。",
    eco5Title: "Karacha",
    eco5Text: "Michael Proskurin 与 Ilya Romanenkov 的 drum'n'bass 项目。",
    eco6Title: "1994lab",
    eco6Text:
      "Michael Proskurin 与 Valery Fironov 的 digital agency：网站、品牌、web app、mini-app 和 digital 产品。",
    eco7Title: "Onedam",
    eco7Text:
      "面向 Telegram / MAX mini-app、web app 和实用 digital service 的平台与方向。",
    eco8Title: "Michael Proskurin",
    eco8Text: "Digital producer，1994lab / Onedam CEO，音乐人，DJ，Vertax 作者。",
    contactKicker: "联系",
    contactH2: "反馈、bug、想法与 booking",
    contactText:
      "如果你也玩黑胶，发现了 bug，想提功能建议，邀请演出，或想讨论 mini-app 项目，可以联系我。Vertax 现在是一个正在成长的真实工具，所以真实反馈比漂亮介绍更重要。",
    contactBtn1: "联系 Michael",
    contactBtn2: "个人网站",
    contactBtn3: "Laiso Buck",
    contactBtn4: "1994lab",
    footerCopy: "Vertax by Laiso Buck / 1994lab",
    footerTagline: "DIG. PLAY. SHARE.",
    footerLink1: "在 Telegram 中启动",
    footerLink2: "Telegram",
    footerLink3: "About",
    footerLink4: "Michael Proskurin",
    footerLink5: "1994lab",
  },

  ja: {
    metaTitle: "Vertax - BPM、Key、Discogs インポート、セット構築のためのヴァイナルDJツール",
    metaDesc:
      "Vertax は、ヴァイナルDJが BPM と Key を調べ、レコードコレクションを管理し、Discogs からインポートして、BPM、Camelot、flow に基づく DJ セットを作るためのツールです。",
    navWhat: "概要",
    navFeatures: "機能",
    navHow: "使い方",
    navEcosystem: "エコシステム",
    navContact: "連絡先",
    navCta: "Telegram で起動",
    heroEyebrow: "DIG. PLAY. SHARE.",
    heroH1: "Vertax - ヴァイナルDJのためのツール",
    heroSub:
      "BPM、Key、レコードコレクション管理、Discogs インポート、互換性に基づくセット構築。レコードでプレイし、掘り、準備を雑な表計算にしたくないDJのために作られています。",
    heroCta1: "Telegram で起動",
    heroCta2: "Telegram で起動",
    heroNote:
      "実際のヴァイナル運用から生まれたツールです。まだ荒い部分はありますが、vinyl-only セットの準備をすでに速くしてくれます。",
    problemKicker: "なぜ必要か",
    problemH2: "ヴァイナルは生きている。メタデータはそうでもない。",
    problemText:
      "レコードでプレイすると、デジタルライブラリでは当たり前の情報が欠けていることがよくあります。BPM はジャケットにほとんど書かれていません。Key も別で探す必要があります。コレクションは棚、Discogs、メモ、写真に分散し、ライブ後のトラックリスト復元は考古学のようになります。Vertax はその日常的な穴を埋め、レコード整理、コレクション管理、流れの良いセット構築を助けます。",
    pain1Title: "BPM が書かれていない",
    pain1Text: "ヴァイナルにはテンポ表記がないことが多く、手で調べるか耳で思い出す必要があります。",
    pain2Title: "Key は別の場所にある",
    pain2Text: "harmonic mixing のためには、音楽的な Key を外部ソースから集める必要があります。",
    pain3Title: "コレクションが散らかる",
    pain3Text: "Discogs、棚、メモ、ジャケット写真、記憶がそれぞれ別々に存在します。",
    pain4Title: "セット後にトラックリストが消える",
    pain4Text: "録音やライブの後、何をプレイしたかをすぐに復元するのは簡単ではありません。",
    featuresKicker: "Vertax の機能",
    featuresH2: "掘る、整理する、プレイするために",
    feat1Title: "BPM & Key Finder",
    feat1Text: "アーティスト名と曲名からテンポと音楽的な Key を探します。",
    feat2Title: "レコードコレクション",
    feat2Text: "リリース、曲、レーベル、年、スタイル、メモを含む vinyl collection を整理できます。",
    feat3Title: "Discogs Import",
    feat3Text: "Discogs のコレクションをインポートし、手入力を減らします。",
    feat4Title: "Set Builder",
    feat4Text: "BPM、Camelot の互換性、全体の flow に基づいてセット順を作ります。",
    feat5Title: "Vinyl-only Workflow",
    feat5Text: "手でプレイする感覚は残しつつ、盲目的に準備したくない vinyl-only セットに向いています。",
    feat6Title: "Telegram Mini App",
    feat6Text: "Telegram 内で動くので、掘っている時やセット準備中にすぐ開けます。",
    howKicker: "使い方",
    howH2: "棚からセットへ",
    step1Num: "01",
    step1Title: "レコードを追加",
    step1Text: "手動で追加するか、Discogs コレクションをインポートします。",
    step2Num: "02",
    step2Title: "BPM と Key を確認",
    step2Text: "Vertax がレコードに必要なメタデータを補う手助けをします。",
    step3Num: "03",
    step3Title: "セットを作る",
    step3Text: "レコードを選び、テンポ、Camelot、flow に基づく自然な順番を得ます。",
    step4Num: "04",
    step4Title: "プレイして共有",
    step4Text: "ライブのキューとして使い、トラックリストを保存して共有できます。",
    audienceKicker: "誰のためか",
    audienceH2: "すべての人向けではない。わかる人のために。",
    aud1: "ヴァイナルDJ",
    aud2: "DnB / Jungle / UK Bass セレクター",
    aud3: "レコードコレクター",
    aud4: "Vinyl-only でプレイする人",
    aud5: "Discogs で掘り、購入品を早く整理したい人",
    aud6: "harmonic mixing は好きだが、雑な表計算は嫌いなDJ",
    ecosystemKicker: "エコシステム",
    ecosystemH2: "単なるユーティリティ以上",
    ecosystemText:
      "Vertax は Laiso Buck の実際のヴァイナル実践から生まれました。deep / atmospheric drum'n'bass、modern jungle、UK bass、Not for the Dancefloor シリーズ。抽象的な DJ SaaS ではなく、実際に掘り、買い、整理し、プレイする人が作ったツールです。",
    eco1Title: "Vertax Web App",
    eco1Text: "コレクション、BPM、Key、Discogs、セット構築の作業ツール。",
    eco2Title: "Telegram Mini App",
    eco2Text: "Telegram 内の Vertax。掘る時や準備中に手元に置きやすい形です。",
    eco3Title: "Laiso Buck",
    eco3Text:
      "Michael Proskurin のヴァイナルDJプロジェクト。deep & atmospheric drum'n'bass、modern jungle、UK bass、leftfield。",
    eco4Title: "Not for the Dancefloor",
    eco4Text:
      "ピークタイムではなく、空気感、質感、flow、丁寧なリスニングにフォーカスしたミックスシリーズです。",
    eco5Title: "Karacha",
    eco5Text: "Michael Proskurin と Ilya Romanenkov による drum'n'bass プロジェクト。",
    eco6Title: "1994lab",
    eco6Text:
      "Michael Proskurin と Valery Fironov の digital agency。Webサイト、ブランディング、web apps、mini-apps、digital products。",
    eco7Title: "Onedam",
    eco7Text:
      "Telegram / MAX mini-apps、web apps、実用的な digital services のためのプラットフォームと方向性。",
    eco8Title: "Michael Proskurin",
    eco8Text: "Digital producer、1994lab / Onedam CEO、ミュージシャン、DJ、Vertax 作者。",
    contactKicker: "連絡",
    contactH2: "フィードバック、バグ、アイデア、ブッキング",
    contactText:
      "ヴァイナルをプレイしている方、バグを見つけた方、機能提案、出演依頼、mini-app プロジェクトの相談がある方は連絡してください。Vertax は生きたツールとして育っているので、実際のフィードバックが何より大事です。",
    contactBtn1: "Michael に連絡",
    contactBtn2: "個人サイト",
    contactBtn3: "Laiso Buck",
    contactBtn4: "1994lab",
    footerCopy: "Vertax by Laiso Buck / 1994lab",
    footerTagline: "DIG. PLAY. SHARE.",
    footerLink1: "Telegram で起動",
    footerLink2: "Telegram",
    footerLink3: "About",
    footerLink4: "Michael Proskurin",
    footerLink5: "1994lab",
  },
};

// ─── VALID LANGUAGES ─────────────────────────────────────────────────────────

const VALID_LANGS = ["ru", "en", "zh", "ja"];
const STORAGE_KEY = "vertax-lang";
const BASE_URL = "https://vertax-one.vercel.app/about";

// ─── LANG DETECTION ──────────────────────────────────────────────────────────

function detectLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get("lang");
    if (paramLang && VALID_LANGS.includes(paramLang)) {
      localStorage.setItem(STORAGE_KEY, paramLang);
      return paramLang;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_LANGS.includes(stored)) {
      return stored;
    }
  } catch (_) {
    // localStorage may be unavailable in some environments
  }
  return "ru";
}

// ─── META HELPER ─────────────────────────────────────────────────────────────

function setMeta(attr, name, content) {
  var el = document.querySelector("meta[" + attr + '="' + name + '"]');
  if (el) el.setAttribute("content", content);
}

function applyLocalizedLinks(lang) {
  var mixesUrl = lang === "ru" ? LINKS.mixesRu : LINKS.mixesInternational;
  var mixesHint = lang === "ru" ? "promodj.com/laisobuck" : "mixcloud.com/LaisoBuck";
  document.querySelectorAll('[data-localized-link="mixes"]').forEach(function (el) {
    el.setAttribute("href", mixesUrl);
  });
  document.querySelectorAll('[data-link-hint="mixes"]').forEach(function (el) {
    el.textContent = mixesHint;
  });
}

// ─── APPLY LANGUAGE ──────────────────────────────────────────────────────────

function applyLang(lang) {
  if (!VALID_LANGS.includes(lang)) lang = "ru";
  var copy = COPY[lang];

  // html lang attribute
  var htmlLang = lang === "zh" ? "zh-CN" : lang;
  document.documentElement.setAttribute("lang", htmlLang);

  // meta tags
  document.title = copy.metaTitle;
  setMeta("name", "description", copy.metaDesc);
  setMeta("property", "og:title", copy.metaTitle);
  setMeta("property", "og:description", copy.metaDesc);
  setMeta("name", "twitter:title", copy.metaTitle);
  setMeta("name", "twitter:description", copy.metaDesc);

  var ogUrl = lang === "ru" ? BASE_URL : BASE_URL + "?lang=" + lang;
  setMeta("property", "og:url", ogUrl);
  applyLocalizedLinks(lang);

  // text content
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (copy[key] !== undefined) {
      el.textContent = copy[key];
    }
  });

  // lang switcher active state
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    var isActive = btn.getAttribute("data-lang") === lang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  // persist
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {}
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  // apply language
  var lang = detectLang();
  applyLang(lang);

  // language switcher buttons
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var newLang = btn.getAttribute("data-lang");
      applyLang(newLang);
      // update URL without reload
      try {
        var url = new URL(window.location.href);
        if (newLang === "ru") {
          url.searchParams.delete("lang");
        } else {
          url.searchParams.set("lang", newLang);
        }
        history.replaceState({}, "", url.toString());
      } catch (_) {}
    });
  });

  // mobile menu toggle
  var menuToggle = document.getElementById("menu-toggle");
  var navLinks = document.getElementById("nav-links");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      var expanded = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!expanded));
      navLinks.classList.toggle("open", !expanded);
    });
    // close menu on nav link click
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menuToggle.setAttribute("aria-expanded", "false");
        navLinks.classList.remove("open");
      });
    });
    // close menu on outside click
    document.addEventListener("click", function (e) {
      if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
        menuToggle.setAttribute("aria-expanded", "false");
        navLinks.classList.remove("open");
      }
    });
  }
});
