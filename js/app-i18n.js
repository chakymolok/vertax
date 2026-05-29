/* VERTAX app i18n overlay. Keeps the original Russian render code intact. */
(function () {
  if (window.__vertaxAppI18nInstalled) return;
  window.__vertaxAppI18nInstalled = true;

  var STORAGE_KEY = 'vertax-app-lang';
  var langs = ['ru', 'en', 'zh', 'ja'];
  var labels = { ru: 'RU', en: 'EN', zh: '中文', ja: '日本' };
  var langNames = { ru: 'Русский', en: 'English', zh: '中文', ja: '日本語' };
  var isTranslating = false;
  var observer = null;
  var observerTimer = null;
  var heartbeat = null;

  var text = {
    en: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': 'main menu',
      'Найти пластинку': 'Find a record',
      Коллекция: 'Collection',
      'Собрать сет': 'Build a set',
      'Проверить пластинку': 'Check a record',
      'Подойдёт ли пластинка?': 'Will this record fit?',
      'проверить релиз по коллекции': 'check release against collection',
      'Подойдёт ли эта пластинка к моей коллекции?': 'Will this record fit my collection?',
      'Название релиза или каталожный номер': 'Release title or catalog number',
      'Проверяю…': 'Checking...',
      результат: 'result',
      Оценка: 'Confidence',
      Данные: 'Data',
      Пары: 'Matches',
      Market: 'Market',
      'Цена на Discogs': 'Discogs price',
      'К покупке': 'Buy signal',
      Коротко: 'Summary',
      Причина: 'Reason',
      предварительная: 'preliminary',
      умеренная: 'moderate',
      надёжная: 'reliable',
      'данных хватает': 'enough data',
      'часть данных': 'partial data',
      'мало данных': 'little data',
      покрытие: 'coverage',
      'отдельный скор': 'separate score',
      'музыка + рейтинг': 'music + rating',
      'средняя цена': 'average price',
      'минимальная цена': 'minimum price',
      'нет цены': 'no price',
      голосов: 'votes',
      'в продаже': 'for sale',
      маркетплейс: 'marketplace',
      'нет рейтинга': 'no rating',
      'нет данных': 'no data',
      'лучшие совпадения': 'best matches',
      'Не вписались': 'Did not fit',
      'Не нашли BPM/Key': 'BPM/Key not found',
      'Пересчитать анализ': 'Recalculate',
      'Получить DJ-разбор': 'Get DJ breakdown',
      'AI DJ-разбор': 'AI DJ breakdown',
      'DJ-разбор': 'DJ breakdown',
      'Думаю…': 'Thinking...',
      'Думаю по делу…': 'Thinking it through...',
      'DJ-разбор временно недоступен.': 'DJ breakdown is temporarily unavailable.',
      'DJ-разбор временно недоступен: у Gemini закончилась квота. Можно включить billing в Google AI Studio или добавить GROQ_API_KEY как запасной AI-провайдер.':
        'DJ breakdown is temporarily unavailable: Gemini quota is exhausted. Enable billing in Google AI Studio or add GROQ_API_KEY as a fallback AI provider.',
      'Импорт из Discogs': 'Discogs import',
      service: 'service',
      'Резервная копия': 'Backup',
      'сохранить коллекцию': 'save collection',
      about: 'about',
      'О проекте': 'About',
      'О приложении': 'About the app',
      'что это за штука': 'what is this',
      support: 'support',
      Донат: 'Donate',
      'поддержать VERTAX-01': 'support VERTAX-01',
      'VERTAX-01 · by Laiso Buck / Михаил Проскурин':
        'VERTAX-01 · by Laiso Buck / Michael Proskurin',
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
      сессия: 'session',
      'Готово → треклисты': 'Done → tracklists',
      'кандидат №1': 'candidate #1',
      варианты: 'variants',
      'Это моя пластинка': 'This is my record',
      'Открыть треклист': 'Open tracklist',
      'Открыть пластинку': 'Open record',
      'Загрузить треклист': 'Load tracklist',
      'Подтвердить совпадение…': 'Confirm match...',
      'Распознать заново': 'Recognize again',
      'Править детали…': 'Edit details...',
      'Пропускать в сетах': 'Skip in sets',
      'Вернуть в сеты': 'Return to sets',
      Удалить: 'Delete',
      Подтверждение: 'Confirmation',
      Выбрать: 'Select',
      Отмена: 'Cancel',
      Отменить: 'Cancel',
      Сохранить: 'Save',
      Сохранено: 'Saved',
      Справка: 'Help',
      Пластинки: 'Records',
      Сеты: 'Sets',
      'Сохранённые сеты': 'Saved sets',
      'Сохраненных сетов нет': 'No saved sets',
      'Сохранённых сетов нет': 'No saved sets',
      'Собрать сет из коллекции': 'Build a set from collection',
      'Выбрать пластинки / вся коллекция': 'Pick records / full collection',
      Настройки: 'Settings',
      'Экспорт коллекции (JSON)': 'Export collection (JSON)',
      'Импорт коллекции (JSON)': 'Import collection (JSON)',
      'Стереть все данные': 'Erase all data',
      Открыть: 'Open',
      'Удал.': 'Del.',
      'Сборка сета': 'Set builder',
      'BEST FLOW': 'BEST FLOW',
      'ПО ТЕМПУ': 'BY TEMPO',
      'ПО CAMELOT': 'BY CAMELOT',
      ФИЛЬТР: 'FILTER',
      СВОЙ: 'CUSTOM',
      'Диапазон темпа': 'Tempo range',
      'Стартовый Camelot': 'Starting Camelot',
      'Выбери Camelot': 'Pick Camelot',
      'Свой сет': 'Custom set',
      'Добавить трек из коллекции': 'Add track from collection',
      Сгенерировать: 'Generate',
      Пересобрать: 'Rebuild',
      'Экспорт TXT': 'Export TXT',
      'Сохранить сет': 'Save set',
      сет: 'set',
      'трек.': 'tracks',
      треков: 'tracks',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.':
        'You need at least 2 tracks. Add records and fill BPM/Key.',
      'Есть треки без BPM / Camelot': 'Some tracks have no BPM / Camelot',
      'требуют проверки': 'need review',
      'Заполни значения вручную или исключи треки из сета.':
        'Fill values manually or exclude tracks from the set.',
      'Показать и исправить': 'Show and fix',
      'Импорт из Discogs': 'Discogs import',
      'Загрузить коллекцию': 'Load collection',
      'Загружаем…': 'Loading...',
      'Загружено:': 'Loaded:',
      'пластинок...': 'records...',
      опции: 'options',
      'Сразу подтянуть треклисты': 'Load tracklists immediately',
      'И BPM / Key': 'And BPM / Key',
      'Найдено пластинок:': 'Records found:',
      'Как добавить в коллекцию?': 'How to add them to collection?',
      'Заменить текущую коллекцию': 'Replace current collection',
      'Объединить с текущей': 'Merge with current',
      'Коллекция должна быть публичной в настройках профиля Discogs.':
        'Collection must be public in Discogs profile settings.',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.':
        'Enter your Discogs username and Vertax will load your collection automatically.',
      'Трек добавлен': 'Track added',
      'BPM/Key сохранены': 'BPM/Key saved',
      править: 'edit',
      убрать: 'remove',
      перетащить: 'drag',
      'на пластинке': 'on record',
      'Та же пластинка рядом': 'Same record nearby',
      'Та же пластинка, что предыдущий трек': 'Same record as previous track',
      'Режим по темпу: сет строится от меньшего BPM к большему':
        'Tempo mode: set goes from lower BPM to higher BPM',
      'режим по темпу: сет строится от меньшего BPM к большему':
        'tempo mode: set goes from lower BPM to higher BPM',
      'Выбери пластинки для сета': 'Pick records for the set',
      'Собрать из выбранных': 'Build from selected',
      'Вся коллекция': 'Full collection',
      'Текущая сессия': 'Current session',
      'Выбрать все видимые': 'Select all visible',
      'Снять видимые': 'Clear visible',
      'Добавить выбранные': 'Add selected',
    },
    zh: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': '主菜单',
      'Найти пластинку': '查找唱片',
      Коллекция: '收藏库',
      'Собрать сет': '生成 DJ Set',
      'Проверить пластинку': '检查唱片',
      'Подойдёт ли пластинка?': '这张唱片合适吗？',
      'проверить релиз по коллекции': '按收藏检查发行',
      'Подойдёт ли эта пластинка к моей коллекции?': '这张唱片适合我的收藏吗？',
      'Название релиза или каталожный номер': '发行名称或目录编号',
      'Проверяю…': '检查中...',
      результат: '结果',
      Оценка: '可信度',
      Данные: '数据',
      Пары: '匹配',
      Market: '市场',
      'Цена на Discogs': 'Discogs 价格',
      'К покупке': '购买参考',
      Коротко: '摘要',
      Причина: '原因',
      предварительная: '初步',
      умеренная: '中等',
      надёжная: '可靠',
      'данных хватает': '数据足够',
      'часть данных': '部分数据',
      'мало данных': '数据较少',
      покрытие: '覆盖率',
      'отдельный скор': '单独评分',
      'музыка + рейтинг': '音乐 + 评分',
      'средняя цена': '平均价格',
      'минимальная цена': '最低价格',
      'нет цены': '无价格',
      голосов: '票',
      'в продаже': '在售',
      маркетплейс: '市场',
      'нет рейтинга': '无评分',
      'нет данных': '无数据',
      'лучшие совпадения': '最佳匹配',
      'Не вписались': '不太匹配',
      'Не нашли BPM/Key': '未找到 BPM/Key',
      'Пересчитать анализ': '重新计算',
      'Получить DJ-разбор': '获取 DJ 解读',
      'AI DJ-разбор': 'AI DJ 解读',
      'DJ-разбор': 'DJ 解读',
      'Думаю…': '思考中...',
      'Думаю по делу…': '正在分析...',
      'DJ-разбор временно недоступен.': 'DJ 解读暂时不可用。',
      'DJ-разбор временно недоступен: у Gemini закончилась квота. Можно включить billing в Google AI Studio или добавить GROQ_API_KEY как запасной AI-провайдер.':
        'DJ 解读暂时不可用：Gemini 配额已用完。请在 Google AI Studio 启用 billing，或添加 GROQ_API_KEY 作为备用 AI。',
      'Импорт из Discogs': 'Discogs 导入',
      service: '服务',
      'Резервная копия': '备份',
      'сохранить коллекцию': '保存收藏库',
      about: '关于',
      'О проекте': '关于项目',
      'О приложении': '关于应用',
      'что это за штука': '这是什么',
      support: '支持',
      Донат: '捐助',
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
      сессия: '本次会话',
      'Готово → треклисты': '完成 → 曲目列表',
      'кандидат №1': '候选 #1',
      варианты: '其他选项',
      'Это моя пластинка': '这是我的唱片',
      'Открыть треклист': '打开曲目列表',
      'Открыть пластинку': '打开唱片',
      'Загрузить треклист': '加载曲目列表',
      'Подтвердить совпадение…': '确认匹配...',
      'Распознать заново': '重新识别',
      'Править детали…': '编辑详情...',
      'Пропускать в сетах': 'Set 中跳过',
      'Вернуть в сеты': '加入 Set',
      Удалить: '删除',
      Отмена: '取消',
      Отменить: '取消',
      Сохранить: '保存',
      Сохранено: '已保存',
      Справка: '帮助',
      Пластинки: '唱片',
      Сеты: 'Sets',
      'Сохранённые сеты': '已保存 Sets',
      'Сохраненных сетов нет': '暂无保存的 Sets',
      'Сохранённых сетов нет': '暂无保存的 Sets',
      'Собрать сет из коллекции': '从收藏库生成 Set',
      'Выбрать пластинки / вся коллекция': '选择唱片 / 全部收藏',
      Настройки: '设置',
      'Экспорт коллекции (JSON)': '导出收藏库 (JSON)',
      'Импорт коллекции (JSON)': '导入收藏库 (JSON)',
      'Стереть все данные': '清除所有数据',
      Открыть: '打开',
      'Удал.': '删.',
      'Сборка сета': 'Set 生成器',
      'ПО ТЕМПУ': '按速度',
      'ПО CAMELOT': '按 Camelot',
      ФИЛЬТР: '筛选',
      СВОЙ: '自定义',
      'Диапазон темпа': '速度范围',
      'Стартовый Camelot': '起始 Camelot',
      'Выбери Camelot': '选择 Camelot',
      'Свой сет': '自定义 Set',
      'Добавить трек из коллекции': '从收藏库添加曲目',
      Сгенерировать: '生成',
      Пересобрать: '重新生成',
      'Экспорт TXT': '导出 TXT',
      'Сохранить сет': '保存 Set',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.':
        '至少需要 2 首曲目。请添加唱片并填写 BPM/Key。',
      'Есть треки без BPM / Camelot': '有曲目缺少 BPM / Camelot',
      'требуют проверки': '需要检查',
      'Заполни значения вручную или исключи треки из сета.': '手动填写，或从 Set 中排除。',
      'Показать и исправить': '查看并修正',
      'Загрузить коллекцию': '加载收藏库',
      'Загружаем…': '加载中...',
      'Загружено:': '已加载:',
      'пластинок...': '张唱片...',
      опции: '选项',
      'Сразу подтянуть треклисты': '立即加载曲目列表',
      'И BPM / Key': '并加载 BPM / Key',
      'Найдено пластинок:': '找到唱片:',
      'Как добавить в коллекцию?': '如何加入收藏库？',
      'Заменить текущую коллекцию': '替换当前收藏库',
      'Объединить с текущей': '合并到当前收藏库',
      'Коллекция должна быть публичной в настройках профиля Discogs.':
        'Discogs 个人资料中的收藏库必须是公开的。',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.':
        '输入 Discogs 用户名，Vertax 会自动加载收藏库。',
      править: '编辑',
      убрать: '移除',
      перетащить: '拖动',
      'на пластинке': '唱片位置',
      'Та же пластинка рядом': '相邻曲目来自同一唱片',
      'Выбери пластинки для сета': '选择用于 Set 的唱片',
      'Собрать из выбранных': '从所选生成',
      'Вся коллекция': '全部收藏',
      'Текущая сессия': '当前会话',
      'Выбрать все видимые': '选择所有可见项',
      'Снять видимые': '取消可见项',
      'Добавить выбранные': '添加所选项',
    },
    ja: {
      'by Laiso Buck / Михаил Проскурин': 'by Laiso Buck / Michael Proskurin',
      'главное меню': 'メインメニュー',
      'Найти пластинку': 'レコードを探す',
      Коллекция: 'コレクション',
      'Собрать сет': 'セットを作る',
      'Проверить пластинку': 'レコードを確認',
      'Подойдёт ли пластинка?': 'このレコードは合う？',
      'проверить релиз по коллекции': 'コレクションに照合',
      'Подойдёт ли эта пластинка к моей коллекции?': 'このレコードはコレクションに合う？',
      'Название релиза или каталожный номер': 'リリース名またはカタログ番号',
      'Проверяю…': '確認中...',
      результат: '結果',
      Оценка: '信頼度',
      Данные: 'データ',
      Пары: 'マッチ',
      Market: 'マーケット',
      'Цена на Discogs': 'Discogs価格',
      'К покупке': '購入目安',
      Коротко: '要約',
      Причина: '理由',
      предварительная: '暫定',
      умеренная: '中程度',
      надёжная: '信頼できる',
      'данных хватает': 'データ十分',
      'часть данных': '一部データ',
      'мало данных': 'データ少なめ',
      покрытие: 'カバー率',
      'отдельный скор': '別スコア',
      'музыка + рейтинг': '音楽 + 評価',
      'средняя цена': '平均価格',
      'минимальная цена': '最低価格',
      'нет цены': '価格なし',
      голосов: '票',
      'в продаже': '販売中',
      маркетплейс: 'マーケット',
      'нет рейтинга': '評価なし',
      'нет данных': 'データなし',
      'лучшие совпадения': 'ベストマッチ',
      'Не вписались': '合わなかった曲',
      'Не нашли BPM/Key': 'BPM/Key 未検出',
      'Пересчитать анализ': '再計算',
      'Получить DJ-разбор': 'DJコメントを取得',
      'AI DJ-разбор': 'AI DJコメント',
      'DJ-разбор': 'DJコメント',
      'Думаю…': '考え中...',
      'Думаю по делу…': '分析中...',
      'DJ-разбор временно недоступен.': 'DJコメントは一時的に利用できません。',
      'DJ-разбор временно недоступен: у Gemini закончилась квота. Можно включить billing в Google AI Studio или добавить GROQ_API_KEY как запасной AI-провайдер.':
        'DJコメントは一時的に利用できません。Gemini のクォータが上限です。Google AI Studio で billing を有効にするか、GROQ_API_KEY をフォールバックとして追加してください。',
      'Импорт из Discogs': 'Discogs インポート',
      service: 'サービス',
      'Резервная копия': 'バックアップ',
      'сохранить коллекцию': 'コレクションを保存',
      about: 'about',
      'О проекте': 'プロジェクトについて',
      'О приложении': 'アプリについて',
      'что это за штука': 'これは何か',
      support: 'サポート',
      Донат: '寄付',
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
      сессия: 'セッション',
      'Готово → треклисты': '完了 → トラックリスト',
      'кандидат №1': '候補 #1',
      варианты: '候補',
      'Это моя пластинка': 'このレコードです',
      'Открыть треклист': 'トラックリストを開く',
      'Открыть пластинку': 'レコードを開く',
      'Загрузить треклист': 'トラックリストを読み込む',
      'Подтвердить совпадение…': '一致を確認...',
      'Распознать заново': '再認識',
      'Править детали…': '詳細を編集...',
      'Пропускать в сетах': 'セットで除外',
      'Вернуть в сеты': 'セットに戻す',
      Удалить: '削除',
      Отмена: 'キャンセル',
      Отменить: 'キャンセル',
      Сохранить: '保存',
      Сохранено: '保存しました',
      Справка: 'ヘルプ',
      Пластинки: 'レコード',
      Сеты: 'セット',
      'Сохранённые сеты': '保存済みセット',
      'Сохраненных сетов нет': '保存済みセットはありません',
      'Сохранённых сетов нет': '保存済みセットはありません',
      'Собрать сет из коллекции': 'コレクションからセットを作る',
      'Выбрать пластинки / вся коллекция': 'レコード選択 / 全コレクション',
      Настройки: '設定',
      'Экспорт коллекции (JSON)': 'コレクションを書き出す (JSON)',
      'Импорт коллекции (JSON)': 'コレクションを読み込む (JSON)',
      'Стереть все данные': 'すべてのデータを削除',
      Открыть: '開く',
      'Удал.': '削除',
      'Сборка сета': 'セットビルダー',
      'ПО ТЕМПУ': 'テンポ順',
      'ПО CAMELOT': 'Camelot',
      ФИЛЬТР: 'フィルター',
      СВОЙ: 'カスタム',
      'Диапазон темпа': 'テンポ範囲',
      'Стартовый Camelot': '開始 Camelot',
      'Выбери Camelot': 'Camelot を選択',
      'Свой сет': 'カスタムセット',
      'Добавить трек из коллекции': 'コレクションから曲を追加',
      Сгенерировать: '生成',
      Пересобрать: '再生成',
      'Экспорт TXT': 'TXT 書き出し',
      'Сохранить сет': 'セットを保存',
      'Нужно минимум 2 трека. Добавь пластинки и проставь BPM/Key.':
        '最低 2 曲が必要です。レコードを追加し BPM/Key を入力してください。',
      'Есть треки без BPM / Camelot': 'BPM / Camelot がない曲があります',
      'требуют проверки': '確認が必要',
      'Заполни значения вручную или исключи треки из сета.':
        '手動で入力するか、セットから除外してください。',
      'Показать и исправить': '表示して修正',
      'Загрузить коллекцию': 'コレクションを読み込む',
      'Загружаем…': '読み込み中...',
      'Загружено:': '読み込み済み:',
      'пластинок...': '枚...',
      опции: 'オプション',
      'Сразу подтянуть треклисты': 'トラックリストも読み込む',
      'И BPM / Key': 'BPM / Key も読み込む',
      'Найдено пластинок:': '見つかったレコード:',
      'Как добавить в коллекцию?': 'コレクションへの追加方法',
      'Заменить текущую коллекцию': '現在のコレクションを置換',
      'Объединить с текущей': '現在のものと結合',
      'Коллекция должна быть публичной в настройках профиля Discogs.':
        'Discogs プロフィールでコレクションを公開にしてください。',
      'Введите ваш Discogs username — и мы загрузим вашу коллекцию автоматически.':
        'Discogs username を入力すると、Vertax が自動で読み込みます。',
      править: '編集',
      убрать: '外す',
      перетащить: 'ドラッグ',
      'на пластинке': 'レコード上',
      'Та же пластинка рядом': '隣の曲が同じレコードです',
      'Выбери пластинки для сета': 'セット用のレコードを選択',
      'Собрать из выбранных': '選択から作成',
      'Вся коллекция': '全コレクション',
      'Текущая сессия': '現在のセッション',
      'Выбрать все видимые': '表示中をすべて選択',
      'Снять видимые': '表示中を解除',
      'Добавить выбранные': '選択を追加',
    },
  };

  var extraText = {
    en: {
      Назад: 'Back',
      'Что докопать': 'What to dig next',
      'Что важно': 'What matters',
      Уверенность: 'Confidence',
      Анализ: 'Analysis',
      пластинок: 'records',
      'BPM/Key найден у': 'BPM/Key found for',
      'Коллекция пока пустая': 'Collection is empty',
      'Данных пока мало': 'Not enough data yet',
      'Импортировать из Discogs': 'Import from Discogs',
      'Показать всё равно': 'Show anyway',
      'Показать все': 'Show all',
      'данных недостаточно': 'not enough data',
      'оценка очень приблизительная': 'very rough estimate',
      'оценка рабочая, но не абсолютная': 'usable, not absolute',
      'оценка надёжная': 'reliable estimate',
      покрытие: 'coverage',
      'Критичных Camelot-провалов не видно.': 'No critical Camelot gaps visible.',
      'Изолированных BPM-провалов не видно.': 'No isolated BPM gaps visible.',
      'Пока нет BPM-данных для гистограммы.': 'No BPM data for the histogram yet.',
      'Явных провалов не видно. Похоже, ящик уже довольно ровный.':
        'No obvious gaps visible. The crate looks fairly balanced.',
      'Чтобы анализировать коллекцию, Vertax должен её знать. Добавь несколько пластинок вручную или импортируй коллекцию из Discogs.':
        'To analyze the collection, Vertax needs to know it. Add a few records manually or import from Discogs.',
      'Этого мало для полезных рекомендаций. Можно добавить ещё пластинки или импортировать коллекцию из Discogs. Если хочешь просто посмотреть механику — покажем анализ, но уверенность будет очень низкой.':
        'That is too little for useful recommendations. Add more records or import from Discogs. If you just want to see the mechanics, Vertax can show the analysis with very low confidence.',
      '+ ДОБАВИТЬ ПЛАСТИНКУ': '+ Add record',
      '+ СОБРАТЬ СЕТ': '+ Build set',
      'A–Z ПО АРТИСТУ': 'A-Z by artist',
      'A–Z ПО НАЗВАНИЮ': 'A-Z by title',
      'БЫСТРЫЕ ДЕЙСТВИЯ': 'Quick actions',
      КАТАЛОГ: 'Catalog',
      НЕДАВНИЕ: 'Recent',
      НАЙДЕНА: 'Found',
      РУЧ: 'MAN',
      'ЦЕЛЬ СЕТА': 'Set target',
      'ТРЕК.': 'tracks',
      СЕРВИС: 'Service',
      '🗂 РЕЗЕРВНАЯ КОПИЯ': 'Backup',
      '+ ДОБАВИТЬ ТРЕК': '+ Add track',
      'Ввести BPM/Key…': 'Enter BPM/Key...',
      'Не использовать в сете': 'Do not use in set',
      'ОБНОВИТЬ ТРЕКЛИСТ ИЗ DISCOGS': 'Refresh tracklist from Discogs',
      'ПОДТВЕРДИТЬ ТРЕКЛИСТ': 'Confirm tracklist',
      'ПОЗ НАЗВАНИЕ BPM KEY': 'POS TITLE BPM KEY',
      'Поз Название BPM Key': 'POS TITLE BPM KEY',
      ПОЗ: 'POS',
      НАЗВАНИЕ: 'TITLE',
      Переименовать: 'Rename',
      'Править BPM/Key': 'Edit BPM/Key',
      'СТОРОНА A': 'Side A',
      'СТОРОНА B': 'Side B',
      'СТОРОНА C': 'Side C',
      'СТОРОНА D': 'Side D',
      'СТОРОНА E': 'Side E',
      'СТОРОНА F': 'Side F',
      'Сменить сторону': 'Change side',
      Треклист: 'Tracklist',
      '+ ДОБАВИТЬ ЕЩЁ ОДНУ ПЛАСТИНКУ': '+ Add another record',
      '+ ДОБАВИТЬ ТРЕК ИЗ КОЛЛЕКЦИИ': '+ Add track from collection',
      'ТРЕБУЮТ ПРОВЕРКИ': 'need review',
      'ВОЗМОЖНЫЕ СЛЕДУЮЩИЕ': 'Possible next tracks',
      'ВСЯ КОЛЛЕКЦИЯ': 'Full collection',
      ДОБАВЛЕННЫЕ: 'Added',
      ЖАНР: 'Genre',
      'ИГРАТЬ СЕТ': 'Play set',
      'ИСТОЧНИК ТРЕКОВ': 'Track source',
      'НА ПЛАСТИНКЕ': 'On record',
      '↕ ПЕРЕТАЩИТЬ': 'Drag',
      'CAMELOT (ПЕРЕОПРЕДЕЛИТЬ)': 'Camelot (override)',
      ВРУЧНУЮ: 'Manual',
      ИСТОЧНИК: 'Source',
      КОММЕНТАРИЙ: 'Comment',
      'Править трек': 'Edit track',
      'Тональность (KEY)': 'Key',
      УВЕРЕННОСТЬ: 'Confidence',
      'УДАЛИТЬ ТРЕК': 'Delete track',
      'by Михаил Проскурин': 'by Michael Proskurin',
      'Михаил Проскурин': 'Michael Proskurin',
      'Найди релиз в Discogs текстом, подтяни треклист, проставь BPM/Key, собери сет по правилу «не два трека с одной пластинки подряд».':
        'Search a release in Discogs, load its tracklist, fill BPM/Key and build a set without two tracks from the same record in a row.',
    },
    zh: {
      Назад: '返回',
      'Что докопать': '下一步挖什么',
      'Что важно': '重点',
      Уверенность: '可信度',
      Анализ: '分析',
      пластинок: '张唱片',
      'BPM/Key найден у': '已找到 BPM/Key',
      'Коллекция пока пустая': '收藏库为空',
      'Данных пока мало': '数据还不够',
      'Импортировать из Discogs': '从 Discogs 导入',
      'Показать всё равно': '仍然显示',
      'Показать все': '显示全部',
      'данных недостаточно': '数据不足',
      'оценка очень приблизительная': '非常粗略的估计',
      'оценка рабочая, но не абсолютная': '可用但不是绝对',
      'оценка надёжная': '可靠估计',
      покрытие: '覆盖率',
      'Критичных Camelot-провалов не видно.': '未看到明显 Camelot 缺口。',
      'Изолированных BPM-провалов не видно.': '未看到孤立 BPM 缺口。',
      'Пока нет BPM-данных для гистограммы.': '暂时没有 BPM 数据用于直方图。',
      'Явных провалов не видно. Похоже, ящик уже довольно ровный.':
        '没有明显缺口，收藏结构看起来比较均衡。',
      'Чтобы анализировать коллекцию, Vertax должен её знать. Добавь несколько пластинок вручную или импортируй коллекцию из Discogs.':
        '要分析收藏，Vertax 需要先知道它。请手动添加几张唱片，或从 Discogs 导入。',
      'Этого мало для полезных рекомендаций. Можно добавить ещё пластинки или импортировать коллекцию из Discogs. Если хочешь просто посмотреть механику — покажем анализ, но уверенность будет очень низкой.':
        '这些数据不足以给出有用建议。可以继续添加唱片或从 Discogs 导入。如果只是想看看机制，也可以显示分析，但可信度会很低。',
      '+ ДОБАВИТЬ ПЛАСТИНКУ': '+ 添加唱片',
      '+ СОБРАТЬ СЕТ': '+ 生成 Set',
      'A–Z ПО АРТИСТУ': '按艺人 A-Z',
      'A–Z ПО НАЗВАНИЮ': '按标题 A-Z',
      'БЫСТРЫЕ ДЕЙСТВИЯ': '快捷操作',
      КАТАЛОГ: '目录',
      НЕДАВНИЕ: '最近',
      НАЙДЕНА: '已找到',
      РУЧ: '手动',
      'ЦЕЛЬ СЕТА': 'Set 目标',
      'ТРЕК.': '首',
      СЕРВИС: '服务',
      '🗂 РЕЗЕРВНАЯ КОПИЯ': '备份',
      '+ ДОБАВИТЬ ТРЕК': '+ 添加曲目',
      'Ввести BPM/Key…': '输入 BPM/Key...',
      'Не использовать в сете': '不用于 Set',
      'ОБНОВИТЬ ТРЕКЛИСТ ИЗ DISCOGS': '从 Discogs 刷新曲目列表',
      'ПОДТВЕРДИТЬ ТРЕКЛИСТ': '确认曲目列表',
      'ПОЗ НАЗВАНИЕ BPM KEY': '位置 标题 BPM KEY',
      'Поз Название BPM Key': '位置 标题 BPM KEY',
      ПОЗ: '位置',
      НАЗВАНИЕ: '标题',
      Переименовать: '重命名',
      'Править BPM/Key': '编辑 BPM/Key',
      'СТОРОНА A': 'A 面',
      'СТОРОНА B': 'B 面',
      'СТОРОНА C': 'C 面',
      'СТОРОНА D': 'D 面',
      'СТОРОНА E': 'E 面',
      'СТОРОНА F': 'F 面',
      'Сменить сторону': '更改面',
      Треклист: '曲目列表',
      '+ ДОБАВИТЬ ЕЩЁ ОДНУ ПЛАСТИНКУ': '+ 再添加一张唱片',
      '+ ДОБАВИТЬ ТРЕК ИЗ КОЛЛЕКЦИИ': '+ 从收藏库添加曲目',
      'ТРЕБУЮТ ПРОВЕРКИ': '需要检查',
      'ВОЗМОЖНЫЕ СЛЕДУЮЩИЕ': '可能的下一首',
      'ВСЯ КОЛЛЕКЦИЯ': '全部收藏',
      ДОБАВЛЕННЫЕ: '已添加',
      ЖАНР: '风格',
      'ИГРАТЬ СЕТ': '播放 Set',
      'ИСТОЧНИК ТРЕКОВ': '曲目来源',
      'НА ПЛАСТИНКЕ': '唱片位置',
      '↕ ПЕРЕТАЩИТЬ': '拖动',
      'CAMELOT (ПЕРЕОПРЕДЕЛИТЬ)': 'Camelot（覆盖）',
      ВРУЧНУЮ: '手动',
      ИСТОЧНИК: '来源',
      КОММЕНТАРИЙ: '备注',
      'Править трек': '编辑曲目',
      'Тональность (KEY)': 'Key / 调性',
      УВЕРЕННОСТЬ: '置信度',
      'УДАЛИТЬ ТРЕК': '删除曲目',
      'by Михаил Проскурин': 'by Michael Proskurin',
      'Михаил Проскурин': 'Michael Proskurin',
      'Найди релиз в Discogs текстом, подтяни треклист, проставь BPM/Key, собери сет по правилу «не два трека с одной пластинки подряд».':
        '在 Discogs 搜索发行，加载曲目列表，填写 BPM/Key，并按规则生成 Set。',
    },
    ja: {
      Назад: '戻る',
      'Что докопать': '次に掘るもの',
      'Что важно': '重要ポイント',
      Уверенность: '信頼度',
      Анализ: '分析',
      пластинок: '枚',
      'BPM/Key найден у': 'BPM/Key 検出',
      'Коллекция пока пустая': 'コレクションは空です',
      'Данных пока мало': 'データがまだ少ない',
      'Импортировать из Discogs': 'Discogs からインポート',
      'Показать всё равно': 'それでも表示',
      'Показать все': 'すべて表示',
      'данных недостаточно': 'データ不足',
      'оценка очень приблизительная': 'かなり大まかな推定',
      'оценка рабочая, но не абсолютная': '使えるが絶対ではない',
      'оценка надёжная': '信頼できる推定',
      покрытие: 'カバー率',
      'Критичных Camelot-провалов не видно.': '大きな Camelot ギャップは見えません。',
      'Изолированных BPM-провалов не видно.': '孤立した BPM ギャップは見えません。',
      'Пока нет BPM-данных для гистограммы.': 'ヒストグラム用の BPM データがまだありません。',
      'Явных провалов не видно. Похоже, ящик уже довольно ровный.':
        '明確なギャップは見えません。かなりバランスのよい箱です。',
      'Чтобы анализировать коллекцию, Vertax должен её знать. Добавь несколько пластинок вручную или импортируй коллекцию из Discogs.':
        'コレクションを分析するには、Vertax に内容を知らせる必要があります。手動で数枚追加するか Discogs からインポートしてください。',
      'Этого мало для полезных рекомендаций. Можно добавить ещё пластинки или импортировать коллекцию из Discogs. Если хочешь просто посмотреть механику — покажем анализ, но уверенность будет очень низкой.':
        '有用な推薦にはまだ少なすぎます。さらにレコードを追加するか Discogs からインポートしてください。仕組みだけ見たい場合は、かなり低い信頼度で分析を表示できます。',
      '+ ДОБАВИТЬ ПЛАСТИНКУ': '+ レコードを追加',
      '+ СОБРАТЬ СЕТ': '+ セットを作る',
      'A–Z ПО АРТИСТУ': 'アーティスト A-Z',
      'A–Z ПО НАЗВАНИЮ': 'タイトル A-Z',
      'БЫСТРЫЕ ДЕЙСТВИЯ': 'クイック操作',
      КАТАЛОГ: 'カタログ',
      НЕДАВНИЕ: '最近',
      НАЙДЕНА: '検出済み',
      РУЧ: '手動',
      'ЦЕЛЬ СЕТА': 'セット目標',
      'ТРЕК.': '曲',
      СЕРВИС: 'サービス',
      '🗂 РЕЗЕРВНАЯ КОПИЯ': 'バックアップ',
      '+ ДОБАВИТЬ ТРЕК': '+ 曲を追加',
      'Ввести BPM/Key…': 'BPM/Key を入力...',
      'Не использовать в сете': 'セットで使わない',
      'ОБНОВИТЬ ТРЕКЛИСТ ИЗ DISCOGS': 'Discogs から更新',
      'ПОДТВЕРДИТЬ ТРЕКЛИСТ': 'トラックリストを確認',
      'ПОЗ НАЗВАНИЕ BPM KEY': 'POS TITLE BPM KEY',
      'Поз Название BPM Key': 'POS TITLE BPM KEY',
      ПОЗ: 'POS',
      НАЗВАНИЕ: 'TITLE',
      Переименовать: '名前を変更',
      'Править BPM/Key': 'BPM/Key を編集',
      'СТОРОНА A': 'Side A',
      'СТОРОНА B': 'Side B',
      'СТОРОНА C': 'Side C',
      'СТОРОНА D': 'Side D',
      'СТОРОНА E': 'Side E',
      'СТОРОНА F': 'Side F',
      'Сменить сторону': 'Side を変更',
      Треклист: 'トラックリスト',
      '+ ДОБАВИТЬ ЕЩЁ ОДНУ ПЛАСТИНКУ': '+ もう1枚追加',
      '+ ДОБАВИТЬ ТРЕК ИЗ КОЛЛЕКЦИИ': '+ コレクションから曲を追加',
      'ТРЕБУЮТ ПРОВЕРКИ': '確認が必要',
      'ВОЗМОЖНЫЕ СЛЕДУЮЩИЕ': '次の候補',
      'ВСЯ КОЛЛЕКЦИЯ': '全コレクション',
      ДОБАВЛЕННЫЕ: '追加済み',
      ЖАНР: 'ジャンル',
      'ИГРАТЬ СЕТ': 'セットを再生',
      'ИСТОЧНИК ТРЕКОВ': '曲のソース',
      'НА ПЛАСТИНКЕ': 'レコード上',
      '↕ ПЕРЕТАЩИТЬ': 'ドラッグ',
      'CAMELOT (ПЕРЕОПРЕДЕЛИТЬ)': 'Camelot（上書き）',
      ВРУЧНУЮ: '手動',
      ИСТОЧНИК: 'ソース',
      КОММЕНТАРИЙ: 'コメント',
      'Править трек': '曲を編集',
      'Тональность (KEY)': 'Key',
      УВЕРЕННОСТЬ: '信頼度',
      'УДАЛИТЬ ТРЕК': '曲を削除',
      'by Михаил Проскурин': 'by Michael Proskurin',
      'Михаил Проскурин': 'Michael Proskurin',
      'Найди релиз в Discogs текстом, подтяни треклист, проставь BPM/Key, собери сет по правилу «не два трека с одной пластинки подряд».':
        'Discogs でリリースを検索し、トラックリストを読み込み、BPM/Key を入力してセットを作成します。',
    },
  };

  var placeholders = {
    en: {
      'Артист, релиз или трек…': 'Artist, release or track...',
      'Поиск: артист / название / лейбл / каталог…': 'Search: artist / title / label / catalog...',
      'Discogs username': 'Discogs username',
    },
    zh: {
      'Артист, релиз или трек…': '艺人、发行或曲名...',
      'Поиск: артист / название / лейбл / каталог…': '搜索：艺人 / 标题 / 厂牌 / 编号...',
      'Discogs username': 'Discogs 用户名',
    },
    ja: {
      'Артист, релиз или трек…': 'アーティスト、リリース、曲名...',
      'Поиск: артист / название / лейбл / каталог…':
        '検索: アーティスト / タイトル / レーベル / カタログ...',
      'Discogs username': 'Discogs username',
    },
  };

  function normalize(s) {
    return String(s == null ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDict(lang) {
    var source = Object.assign({}, text[lang] || {}, extraText[lang] || {});
    var out = {};
    Object.keys(source).forEach(function (key) {
      out[key] = source[key];
      out[key.toLowerCase()] = source[key];
      out[key.toUpperCase()] = source[key];
    });
    return out;
  }

  function getLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (langs.indexOf(saved) >= 0) return saved;
      var queryLang = new URLSearchParams(window.location.search || '').get('lang');
      if (langs.indexOf(queryLang) >= 0) return queryLang;
    } catch (_) {}
    return 'ru';
  }

  function hasExplicitLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (langs.indexOf(saved) >= 0) return true;
      var queryLang = new URLSearchParams(window.location.search || '').get('lang');
      return langs.indexOf(queryLang) >= 0;
    } catch (_) {
      return false;
    }
  }

  function shouldShowLanguageGate() {
    try {
      if (navigator.webdriver) return false;
    } catch (_) {}
    return !hasExplicitLang();
  }

  function setLang(lang) {
    if (langs.indexOf(lang) < 0) lang = 'ru';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    window.__vertaxAppLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    removeLanguageGate();
    if (typeof render === 'function') render();
    else translateApp();
  }

  function renderSwitcher() {
    var lang = getLang();
    return (
      '<details class="vertax-lang-switcher vertax-lang-dial">' +
      '<summary class="vertax-lang-dial-face" aria-label="Language">' +
      '<span class="vertax-lang-dial-mark">' +
      labels[lang] +
      '</span>' +
      '</summary>' +
      '<span class="vertax-lang-dial-menu" role="group" aria-label="Language">' +
      langs
        .map(function (code) {
          return (
            '<button class="vertax-lang-btn' +
            (code === lang ? ' is-active' : '') +
            '" type="button" data-action="app-lang" data-lang="' +
            code +
            '" aria-pressed="' +
            (code === lang ? 'true' : 'false') +
            '">' +
            labels[code] +
            '</button>'
          );
        })
        .join('') +
      '</span>' +
      '</details>'
    );
  }

  function ensureSwitcher(root) {
    var side = root.querySelector('.laiso-chassis-side');
    if (!side || side.querySelector('.vertax-lang-switcher')) return;
    side.insertAdjacentHTML('afterbegin', renderSwitcher());
  }

  function renderLanguageGate(root) {
    if (!shouldShowLanguageGate()) return;
    if (root.querySelector('.vertax-lang-gate')) return;
    root.insertAdjacentHTML(
      'beforeend',
      '<div class="vertax-lang-gate" role="dialog" aria-modal="true" aria-labelledby="vertax-lang-gate-title">' +
        '<div class="vertax-lang-gate-card">' +
        '<p class="vertax-lang-gate-kicker">VERTAX-01</p>' +
        '<h2 class="vertax-lang-gate-title" id="vertax-lang-gate-title">Выберите язык</h2>' +
        '<p class="vertax-lang-gate-copy">Choose the interface language. You can change it later in the top panel.</p>' +
        '<div class="vertax-lang-gate-options">' +
        langs
          .map(function (code) {
            return (
              '<button class="vertax-lang-gate-btn" type="button" data-action="app-lang" data-lang="' +
              code +
              '">' +
              langNames[code] +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '</div>' +
        '</div>'
    );
  }

  function removeLanguageGate() {
    var gate = document.querySelector('#laiso-app .vertax-lang-gate');
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
  }

  function translateTextNode(node, dict) {
    var raw = normalize(node.nodeValue);
    if (!raw) return;
    if (dict[raw]) {
      node.nodeValue = node.nodeValue.replace(raw, dict[raw]);
      return;
    }
    var lowerHit = dict[raw.toLowerCase()];
    if (lowerHit) {
      node.nodeValue = node.nodeValue.replace(raw, lowerHit);
      return;
    }
    var translated = raw
      .replace(/^Пластинки \((\d+)\)$/i, function (_, n) {
        return (dict['Пластинки'] || 'Records') + ' (' + n + ')';
      })
      .replace(/^Сеты \((\d+)\)$/i, function (_, n) {
        return (dict['Сеты'] || 'Sets') + ' (' + n + ')';
      })
      .replace(/^сет · (\d+) трек\.$/i, function (_, n) {
        return (dict['сет'] || 'set') + ' · ' + n + ' ' + (dict['трек.'] || 'tracks');
      })
      .replace(/^сессия · (\d+)\/(\d+)$/i, function (_, a, b) {
        return (dict['сессия'] || 'session') + ' · ' + a + '/' + b;
      })
      .replace(/^Диапазон темпа ± (\d+) BPM$/i, function (_, n) {
        return (dict['Диапазон темпа'] || 'Tempo range') + ' ± ' + n + ' BPM';
      })
      .replace(/^(ВСЯ КОЛЛЕКЦИЯ|ДОБАВЛЕННЫЕ) · (\d+)$/i, function (_, label, n) {
        return (dict[label.toUpperCase()] || label) + ' · ' + n;
      })
      .replace(/^НА ПЛАСТИНКЕ (.+)$/i, function (_, pos) {
        return (dict['НА ПЛАСТИНКЕ'] || 'On record') + ' ' + pos;
      })
      .replace(/^(\d+) ТРЕБУЮТ ПРОВЕРКИ$/i, function (_, n) {
        return n + ' ' + (dict['ТРЕБУЮТ ПРОВЕРКИ'] || 'need review');
      })
      .replace(/^(\d+) ТРЕК\.$/i, function (_, n) {
        return n + ' ' + (dict['ТРЕК.'] || 'tracks');
      })
      .replace(/^(\d+) мин$/i, function (_, n) {
        var unit = dict.__minutes || 'min';
        return n + ' ' + unit;
      });
    Object.keys(dict)
      .sort(function (a, b) {
        return b.length - a.length;
      })
      .some(function (key) {
        if (!/[А-Яа-яЁё]/.test(key) || key.length < 4 || translated.indexOf(key) < 0) return false;
        translated = translated.split(key).join(dict[key]);
        return false;
      });
    if (translated !== raw) node.nodeValue = node.nodeValue.replace(raw, translated);
  }

  function postProcessElements(root, lang, dict) {
    if (lang === 'ru') return;
    root.querySelectorAll('[data-action="back"]').forEach(function (el) {
      el.textContent = dict['← Назад'] || dict['Назад'] || 'Back';
    });
    root
      .querySelectorAll('.laiso-track > div, .laiso-track-head, .laiso-track-header')
      .forEach(function (el) {
        var value = normalize(el.textContent);
        if (/^ПОЗ НАЗВАНИЕ BPM KEY$/i.test(value) || /^Поз Название BPM Key$/i.test(value)) {
          el.textContent = dict['ПОЗ НАЗВАНИЕ BPM KEY'] || 'POS TITLE BPM KEY';
        }
      });
  }

  function translateApp() {
    if (isTranslating) return;
    var root = document.getElementById('laiso-root');
    if (!root) return;
    isTranslating = true;
    ensureSwitcher(root);
    renderLanguageGate(root);
    var lang = getLang();
    window.__vertaxAppLang = lang;
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
    root.querySelectorAll('.vertax-lang-btn').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (lang === 'ru') {
      isTranslating = false;
      return;
    }
    var dict = getDict(lang);
    dict.__minutes = lang === 'en' ? 'min' : lang === 'zh' ? '分钟' : '分';
    var ph = placeholders[lang] || {};
    root.querySelectorAll('input, textarea').forEach(function (el) {
      var p = el.getAttribute('placeholder');
      if (p && ph[p]) el.setAttribute('placeholder', ph[p]);
    });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(parent.nodeName))
          return NodeFilter.FILTER_REJECT;
        if (parent.closest && parent.closest('.vertax-lang-switcher'))
          return NodeFilter.FILTER_REJECT;
        return normalize(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      translateTextNode(node, dict);
    });
    postProcessElements(root, lang, dict);
    isTranslating = false;
  }

  function scheduleTranslate(delay) {
    if (isTranslating) return;
    clearTimeout(observerTimer);
    observerTimer = setTimeout(translateApp, delay || 80);
  }

  function scheduleTranslateBurst() {
    setTimeout(translateApp, 0);
    setTimeout(translateApp, 120);
    setTimeout(translateApp, 360);
  }

  function installRenderHooks() {
    try {
      if (typeof render === 'function' && !window.__vertaxI18nRenderWrapped) {
        var originalRender = render;
        render = function () {
          var result = originalRender.apply(this, arguments);
          scheduleTranslateBurst();
          return result;
        };
        window.__vertaxI18nRenderWrapped = true;
        if (window.laisoBuck) window.laisoBuck.render = render;
      }
    } catch (_) {}
    try {
      if (
        window.laisoBuck &&
        typeof window.laisoBuck.render === 'function' &&
        !window.__vertaxI18nBuckRenderWrapped
      ) {
        var originalBuckRender = window.laisoBuck.render;
        window.laisoBuck.render = function () {
          var result = originalBuckRender.apply(this, arguments);
          scheduleTranslateBurst();
          return result;
        };
        window.__vertaxI18nBuckRenderWrapped = true;
      }
    } catch (_) {}
  }

  function installObserver() {
    var app = document.getElementById('laiso-app');
    if (!app || !window.MutationObserver || observer) return;
    observer = new MutationObserver(function (mutations) {
      if (isTranslating) return;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          scheduleTranslate(90);
          return;
        }
      }
    });
    observer.observe(app, { childList: true, subtree: true });
  }

  document.addEventListener(
    'click',
    function (e) {
      var btn =
        e.target && e.target.closest && e.target.closest('#laiso-app [data-action="app-lang"]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      var dial = btn.closest && btn.closest('.vertax-lang-dial');
      if (dial) dial.removeAttribute('open');
      setLang(btn.getAttribute('data-lang') || 'ru');
    },
    true
  );

  document.addEventListener(
    'click',
    function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('#laiso-app')) return;
      scheduleTranslateBurst();
    },
    false
  );

  function installHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(function () {
      if (getLang() === 'ru') return;
      if (document.hidden) return;
      translateApp();
    }, 650);
  }

  function boot() {
    if (typeof window.vertaxRegisterAfterRender === 'function') {
      window.vertaxRegisterAfterRender(function () {
        setTimeout(translateApp, 0);
        setTimeout(translateApp, 140);
      });
      installObserver();
      installRenderHooks();
      installHeartbeat();
      setTimeout(translateApp, 0);
      return;
    }
    setTimeout(boot, 120);
  }

  window.vertaxTranslateApp = translateApp;
  window.vertaxSetAppLang = setLang;
  boot();
})();
