const SITE_URL = 'https://vertax.live';

const LOCALES = ['ru', 'en', 'es', 'ja', 'zh'];

const CONFIG = {
  ru: { html: 'ru', hreflang: 'ru', og: 'ru_RU', label: 'RU', name: 'Русский' },
  en: { html: 'en', hreflang: 'en', og: 'en_GB', label: 'EN', name: 'English' },
  es: { html: 'es', hreflang: 'es', og: 'es_ES', label: 'ES', name: 'Español' },
  ja: { html: 'ja', hreflang: 'ja', og: 'ja_JP', label: '日本', name: '日本語' },
  zh: { html: 'zh-CN', hreflang: 'zh-Hans', og: 'zh_CN', label: '中文', name: '简体中文' },
};

const COPY = {
  ru: {
    navAria: 'Основная навигация', languageAria: 'Язык каталога', brandAria: 'VERTAX — открыть приложение',
    catalog: 'Каталог', about: 'О проекте', openTelegram: 'Открыть в Telegram', webApp: 'Веб-приложение', telegramApp: 'Telegram Mini App',
    footer: 'Инструмент для виниловых DJ: коллекция, BPM, Camelot и сборка сетов.',
    catalogTitle: 'Каталог винила с BPM и Camelot | VERTAX', catalogPageTitle: 'Каталог винила: BPM и Camelot — страница {page} | VERTAX',
    catalogDescription: 'Пластинки и треклисты с определёнными BPM и Camelot. Каталог VERTAX для подготовки виниловых DJ-сетов.',
    catalogH1: 'Пластинки, BPM и Camelot', catalogLead: 'Публичный каталог определённых треклистов из базы VERTAX. Данные помогают оценить темп и гармоническую совместимость пластинок перед сборкой DJ-сета.',
    searchLabel: 'Поиск по артисту, релизу, лейблу или каталогу', searchButton: 'Найти',
    discogsTitle: 'Добавить публичную коллекцию Discogs', discogsText: 'Введите username. Виниловые релизы попадут в общую базу VERTAX, а треклисты, BPM и Camelot будут дополнены автоматически.',
    discogsUsername: 'Discogs username', discogsButton: 'Добавить в базу', discogsNote: 'Имя владельца не сохраняется. Учитываются только публичные виниловые релизы; CD пропускаются.',
    found: 'Найдено', page: 'Страница', catalogAria: 'Каталог пластинок', paginationAria: 'Страницы каталога',
    nothingTitle: 'Ничего не найдено', nothingText: 'Попробуйте изменить запрос или вернуться ко всему каталогу.', showAll: 'Показать все пластинки',
    ctaTitle: 'Эти данные работают внутри VERTAX', ctaText: 'Добавляйте свои пластинки, исправляйте BPM/Camelot и собирайте совместимые сеты.',
    releaseDataTitle: '{artist} — {title}: BPM и Camelot треков | VERTAX', releasePlainTitle: '{artist} — {title}: виниловая пластинка | VERTAX',
    releaseTracklist: 'Треклист пластинки', bpmKnown: 'BPM определён для {count} треков.', camelotKnown: 'Camelot определён для {count} треков.', releasePurpose: 'Данные для подготовки винилового DJ-сета в VERTAX.',
    breadcrumbsAria: 'Хлебные крошки', coverAlt: 'Обложка {artist} — {title}', openVertax: 'Открыть VERTAX', launchTelegram: 'Запустить в Telegram',
    tracksTitle: 'Треки пластинки', position: 'Поз.', trackTitle: 'Название', duration: 'Время',
    pendingTitle: 'Треклист ожидает загрузки', pendingText: 'Пластинка уже есть в общей базе VERTAX. Данные Discogs, BPM и Camelot будут добавлены автоматически.',
    aboutTitle: 'От пластинки к готовому сету', aboutText: 'VERTAX помогает виниловым DJ вести коллекцию, определять BPM и Camelot, проверять совместимость треков и собирать DJ-сеты.', aboutLink: 'Узнать о проекте →',
    sourceBefore: 'Информация о релизе и обложка получены из', sourceAfter: 'BPM и Camelot могут содержать автоматические или проверенные вручную значения.',
    notFoundTitle: 'Пластинка не найдена | VERTAX', notFoundDescription: 'Такой страницы пластинки пока нет в публичном каталоге VERTAX.', notFoundH1: 'Пластинка не найдена', notFoundText: 'Возможно, адрес изменился или релиз ещё не попал в публичный каталог.', openCatalog: 'Открыть каталог',
    unavailableTitle: 'Каталог временно недоступен | VERTAX', unavailableDescription: 'Публичный каталог VERTAX временно недоступен.', unavailableH1: 'Каталог временно недоступен', unavailableText: 'Приложение продолжает работать. Попробуйте открыть каталог чуть позже.',
    trackCount: '{count} трек.',
  },
  en: {
    navAria: 'Main navigation', languageAria: 'Catalog language', brandAria: 'Open VERTAX app',
    catalog: 'Catalog', about: 'About', openTelegram: 'Open in Telegram', webApp: 'Web app', telegramApp: 'Telegram Mini App',
    footer: 'A vinyl DJ tool for collections, BPM, Camelot and set building.',
    catalogTitle: 'Vinyl records with BPM and Camelot | VERTAX', catalogPageTitle: 'Vinyl BPM and Camelot catalog — page {page} | VERTAX',
    catalogDescription: 'Vinyl records and tracklists with BPM and Camelot data. The VERTAX catalog for planning vinyl DJ sets.',
    catalogH1: 'Vinyl records, BPM and Camelot', catalogLead: 'A public catalog of identified tracklists from the VERTAX database. Use tempo and harmonic compatibility data when planning a vinyl DJ set.',
    searchLabel: 'Search by artist, release, label or catalog number', searchButton: 'Search',
    discogsTitle: 'Add a public Discogs collection', discogsText: 'Enter a username. Vinyl releases will be added to the shared VERTAX catalog, then tracklists, BPM and Camelot data will be enriched automatically.',
    discogsUsername: 'Discogs username', discogsButton: 'Add to catalog', discogsNote: 'The owner name is not stored. Only public vinyl releases are included; CDs are skipped.',
    found: 'Found', page: 'Page', catalogAria: 'Vinyl catalog', paginationAria: 'Catalog pages',
    nothingTitle: 'Nothing found', nothingText: 'Try another query or return to the full catalog.', showAll: 'Show all records',
    ctaTitle: 'Use this data inside VERTAX', ctaText: 'Add your records, correct BPM and Camelot values, and build compatible sets.',
    releaseDataTitle: '{artist} — {title}: track BPM and Camelot | VERTAX', releasePlainTitle: '{artist} — {title}: vinyl record | VERTAX',
    releaseTracklist: 'Vinyl tracklist', bpmKnown: 'BPM is available for {count} tracks.', camelotKnown: 'Camelot is available for {count} tracks.', releasePurpose: 'Data for preparing vinyl DJ sets in VERTAX.',
    breadcrumbsAria: 'Breadcrumbs', coverAlt: 'Cover of {artist} — {title}', openVertax: 'Open VERTAX', launchTelegram: 'Launch in Telegram',
    tracksTitle: 'Record tracklist', position: 'Pos.', trackTitle: 'Title', duration: 'Time',
    pendingTitle: 'Tracklist is being added', pendingText: 'This record is already in the shared VERTAX catalog. Discogs, BPM and Camelot data will be added automatically.',
    aboutTitle: 'From record to finished set', aboutText: 'VERTAX helps vinyl DJs manage collections, find BPM and Camelot, check track compatibility and build DJ sets.', aboutLink: 'Learn about VERTAX →',
    sourceBefore: 'Release information and artwork are provided by', sourceAfter: 'BPM and Camelot may contain automatically detected or manually verified values.',
    notFoundTitle: 'Record not found | VERTAX', notFoundDescription: 'This record page is not available in the public VERTAX catalog yet.', notFoundH1: 'Record not found', notFoundText: 'The address may have changed or the release has not reached the public catalog yet.', openCatalog: 'Open catalog',
    unavailableTitle: 'Catalog temporarily unavailable | VERTAX', unavailableDescription: 'The public VERTAX catalog is temporarily unavailable.', unavailableH1: 'Catalog temporarily unavailable', unavailableText: 'The app is still working. Please try the catalog again later.',
    trackCount: '{count} tracks',
  },
  es: {
    navAria: 'Navegación principal', languageAria: 'Idioma del catálogo', brandAria: 'Abrir la aplicación VERTAX',
    catalog: 'Catálogo', about: 'Acerca de', openTelegram: 'Abrir en Telegram', webApp: 'Aplicación web', telegramApp: 'Mini App de Telegram',
    footer: 'Una herramienta para DJ de vinilo: colección, BPM, Camelot y creación de sets.',
    catalogTitle: 'Discos de vinilo con BPM y Camelot | VERTAX', catalogPageTitle: 'Catálogo de vinilos con BPM y Camelot — página {page} | VERTAX',
    catalogDescription: 'Discos y listas de canciones con datos de BPM y Camelot. El catálogo VERTAX para preparar sets de DJ en vinilo.',
    catalogH1: 'Vinilos, BPM y Camelot', catalogLead: 'Catálogo público de tracklists identificados en la base de VERTAX. Consulta el tempo y la compatibilidad armónica antes de preparar un set de DJ en vinilo.',
    searchLabel: 'Buscar por artista, lanzamiento, sello o número de catálogo', searchButton: 'Buscar',
    discogsTitle: 'Añadir una colección pública de Discogs', discogsText: 'Introduce un username. Los vinilos se añadirán al catálogo común de VERTAX y sus tracklists, BPM y Camelot se completarán automáticamente.',
    discogsUsername: 'Usuario de Discogs', discogsButton: 'Añadir al catálogo', discogsNote: 'No guardamos el nombre del propietario. Solo se incluyen vinilos públicos; los CD se omiten.',
    found: 'Resultados', page: 'Página', catalogAria: 'Catálogo de vinilos', paginationAria: 'Páginas del catálogo',
    nothingTitle: 'Sin resultados', nothingText: 'Prueba otra búsqueda o vuelve al catálogo completo.', showAll: 'Mostrar todos los discos',
    ctaTitle: 'Usa estos datos dentro de VERTAX', ctaText: 'Añade tus discos, corrige BPM y Camelot y crea sets compatibles.',
    releaseDataTitle: '{artist} — {title}: BPM y Camelot de los tracks | VERTAX', releasePlainTitle: '{artist} — {title}: disco de vinilo | VERTAX',
    releaseTracklist: 'Tracklist del vinilo', bpmKnown: 'BPM disponible para {count} tracks.', camelotKnown: 'Camelot disponible para {count} tracks.', releasePurpose: 'Datos para preparar sets de DJ en vinilo con VERTAX.',
    breadcrumbsAria: 'Migas de pan', coverAlt: 'Portada de {artist} — {title}', openVertax: 'Abrir VERTAX', launchTelegram: 'Abrir en Telegram',
    tracksTitle: 'Tracklist del disco', position: 'Pos.', trackTitle: 'Título', duration: 'Duración',
    pendingTitle: 'Tracklist pendiente', pendingText: 'Este disco ya está en el catálogo común de VERTAX. Los datos de Discogs, BPM y Camelot se añadirán automáticamente.',
    aboutTitle: 'Del vinilo al set terminado', aboutText: 'VERTAX ayuda a los DJ de vinilo a gestionar su colección, encontrar BPM y Camelot, comprobar compatibilidad y crear sets.', aboutLink: 'Conoce VERTAX →',
    sourceBefore: 'La información y la portada del lanzamiento proceden de', sourceAfter: 'Los valores BPM y Camelot pueden ser automáticos o verificados manualmente.',
    notFoundTitle: 'Disco no encontrado | VERTAX', notFoundDescription: 'Esta página aún no está disponible en el catálogo público de VERTAX.', notFoundH1: 'Disco no encontrado', notFoundText: 'La dirección puede haber cambiado o el lanzamiento aún no ha llegado al catálogo público.', openCatalog: 'Abrir catálogo',
    unavailableTitle: 'Catálogo temporalmente no disponible | VERTAX', unavailableDescription: 'El catálogo público de VERTAX no está disponible temporalmente.', unavailableH1: 'Catálogo temporalmente no disponible', unavailableText: 'La aplicación sigue funcionando. Inténtalo de nuevo más tarde.',
    trackCount: '{count} tracks',
  },
  ja: {
    navAria: 'メインナビゲーション', languageAria: 'カタログの言語', brandAria: 'VERTAXアプリを開く',
    catalog: 'カタログ', about: 'VERTAXについて', openTelegram: 'Telegramで開く', webApp: 'ウェブアプリ', telegramApp: 'Telegram Mini App',
    footer: 'レコードDJのためのコレクション、BPM、Camelot、セット作成ツール。',
    catalogTitle: 'BPMとCamelot付きレコードカタログ | VERTAX', catalogPageTitle: 'BPMとCamelot付きレコードカタログ — {page}ページ | VERTAX',
    catalogDescription: 'BPMとCamelotデータを収録したレコードとトラックリスト。レコードDJセットの準備に使えるVERTAXカタログです。',
    catalogH1: 'レコード、BPM、Camelot', catalogLead: 'VERTAXデータベースで特定されたトラックリストの公開カタログです。レコードDJセットを組む前にテンポとハーモニック相性を確認できます。',
    searchLabel: 'アーティスト、リリース、レーベル、カタログ番号で検索', searchButton: '検索',
    discogsTitle: '公開Discogsコレクションを追加', discogsText: 'ユーザー名を入力すると、レコードがVERTAX共有カタログに追加され、トラックリスト、BPM、Camelotが自動的に補完されます。',
    discogsUsername: 'Discogsユーザー名', discogsButton: 'カタログに追加', discogsNote: '所有者名は保存しません。公開されているレコードのみ対象で、CDは除外されます。',
    found: '件数', page: 'ページ', catalogAria: 'レコードカタログ', paginationAria: 'カタログページ',
    nothingTitle: '見つかりませんでした', nothingText: '別のキーワードを試すか、カタログ全体に戻ってください。', showAll: 'すべてのレコードを表示',
    ctaTitle: 'このデータをVERTAXで活用', ctaText: 'レコードを追加し、BPMやCamelotを修正して、相性の良いセットを作成できます。',
    releaseDataTitle: '{artist} — {title}: BPM・Camelotトラック情報 | VERTAX', releasePlainTitle: '{artist} — {title}: レコード | VERTAX',
    releaseTracklist: 'レコードのトラックリスト', bpmKnown: '{count}曲のBPMを収録。', camelotKnown: '{count}曲のCamelotを収録。', releasePurpose: 'VERTAXでレコードDJセットを準備するためのデータです。',
    breadcrumbsAria: 'パンくずリスト', coverAlt: '{artist} — {title}のジャケット', openVertax: 'VERTAXを開く', launchTelegram: 'Telegramで起動',
    tracksTitle: 'トラックリスト', position: '位置', trackTitle: 'タイトル', duration: '時間',
    pendingTitle: 'トラックリストを取得中', pendingText: 'このレコードはVERTAX共有カタログに登録済みです。Discogs、BPM、Camelotデータは自動的に追加されます。',
    aboutTitle: 'レコードから完成したセットへ', aboutText: 'VERTAXはレコードDJのコレクション管理、BPMとCamelotの確認、曲の相性判定、DJセット作成を支援します。', aboutLink: 'VERTAXについて →',
    sourceBefore: 'リリース情報とジャケット画像の提供元:', sourceAfter: 'BPMとCamelotには自動検出値または手動確認値が含まれる場合があります。',
    notFoundTitle: 'レコードが見つかりません | VERTAX', notFoundDescription: 'このレコードページはまだVERTAX公開カタログにありません。', notFoundH1: 'レコードが見つかりません', notFoundText: 'URLが変更されたか、まだ公開カタログに追加されていない可能性があります。', openCatalog: 'カタログを開く',
    unavailableTitle: 'カタログは一時的に利用できません | VERTAX', unavailableDescription: 'VERTAX公開カタログは一時的に利用できません。', unavailableH1: 'カタログは一時的に利用できません', unavailableText: 'アプリは引き続き利用できます。しばらくしてからお試しください。',
    trackCount: '{count}曲',
  },
  zh: {
    navAria: '主导航', languageAria: '目录语言', brandAria: '打开VERTAX应用',
    catalog: '目录', about: '关于', openTelegram: '在Telegram中打开', webApp: '网页应用', telegramApp: 'Telegram小程序',
    footer: '面向黑胶DJ的收藏、BPM、Camelot与曲目编排工具。',
    catalogTitle: '带BPM和Camelot的黑胶唱片目录 | VERTAX', catalogPageTitle: '黑胶BPM与Camelot目录 — 第{page}页 | VERTAX',
    catalogDescription: '收录BPM与Camelot数据的黑胶唱片和曲目表。VERTAX目录可用于准备黑胶DJ Set。',
    catalogH1: '黑胶唱片、BPM与Camelot', catalogLead: 'VERTAX数据库中已识别曲目表的公开目录。在编排黑胶DJ Set前，可查看速度和调性兼容性。',
    searchLabel: '按艺人、发行、厂牌或目录编号搜索', searchButton: '搜索',
    discogsTitle: '添加公开Discogs收藏', discogsText: '输入用户名后，黑胶发行将加入VERTAX公共目录，曲目表、BPM与Camelot数据会自动补全。',
    discogsUsername: 'Discogs用户名', discogsButton: '加入目录', discogsNote: '不会保存收藏者姓名。仅处理公开黑胶发行，CD会被跳过。',
    found: '找到', page: '页', catalogAria: '黑胶唱片目录', paginationAria: '目录分页',
    nothingTitle: '未找到结果', nothingText: '请更换关键词，或返回完整目录。', showAll: '显示所有唱片',
    ctaTitle: '在VERTAX中使用这些数据', ctaText: '添加你的唱片，修正BPM与Camelot，并编排兼容的DJ Set。',
    releaseDataTitle: '{artist} — {title}: 曲目BPM与Camelot | VERTAX', releasePlainTitle: '{artist} — {title}: 黑胶唱片 | VERTAX',
    releaseTracklist: '黑胶曲目表', bpmKnown: '已有{count}首曲目的BPM。', camelotKnown: '已有{count}首曲目的Camelot。', releasePurpose: '用于在VERTAX中准备黑胶DJ Set的数据。',
    breadcrumbsAria: '面包屑导航', coverAlt: '{artist} — {title}封面', openVertax: '打开VERTAX', launchTelegram: '在Telegram中启动',
    tracksTitle: '唱片曲目表', position: '位置', trackTitle: '曲名', duration: '时长',
    pendingTitle: '正在补充曲目表', pendingText: '这张唱片已进入VERTAX公共目录。Discogs、BPM与Camelot数据将自动补全。',
    aboutTitle: '从唱片到完整DJ Set', aboutText: 'VERTAX帮助黑胶DJ管理收藏、查找BPM与Camelot、检查曲目兼容性并编排DJ Set。', aboutLink: '了解VERTAX →',
    sourceBefore: '发行信息与封面来自', sourceAfter: 'BPM与Camelot可能包含自动识别或人工校验的数据。',
    notFoundTitle: '未找到唱片 | VERTAX', notFoundDescription: 'VERTAX公开目录中暂时没有此唱片页面。', notFoundH1: '未找到唱片', notFoundText: '地址可能已更改，或该发行尚未进入公开目录。', openCatalog: '打开目录',
    unavailableTitle: '目录暂时不可用 | VERTAX', unavailableDescription: 'VERTAX公开目录暂时不可用。', unavailableH1: '目录暂时不可用', unavailableText: '应用仍可正常使用，请稍后再试。',
    trackCount: '{count}首',
  },
};

function normalizeLocale(value) {
  const locale = String(value || '').toLowerCase().split('-')[0];
  return LOCALES.includes(locale) ? locale : 'ru';
}

function interpolate(value, values) {
  return String(value || '').replace(/\{(\w+)\}/g, (_, key) => String(values && values[key] != null ? values[key] : ''));
}

function getCopy(locale) {
  return COPY[normalizeLocale(locale)];
}

function getLocaleConfig(locale) {
  return CONFIG[normalizeLocale(locale)];
}

function localizedPath(locale, pathname) {
  const normalized = normalizeLocale(locale);
  const path = String(pathname || '/music').startsWith('/') ? String(pathname || '/music') : '/' + pathname;
  return normalized === 'ru' ? path : '/' + normalized + path;
}

function localizedUrl(locale, pathname) {
  return SITE_URL + localizedPath(locale, pathname);
}

function translate(locale, key, values) {
  const copy = getCopy(locale);
  return interpolate(copy[key] == null ? COPY.ru[key] : copy[key], values);
}

module.exports = {
  CONFIG,
  LOCALES,
  getCopy,
  getLocaleConfig,
  interpolate,
  localizedPath,
  localizedUrl,
  normalizeLocale,
  translate,
};
