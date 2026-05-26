/* VERTAX app i18n overlay. Keeps the original Russian render code intact. */
(function(){
  if (window.__vertaxAppI18nInstalled) return;
  window.__vertaxAppI18nInstalled = true;

  var STORAGE_KEY = 'vertax-app-lang';
  var langs = ['ru', 'en', 'zh', 'ja'];
  var labels = { ru: 'RU', en: 'EN', zh: '中文', ja: '日本' };

  var text = {
    en: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': 'main menu',
      'Найти пластинку': 'Find a record',
      'Коллекция': 'Collection',
      'Собрать сет': 'Build a set',
      'Импорт из Discogs': 'Discogs import',
      'service': 'service',
      'Резервная копия': 'Backup',
      'сохранить коллекцию': 'save collection',
      'about': 'about',
      'О проекте': 'About',
      'О приложении': 'About the app',
      'что это за штука': 'what is this',
      'support': 'support',
      'Донат': 'Donate',
      'поддержать VERTAX-01': 'support VERTAX-01',
      'VERTAX-01 · by Laiso Buck / Михаил Проскурин': 'VERTAX-01 · by Laiso Buck / Michael Proskurin',
      'Telegram автору': 'Message author',
      'Поддержать проект': 'Support the project',
      '← Назад': '← Back',
      'Добавить пластинку': 'Add record',
      'найти пластинку': 'find record',
      'Найти в Discogs': 'Search Discogs',
      'Ищу…': 'Searching...',
      'Discogs · виниловые релизы': 'Discogs · vinyl releases',
      'Слот пуст': 'Empty slot',
      'Введи артиста, релиз или название трека выше': 'Enter artist, release or track title above',
      'сессия': 'session',
      'Готово → треклисты': 'Done → tracklists',
      'кандидат №1': 'candidate #1',
      'варианты': 'variants',
      'Это моя пластинка': 'This is my record',
      'Открыть треклист': 'Open tracklist',
      'Открыть пластинку': 'Open record',
      'Загрузить треклист': 'Load tracklist',
      'Подтвердить совпадение…': 'Confirm match...',
      'Распознать заново': 'Recognize again',
      'Править детали…': 'Edit details...',
      'Пропускать в сетах': 'Skip in sets',
      'Вернуть в сеты': 'Return to sets',
      'Удалить': 'Delete',
      'Подтверждение': 'Confirmation',
      'Выбрать': 'Select',
      'Отмена': 'Cancel',
      'Отменить': 'Cancel',
      'Сохранить': 'Save',
      'Сохранено': 'Saved',
      'Справка': 'Help',
      'Пластинки': 'Records',
      'Сеты': 'Sets',
      'Сохранённые сеты': 'Saved sets',
      'Сохраненных сетов нет': 'No saved sets',
      'Сохранённых сетов нет': 'No saved sets',
      'Собрать сет из коллекции': 'Build a set from collection',
      'Выбрать пластинки / вся коллекция': 'Pick records / full collection',
      'Настройки': 'Settings',
      'Экспорт коллекции (JSON)': 'Export collection (JSON)',
      'Импорт коллекции (JSON)': 'Import collection (JSON)',
      'Стереть все данные': 'Erase all data',
      'Открыть': 'Open',
      'Удал.': 'Del.',
      'Сборка сета': 'Set builder',
      'BEST FLOW': 'BEST FLOW',
      'ПО ТЕМПУ': 'BY TEMPO',
      'ПО CAMELOT': 'BY CAMELOT',
      'ФИЛЬТР': 'FILTER',
      'СВОЙ': 'CUSTOM',
      'Диапазон темпа': 'Tempo range',
      'Стартовый Camelot': 'Starting Camelot',
      'Выбери Camelot': 'Pick Camelot',
      'Свой сет': 'Custom set',
      'Добавить трек из коллекции': 'Add track from collection',
      'Сгенерировать': 'Generate',
      'Пересобрать': 'Rebuild',
      'Экспорт TXT': 'Export TXT',
      'Сохранить сет': 'Save set',
      'сет': 'set',
      'трек.': 'tracks',
      'треков': 'tracks',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.': 'You need at least 2 tracks. Add records and fill BPM/Key.',
      'Есть треки без BPM / Camelot': 'Some tracks have no BPM / Camelot',
      'требуют проверки': 'need review',
      'Заполни значения вручную или исключи треки из сета.': 'Fill values manually or exclude tracks from the set.',
      'Показать и исправить': 'Show and fix',
      'Импорт из Discogs': 'Discogs import',
      'Загрузить коллекцию': 'Load collection',
      'Загружаем…': 'Loading...',
      'Загружено:': 'Loaded:',
      'пластинок...': 'records...',
      'опции': 'options',
      'Сразу подтянуть треклисты': 'Load tracklists immediately',
      'И BPM / Key': 'And BPM / Key',
      'Найдено пластинок:': 'Records found:',
      'Как добавить в коллекцию?': 'How to add them to collection?',
      'Заменить текущую коллекцию': 'Replace current collection',
      'Объединить с текущей': 'Merge with current',
      'Коллекция должна быть публичной в настройках профиля Discogs.': 'Collection must be public in Discogs profile settings.',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.': 'Enter your Discogs username and Vertax will load your collection automatically.',
      'Трек добавлен': 'Track added',
      'BPM/Key сохранены': 'BPM/Key saved',
      'править': 'edit',
      'убрать': 'remove',
      'перетащить': 'drag',
      'на пластинке': 'on record',
      'Та же пластинка рядом': 'Same record nearby',
      'Та же пластинка, что предыдущий трек': 'Same record as previous track',
      'Режим по темпу: сет строится от меньшего BPM к большему': 'Tempo mode: set goes from lower BPM to higher BPM',
      'режим по темпу: сет строится от меньшего BPM к большему': 'tempo mode: set goes from lower BPM to higher BPM',
      'Выбери пластинки для сета': 'Pick records for the set',
      'Собрать из выбранных': 'Build from selected',
      'Вся коллекция': 'Full collection',
      'Текущая сессия': 'Current session',
      'Выбрать все видимые': 'Select all visible',
      'Снять видимые': 'Clear visible',
      'Добавить выбранные': 'Add selected'
    },
    zh: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': '主菜单',
      'Найти пластинку': '查找唱片',
      'Коллекция': '收藏库',
      'Собрать сет': '生成 DJ Set',
      'Импорт из Discogs': 'Discogs 导入',
      'service': '服务',
      'Резервная копия': '备份',
      'сохранить коллекцию': '保存收藏库',
      'about': '关于',
      'О проекте': '关于项目',
      'О приложении': '关于应用',
      'что это за штука': '这是什么',
      'support': '支持',
      'Донат': '捐助',
      'поддержать VERTAX-01': '支持 VERTAX-01',
      'Telegram автору': '联系作者',
      'Поддержать проект': '支持项目',
      '← Назад': '← 返回',
      'Добавить пластинку': '添加唱片',
      'найти пластинку': '查找唱片',
      'Найти в Discogs': '在 Discogs 搜索',
      'Ищу…': '搜索中...',
      'Discogs · виниловые релизы': 'Discogs · 黑胶发行',
      'Слот пуст': '空槽位',
      'Введи артиста, релиз или название трека выше': '输入艺人、发行或曲名',
      'сессия': '本次会话',
      'Готово → треклисты': '完成 → 曲目列表',
      'кандидат №1': '候选 #1',
      'варианты': '其他选项',
      'Это моя пластинка': '这是我的唱片',
      'Открыть треклист': '打开曲目列表',
      'Открыть пластинку': '打开唱片',
      'Загрузить треклист': '加载曲目列表',
      'Подтвердить совпадение…': '确认匹配...',
      'Распознать заново': '重新识别',
      'Править детали…': '编辑详情...',
      'Пропускать в сетах': 'Set 中跳过',
      'Вернуть в сеты': '加入 Set',
      'Удалить': '删除',
      'Отмена': '取消',
      'Отменить': '取消',
      'Сохранить': '保存',
      'Сохранено': '已保存',
      'Справка': '帮助',
      'Пластинки': '唱片',
      'Сеты': 'Sets',
      'Сохранённые сеты': '已保存 Sets',
      'Сохраненных сетов нет': '暂无保存的 Sets',
      'Сохранённых сетов нет': '暂无保存的 Sets',
      'Собрать сет из коллекции': '从收藏库生成 Set',
      'Выбрать пластинки / вся коллекция': '选择唱片 / 全部收藏',
      'Настройки': '设置',
      'Экспорт коллекции (JSON)': '导出收藏库 (JSON)',
      'Импорт коллекции (JSON)': '导入收藏库 (JSON)',
      'Стереть все данные': '清除所有数据',
      'Открыть': '打开',
      'Удал.': '删.',
      'Сборка сета': 'Set 生成器',
      'ПО ТЕМПУ': '按速度',
      'ПО CAMELOT': '按 Camelot',
      'ФИЛЬТР': '筛选',
      'СВОЙ': '自定义',
      'Диапазон темпа': '速度范围',
      'Стартовый Camelot': '起始 Camelot',
      'Выбери Camelot': '选择 Camelot',
      'Свой сет': '自定义 Set',
      'Добавить трек из коллекции': '从收藏库添加曲目',
      'Сгенерировать': '生成',
      'Пересобрать': '重新生成',
      'Экспорт TXT': '导出 TXT',
      'Сохранить сет': '保存 Set',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.': '至少需要 2 首曲目。请添加唱片并填写 BPM/Key。',
      'Есть треки без BPM / Camelot': '有曲目缺少 BPM / Camelot',
      'требуют проверки': '需要检查',
      'Заполни значения вручную или исключи треки из сета.': '手动填写，或从 Set 中排除。',
      'Показать и исправить': '查看并修正',
      'Загрузить коллекцию': '加载收藏库',
      'Загружаем…': '加载中...',
      'Загружено:': '已加载:',
      'пластинок...': '张唱片...',
      'опции': '选项',
      'Сразу подтянуть треклисты': '立即加载曲目列表',
      'И BPM / Key': '并加载 BPM / Key',
      'Найдено пластинок:': '找到唱片:',
      'Как добавить в коллекцию?': '如何加入收藏库？',
      'Заменить текущую коллекцию': '替换当前收藏库',
      'Объединить с текущей': '合并到当前收藏库',
      'Коллекция должна быть публичной в настройках профиля Discogs.': 'Discogs 个人资料中的收藏库必须是公开的。',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.': '输入 Discogs 用户名，Vertax 会自动加载收藏库。',
      'править': '编辑',
      'убрать': '移除',
      'перетащить': '拖动',
      'на пластинке': '唱片位置',
      'Та же пластинка рядом': '相邻曲目来自同一唱片',
      'Выбери пластинки для сета': '选择用于 Set 的唱片',
      'Собрать из выбранных': '从所选生成',
      'Вся коллекция': '全部收藏',
      'Текущая сессия': '当前会话',
      'Выбрать все видимые': '选择所有可见项',
      'Снять видимые': '取消可见项',
      'Добавить выбранные': '添加所选项'
    },
    ja: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': 'メインメニュー',
      'Найти пластинку': 'レコードを探す',
      'Коллекция': 'コレクション',
      'Собрать сет': 'セットを作る',
      'Импорт из Discogs': 'Discogs インポート',
      'service': 'サービス',
      'Резервная копия': 'バックアップ',
      'сохранить коллекцию': 'コレクションを保存',
      'about': 'about',
      'О проекте': 'プロジェクトについて',
      'О приложении': 'アプリについて',
      'что это за штука': 'これは何か',
      'support': 'サポート',
      'Донат': '寄付',
      'поддержать VERTAX-01': 'VERTAX-01 を支援',
      'Telegram автору': '作者に連絡',
      'Поддержать проект': 'プロジェクトを支援',
      '← Назад': '← 戻る',
      'Добавить пластинку': 'レコードを追加',
      'найти пластинку': 'レコード検索',
      'Найти в Discogs': 'Discogs で検索',
      'Ищу…': '検索中...',
      'Discogs · виниловые релизы': 'Discogs · vinyl releases',
      'Слот пуст': '空のスロット',
      'Введи артиста, релиз или название трека выше': 'アーティスト、リリース、曲名を入力',
      'сессия': 'セッション',
      'Готово → треклисты': '完了 → トラックリスト',
      'кандидат №1': '候補 #1',
      'варианты': '候補',
      'Это моя пластинка': 'このレコードです',
      'Открыть треклист': 'トラックリストを開く',
      'Открыть пластинку': 'レコードを開く',
      'Загрузить треклист': 'トラックリストを読み込む',
      'Подтвердить совпадение…': '一致を確認...',
      'Распознать заново': '再認識',
      'Править детали…': '詳細を編集...',
      'Пропускать в сетах': 'セットで除外',
      'Вернуть в сеты': 'セットに戻す',
      'Удалить': '削除',
      'Отмена': 'キャンセル',
      'Отменить': 'キャンセル',
      'Сохранить': '保存',
      'Сохранено': '保存しました',
      'Справка': 'ヘルプ',
      'Пластинки': 'レコード',
      'Сеты': 'セット',
      'Сохранённые сеты': '保存済みセット',
      'Сохраненных сетов нет': '保存済みセットはありません',
      'Сохранённых сетов нет': '保存済みセットはありません',
      'Собрать сет из коллекции': 'コレクションからセットを作る',
      'Выбрать пластинки / вся коллекция': 'レコード選択 / 全コレクション',
      'Настройки': '設定',
      'Экспорт коллекции (JSON)': 'コレクションを書き出す (JSON)',
      'Импорт коллекции (JSON)': 'コレクションを読み込む (JSON)',
      'Стереть все данные': 'すべてのデータを削除',
      'Открыть': '開く',
      'Удал.': '削除',
      'Сборка сета': 'セットビルダー',
      'ПО ТЕМПУ': 'テンポ順',
      'ПО CAMELOT': 'Camelot',
      'ФИЛЬТР': 'フィルター',
      'СВОЙ': 'カスタム',
      'Диапазон темпа': 'テンポ範囲',
      'Стартовый Camelot': '開始 Camelot',
      'Выбери Camelot': 'Camelot を選択',
      'Свой сет': 'カスタムセット',
      'Добавить трек из коллекции': 'コレクションから曲を追加',
      'Сгенерировать': '生成',
      'Пересобрать': '再生成',
      'Экспорт TXT': 'TXT 書き出し',
      'Сохранить сет': 'セットを保存',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.': '最低 2 曲が必要です。レコードを追加し BPM/Key を入力してください。',
      'Есть треки без BPM / Camelot': 'BPM / Camelot がない曲があります',
      'требуют проверки': '確認が必要',
      'Заполни значения вручную или исключи треки из сета.': '手動で入力するか、セットから除外してください。',
      'Показать и исправить': '表示して修正',
      'Загрузить коллекцию': 'コレクションを読み込む',
      'Загружаем…': '読み込み中...',
      'Загружено:': '読み込み済み:',
      'пластинок...': '枚...',
      'опции': 'オプション',
      'Сразу подтянуть треклисты': 'トラックリストも読み込む',
      'И BPM / Key': 'BPM / Key も読み込む',
      'Найдено пластинок:': '見つかったレコード:',
      'Как добавить в коллекцию?': 'コレクションへの追加方法',
      'Заменить текущую коллекцию': '現在のコレクションを置換',
      'Объединить с текущей': '現在のものと結合',
      'Коллекция должна быть публичной в настройках профиля Discogs.': 'Discogs プロフィールでコレクションを公開にしてください。',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.': 'Discogs username を入力すると、Vertax が自動で読み込みます。',
      'править': '編集',
      'убрать': '外す',
      'перетащить': 'ドラッグ',
      'на пластинке': 'レコード上',
      'Та же пластинка рядом': '隣の曲が同じレコードです',
      'Выбери пластинки для сета': 'セット用のレコードを選択',
      'Собрать из выбранных': '選択から作成',
      'Вся коллекция': '全コレクション',
      'Текущая сессия': '現在のセッション',
      'Выбрать все видимые': '表示中をすべて選択',
      'Снять видимые': '表示中を解除',
      'Добавить выбранные': '選択を追加'
    }
  };

  var placeholders = {
    en: {
      'Артист, релиз или трек…': 'Artist, release or track...',
      'Поиск: артист / название / лейбл / каталог…': 'Search: artist / title / label / catalog...',
      'Discogs username': 'Discogs username'
    },
    zh: {
      'Артист, релиз или трек…': '艺人、发行或曲名...',
      'Поиск: артист / название / лейбл / каталог…': '搜索：艺人 / 标题 / 厂牌 / 编号...',
      'Discogs username': 'Discogs 用户名'
    },
    ja: {
      'Артист, релиз или трек…': 'アーティスト、リリース、曲名...',
      'Поиск: артист / название / лейбл / каталог…': '検索: アーティスト / タイトル / レーベル / カタログ...',
      'Discogs username': 'Discogs username'
    }
  };

  function normalize(s){
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function getLang(){
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (langs.indexOf(saved) >= 0) return saved;
      var queryLang = new URLSearchParams(window.location.search || '').get('lang');
      if (langs.indexOf(queryLang) >= 0) return queryLang;
    } catch(_) {}
    return 'ru';
  }

  function setLang(lang){
    if (langs.indexOf(lang) < 0) lang = 'ru';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch(_) {}
    window.__vertaxAppLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    if (typeof render === 'function') render();
    else translateApp();
  }

  function renderSwitcher(){
    var lang = getLang();
    return '<span class="vertax-lang-switcher" role="group" aria-label="Language">' +
      langs.map(function(code){
        return '<button class="vertax-lang-btn' + (code === lang ? ' is-active' : '') + '" type="button" data-action="app-lang" data-lang="' + code + '" aria-pressed="' + (code === lang ? 'true' : 'false') + '">' + labels[code] + '</button>';
      }).join('') +
      '</span>';
  }

  function ensureSwitcher(root){
    var side = root.querySelector('.laiso-chassis-side');
    if (!side || side.querySelector('.vertax-lang-switcher')) return;
    side.insertAdjacentHTML('afterbegin', renderSwitcher());
  }

  function translateTextNode(node, dict){
    var raw = normalize(node.nodeValue);
    if (!raw) return;
    if (dict[raw]) {
      node.nodeValue = node.nodeValue.replace(raw, dict[raw]);
      return;
    }
    var translated = raw
      .replace(/^Пластинки \((\d+)\)$/i, function(_, n){ return (dict['Пластинки'] || 'Records') + ' (' + n + ')'; })
      .replace(/^Сеты \((\d+)\)$/i, function(_, n){ return (dict['Сеты'] || 'Sets') + ' (' + n + ')'; })
      .replace(/^сет · (\d+) трек\.$/i, function(_, n){ return (dict['сет'] || 'set') + ' · ' + n + ' ' + (dict['трек.'] || 'tracks'); })
      .replace(/^сессия · (\d+)\/(\d+)$/i, function(_, a, b){ return (dict['сессия'] || 'session') + ' · ' + a + '/' + b; })
      .replace(/^Диапазон темпа ± (\d+) BPM$/i, function(_, n){ return (dict['Диапазон темпа'] || 'Tempo range') + ' ± ' + n + ' BPM'; });
    if (translated !== raw) node.nodeValue = node.nodeValue.replace(raw, translated);
  }

  function translateApp(){
    var root = document.getElementById('laiso-root');
    if (!root) return;
    ensureSwitcher(root);
    var lang = getLang();
    window.__vertaxAppLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    root.querySelectorAll('.vertax-lang-btn').forEach(function(btn){
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (lang === 'ru') return;
    var dict = text[lang] || {};
    var ph = placeholders[lang] || {};
    root.querySelectorAll('input, textarea').forEach(function(el){
      var p = el.getAttribute('placeholder');
      if (p && ph[p]) el.setAttribute('placeholder', ph[p]);
    });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        var parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(parent.nodeName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest && parent.closest('.vertax-lang-switcher')) return NodeFilter.FILTER_REJECT;
        return normalize(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){ translateTextNode(node, dict); });
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('#laiso-app [data-action="app-lang"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    setLang(btn.getAttribute('data-lang') || 'ru');
  }, true);

  function boot(){
    if (typeof window.vertaxRegisterAfterRender === 'function') {
      window.vertaxRegisterAfterRender(function(){ setTimeout(translateApp, 0); });
      setTimeout(translateApp, 0);
      return;
    }
    setTimeout(boot, 120);
  }

  window.vertaxTranslateApp = translateApp;
  window.vertaxSetAppLang = setLang;
  boot();
})();
