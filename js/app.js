/* VERTAX-01 / RUNT-01 app entrypoint. */

function loadScriptOnce(src, opts) {
  opts = opts || {};
  if (!src) return Promise.resolve(null);
  if (!window.__vertaxScriptPromises) window.__vertaxScriptPromises = {};
  if (window.__vertaxScriptPromises[src]) return window.__vertaxScriptPromises[src];
  window.__vertaxScriptPromises[src] = new Promise(function (resolve) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      existing.addEventListener(
        'load',
        function () {
          resolve(existing);
        },
        { once: true }
      );
      existing.addEventListener(
        'error',
        function () {
          resolve(null);
        },
        { once: true }
      );
      if (existing.dataset.loaded === 'true') resolve(existing);
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.async = opts.async !== false;
    script.defer = opts.defer !== false;
    script.onload = function () {
      script.dataset.loaded = 'true';
      resolve(script);
    };
    script.onerror = function () {
      console.warn('[VERTAX] Optional platform SDK failed:', src);
      resolve(null);
    };
    (document.head || document.documentElement).appendChild(script);
  });
  return window.__vertaxScriptPromises[src];
}

function isTelegramRuntime() {
  try {
    return /tgWebAppData|tgWebAppVersion|telegram/i.test(location.search + location.hash);
  } catch (_) {
    return false;
  }
}

function isMaxRuntime() {
  try {
    return /maxWebApp|maWebApp|platform=max/i.test(location.search + location.hash);
  } catch (_) {
    return false;
  }
}

function notifyMiniAppHost() {
  var webApp, botUsername;
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
    webApp = window.Telegram.WebApp;
    botUsername = 'vertaksbot';
  } else if (window.WebApp && window.WebApp.initData) {
    webApp = window.WebApp;
    botUsername = 'id503124294144_2_bot';
  }
  if (!webApp || window.__vertaxMiniAppHostNotified) return;
  window.__vertaxMiniAppHostNotified = true;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.onedam.me/webapp/' + botUsername);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(webApp));
  } catch (_) {}
}

function initPlatformBridge() {
  var loaders = [];
  if (isTelegramRuntime())
    loaders.push(loadScriptOnce('https://telegram.org/js/telegram-web-app.js'));
  if (isMaxRuntime()) loaders.push(loadScriptOnce('https://st.max.ru/js/max-web-app.js'));
  if (isVkMiniApp())
    loaders.push(loadScriptOnce('https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js'));
  if (!loaders.length) return Promise.resolve();
  return Promise.all(loaders).then(function () {
    notifyMiniAppHost();
    installTelegramWebAppChrome();
    syncTelegramChrome();
  });
}

window.loadScriptOnce = loadScriptOnce;
window.initPlatformBridge = initPlatformBridge;

/* ============================================================
   OFFLINE DETECTION + GRACEFUL NETWORK ACTION GATE
   ============================================================ */
function vertaxIsOnline() {
  try {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  } catch (_) {
    return true;
  }
}
function vertaxRequireOnline(msg) {
  if (vertaxIsOnline()) return true;
  if (typeof showToast === 'function') {
    showToast(msg || 'Нужен интернет для этого действия');
  }
  return false;
}
function vertaxSyncOnlineClass() {
  if (!document.body) return;
  document.body.classList.toggle('vertax-offline', !vertaxIsOnline());
}
window.vertaxIsOnline = vertaxIsOnline;
window.vertaxRequireOnline = vertaxRequireOnline;
try {
  window.addEventListener('online', function () {
    vertaxSyncOnlineClass();
    if (typeof showToast === 'function') showToast('Снова на связи');
  });
  window.addEventListener('offline', function () {
    vertaxSyncOnlineClass();
    if (typeof showToast === 'function') showToast('Offline-режим');
  });
} catch (_) {}
/* Run once on script load; render() will also sync class via vertaxAfterRender. */
setTimeout(vertaxSyncOnlineClass, 0);

function vertaxResolveRuntimeModal(value) {
  var modal = state && state.modal;
  if (modal && typeof modal.resolve === 'function') modal.resolve(value);
  state.modal = null;
  render();
}

function vertaxPrompt(message, defaultValue, options) {
  options = options || {};
  return new Promise(function (resolve) {
    state.modal = {
      type: 'prompt',
      title: options.title || 'Введите значение',
      message: message || '',
      fieldLabel: options.fieldLabel || message || 'Значение',
      defaultValue: defaultValue == null ? '' : String(defaultValue),
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Отмена',
      resolve: resolve,
    };
    render();
    setTimeout(function () {
      var input = document.getElementById('vertax-prompt-input');
      if (input) {
        input.focus();
        input.select();
      }
    }, 30);
  });
}

function vertaxConfirm(message, options) {
  options = options || {};
  return new Promise(function (resolve) {
    state.modal = {
      type: 'confirm',
      title: options.title || 'Подтверждение',
      message: message || '',
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Отмена',
      resolve: resolve,
    };
    render();
  });
}

window.vertaxPrompt = vertaxPrompt;
window.vertaxConfirm = vertaxConfirm;

document.addEventListener(
  'gesturestart',
  function (e) {
    e.preventDefault();
  },
  { passive: false }
);
document.addEventListener(
  'touchmove',
  function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);

function getVkLaunchParamsString() {
  try {
    var search =
      window.location && window.location.search ? window.location.search.replace(/^\?/, '') : '';
    var hash =
      window.location && window.location.hash
        ? window.location.hash.replace(/^#/, '').replace(/^\?/, '')
        : '';
    var raw = search || hash || '';
    if (!raw) return '';
    var params = new URLSearchParams(raw);
    var vk = [];
    params.forEach(function (value, key) {
      if (key === 'sign' || key.indexOf('vk_') === 0) vk.push([key, value]);
    });
    if (!vk.length) return '';
    return vk
      .map(function (pair) {
        return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]);
      })
      .join('&');
  } catch (_) {
    return '';
  }
}

function getVkBridge() {
  try {
    return window.vkBridge || window.VKBridge || null;
  } catch (_) {
    return null;
  }
}

function isVkMiniApp() {
  if (getVkLaunchParamsString()) return true;
  return !!getVkBridge();
}

function callVkBridge(method, params) {
  var bridge = getVkBridge();
  if (!bridge || typeof bridge.send !== 'function') return Promise.resolve(null);
  try {
    return bridge.send(method, params || {}).catch(function () {
      return null;
    });
  } catch (_) {
    return Promise.resolve(null);
  }
}

function makeVkWebAppAdapter() {
  if (!isVkMiniApp()) return null;
  if (window.__vertaxVkWebAppAdapter) return window.__vertaxVkWebAppAdapter;
  var adapter = {
    platform: 'vk',
    initData: getVkLaunchParamsString(),
    initDataUnsafe: { user: null },
    ready: function () {
      callVkBridge('VKWebAppInit');
    },
    expand: function () {},
    disableVerticalSwipes: function () {},
    HapticFeedback: {
      impactOccurred: function (style) {
        callVkBridge('VKWebAppTapticImpactOccurred', { style: style || 'light' });
      },
      notificationOccurred: function (type) {
        callVkBridge('VKWebAppTapticNotificationOccurred', { type: type || 'success' });
      },
    },
    BackButton: {
      show: function () {
        callVkBridge('VKWebAppSetViewSettings', {
          status_bar_style: 'light',
          action_bar_color: '#0B0D0C',
        });
      },
      hide: function () {},
      onClick: function (fn) {
        var bridge = getVkBridge();
        if (!bridge || typeof bridge.subscribe !== 'function') return;
        bridge.subscribe(function (event) {
          var type = event && event.detail && event.detail.type;
          if (type === 'VKWebAppViewHide' || type === 'VKWebAppBackButtonClicked') fn();
        });
      },
    },
    onEvent: function (name, fn) {
      if (name === 'backButtonClicked' && adapter.BackButton) adapter.BackButton.onClick(fn);
    },
  };
  try {
    var params = new URLSearchParams(adapter.initData || '');
    var vkUserId = params.get('vk_user_id');
    if (vkUserId) adapter.initDataUnsafe.user = { id: vkUserId, username: 'vk' + vkUserId };
  } catch (_) {}
  window.__vertaxVkWebAppAdapter = adapter;
  return adapter;
}
window.getVkLaunchParamsString = getVkLaunchParamsString;

/* Host Haptic Feedback wrapper. No-op outside Mini App hosts. */
function haptic(type) {
  var tg = getHostWebApp();
  var h = tg && tg.HapticFeedback;
  if (!h) return;
  try {
    if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
    else h.impactOccurred(type || 'light');
  } catch (_) {}
}
window.haptic = haptic;

function getHostWebApp() {
  if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
  if (window.WebApp) return window.WebApp;
  var vk = makeVkWebAppAdapter();
  if (vk) return vk;
  return null;
}

function getVertaxTheme() {
  try {
    var value = localStorage.getItem('vertax-theme');
    return value === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

function applyVertaxTheme(theme) {
  var normalized = theme === 'dark' ? 'dark' : 'light';
  if (document.body) {
    document.body.classList.remove('vertax-theme-light', 'vertax-theme-dark');
    document.body.classList.add(normalized === 'dark' ? 'vertax-theme-dark' : 'vertax-theme-light');
  }
  try {
    localStorage.setItem('vertax-theme', normalized);
  } catch (e) {}
  try {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', normalized === 'dark' ? '#0B0D0C' : '#ECEFF1');
  } catch (e) {}
  return normalized;
}

function toggleVertaxTheme() {
  return applyVertaxTheme(getVertaxTheme() === 'dark' ? 'light' : 'dark');
}

window.getVertaxTheme = getVertaxTheme;
window.applyVertaxTheme = applyVertaxTheme;
window.toggleVertaxTheme = toggleVertaxTheme;
applyVertaxTheme(getVertaxTheme());

function getTelegramWebApp() {
  return getHostWebApp();
}

function maximizeTelegramWebApp() {
  var tg = getHostWebApp();
  if (!tg) return;
  try {
    if (typeof tg.ready === 'function') tg.ready();
  } catch (_) {}
  try {
    if (typeof tg.expand === 'function') tg.expand();
  } catch (_) {}
  try {
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
  } catch (_) {}
}

function canTelegramGoBack() {
  if (typeof state === 'undefined') return false;
  return !!state.modal || (state.view && state.view !== 'home');
}

function telegramBack() {
  if (typeof state === 'undefined') return;
  if (state.modal) {
    state.modal = null;
    render();
    return;
  }
  if (typeof handlers !== 'undefined' && handlers && typeof handlers.back === 'function') {
    handlers.back(
      { preventDefault: function () {}, stopPropagation: function () {} },
      { dataset: { action: 'back' } }
    );
    return;
  }
  state.view = 'home';
  render();
}

function syncTelegramChrome() {
  if (document.body && typeof state !== 'undefined') {
    document.body.classList.toggle('vertax-dark', state.view === 'live-set');
  }
  var tg = getHostWebApp();
  if (!tg || !tg.BackButton) {
    if (document.body) document.body.classList.remove('vertax-has-tg-back');
    return;
  }
  try {
    var useHostBackButton = isTelegramRuntime() && canTelegramGoBack();
    if (useHostBackButton) {
      if (document.body) document.body.classList.add('vertax-has-tg-back');
      if (canTelegramGoBack()) tg.BackButton.show();
    } else {
      if (document.body) document.body.classList.remove('vertax-has-tg-back');
      tg.BackButton.hide();
    }
  } catch (_) {}
}

function installTelegramWebAppChrome() {
  var tg = getHostWebApp();
  if (!tg || window.__vertaxTelegramChromeInstalled) return;
  window.__vertaxTelegramChromeInstalled = true;
  maximizeTelegramWebApp();
  try {
    if (tg.BackButton && typeof tg.BackButton.onClick === 'function') {
      tg.BackButton.onClick(telegramBack);
    } else if (typeof tg.onEvent === 'function') {
      tg.onEvent('backButtonClicked', telegramBack);
    }
  } catch (_) {}
  syncTelegramChrome();
}
window.getTelegramWebApp = getTelegramWebApp;
window.getHostWebApp = getHostWebApp;
window.maximizeTelegramWebApp = maximizeTelegramWebApp;

/* ============================================================ */ /* GLOBAL EVENT DELEGATION */ /* ============================================================ */ function getActionTarget(
  e
) {
  var n = e.target;
  while (n && n !== document.body) {
    if (n.dataset && n.dataset.action) return n;
    if (n.dataset && n.dataset.stop) return null;
    n = n.parentNode;
  }
  return null;
}
document.addEventListener('click', function (e) {
  if (!document.getElementById('laiso-app')) return;
  if (!e.target.closest || !e.target.closest('#laiso-app')) return;
  /* Close menus when clicking outside */ var clickedMenu =
    e.target.closest && e.target.closest('.laiso-menu');
  if (!clickedMenu) {
    document.querySelectorAll('#laiso-app .laiso-menu.open').forEach(function (m) {
      m.classList.remove('open');
    });
  }
  var t = getActionTarget(e);
  if (!t) return;
  if (t.tagName && /^(INPUT|SELECT|TEXTAREA)$/i.test(t.tagName)) return;
  var action = t.dataset.action;
  var fn = handlers[action];
  if (fn) {
    try {
      Promise.resolve(fn(e, t)).catch(function (err) {
        console.warn('action error', action, err);
        showToast('Ошибка: ' + err.message);
      });
    } catch (err) {
      console.warn('action error', action, err);
      showToast('Ошибка: ' + err.message);
    }
  }
});
document.addEventListener('change', function (e) {
  if (!e.target.closest || !e.target.closest('#laiso-app')) return;
  var t = getActionTarget(e);
  if (!t) return;
  var action = t.dataset.action;
  var fn = handlers[action];
  if (fn)
    try {
      Promise.resolve(fn(e, t)).catch(function (err) {
        console.warn('change error', err);
      });
    } catch (err) {
      console.warn('change error', err);
    }
});
document.addEventListener('input', function (e) {
  if (!e.target.closest || !e.target.closest('#laiso-app')) return;
  /* Live-bind searchQuery and form inputs */ var bind = e.target.dataset && e.target.dataset.bind;
  if (bind) {
    state.ui[bind] = e.target.value;
    /* Don't re-render to keep focus */ return;
  }
  var t = getActionTarget(e);
  if (!t) return;
  if (
    t.dataset.action === 'collection-search' ||
    t.dataset.action === 'bpm-input' ||
    t.dataset.action === 'add-track-search' ||
    t.dataset.action === 'fit-check-input' ||
    t.dataset.action === 'fit-manual-bpm' ||
    t.dataset.action === 'fit-manual-camelot'
  ) {
    var fn = handlers[t.dataset.action];
    if (fn)
      try {
        fn(e, t);
      } catch (err) {}
  }
});
/* Enter-key submit for free-text search field */ document.addEventListener(
  'keydown',
  function (e) {
    if (state && state.modal && state.modal.type) {
      if (e.key === 'Escape') {
        e.preventDefault();
        vertaxResolveRuntimeModal(state.modal.type === 'confirm' ? false : null);
        return;
      }
      if (e.key === 'Enter' && state.modal.type === 'prompt') {
        e.preventDefault();
        var input = document.getElementById('vertax-prompt-input');
        vertaxResolveRuntimeModal(input ? input.value : '');
        return;
      }
      if (e.key === 'Enter' && state.modal.type === 'confirm') {
        e.preventDefault();
        vertaxResolveRuntimeModal(true);
        return;
      }
    }
    if (!e.target.closest || !e.target.closest('#laiso-app')) return;
    if (e.key !== 'Enter') return;
    var action = e.target.dataset && e.target.dataset.action;
    if (action === 'search-input') {
      e.preventDefault();
      runDiscogsSearch();
    }
  }
);
function registerVertaxServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn(
        '[VERTAX] Service worker registration failed:',
        err && err.message ? err.message : err
      );
    });
  });
}
/* ============================================================ */ /* INIT */ /* ============================================================ */ async function init() {
  try {
    dbInstance = await dbOpen();
    var loadedVinyls = await dbGetAll('vinyls');
    var loadedSets = await dbGetAll('sets');
    state.collection = loadedVinyls || [];
    state.sets = loadedSets || [];
  } catch (e) {
    console.warn('IndexedDB unavailable, running in volatile mode:', e);
  }
  render();
  initPlatformBridge();
  registerVertaxServiceWorker();
}
init();
/* Expose for console debug (optional) */ window.laisoBuck = { state: state, render: render };

var vertaxAfterRenderCallbacks = window.__vertaxAfterRenderCallbacks || [];
window.__vertaxAfterRenderCallbacks = vertaxAfterRenderCallbacks;

(function installRuntAndVertaxExtensions() {
  if (window.__runtAndVertaxExtensionsInstalled) return;
  window.__runtAndVertaxExtensionsInstalled = true;
  var installers = [
    installRuntBpmX2LiveToggle,
    installRuntSetManualMetaControls,
    installRuntSetDndAndAddTrackModal,
    installRuntCompactSetCards,
    installRuntManualMetadataHandlers,
    installRuntCollectionQuickActions,
    installRuntDiscogsDuplicatePicker,
    installRuntManualMetaValidation,
    installRuntAddTrackFromCollection,
    installRuntScopeAndFetchingControls,
    installRuntGeneratedSetCache,
    installRuntCollectionPickModal,
    installRuntCollectionBpmPanel,
    installRuntLiveMode,
    installRuntLiveSuggestions,
    installRuntDiagnosticsPanel,
    installRuntSourceSelectionPage,
    installRuntBackButtonCopy,
    installRuntSourceEntryButtons,
    installRuntSourceSelectionHardFix,
    installRuntAscendingTempoMode,
    installVertaxBackupFeature,
  ];
  for (var i = 0; i < installers.length; i++) {
    try {
      if (typeof installers[i] === 'function') installers[i]();
    } catch (e) {
      console.warn('extension install failed', installers[i] && installers[i].name, e);
    }
  }
})();

(function installVertaxCompactSetTouchDnd() {
  if (window.__vertaxCompactSetTouchDndInstalled) return;
  window.__vertaxCompactSetTouchDndInstalled = true;
  var drag = null;
  var ghost = null;

  function clearMarks() {
    document
      .querySelectorAll(
        '#laiso-app .runt-set-card.runt-dragging,#laiso-app .runt-set-card.runt-drag-over'
      )
      .forEach(function (el) {
        el.classList.remove('runt-dragging', 'runt-drag-over');
      });
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
  }

  function cardFromEventTarget(target) {
    return target && target.closest && target.closest('#laiso-app .runt-set-card[data-set-idx]');
  }

  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform =
      'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) rotate(-1.5deg)';
  }

  function createGhost(card, x, y) {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    var rect = card.getBoundingClientRect();
    ghost = card.cloneNode(true);
    ghost.classList.add('runt-touch-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.left = '0';
    ghost.style.top = '0';
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '99998';
    ghost.style.margin = '0';
    document.body.appendChild(ghost);
    moveGhost(x, y);
  }

  document.addEventListener(
    'touchstart',
    function (e) {
      if (e.touches && e.touches.length !== 1) return;
      var card = cardFromEventTarget(e.target);
      if (!card) return;
      var idx = parseInt(card.getAttribute('data-set-idx'), 10);
      if (isNaN(idx)) return;

      var start = e.touches[0];
      var sx = start.clientX;
      var sy = start.clientY;
      var timer = setTimeout(function () {
        drag = { from: idx, card: card, lastTo: idx };
        card.classList.add('runt-dragging');
        createGhost(card, sx, sy);
        if (typeof haptic === 'function') haptic('medium');
      }, 280);

      function cancelPress() {
        clearTimeout(timer);
        document.removeEventListener('touchend', cancelPress);
        document.removeEventListener('touchcancel', cancelPress);
        document.removeEventListener('touchmove', maybeScroll);
      }

      function maybeScroll(ev) {
        if (drag) return;
        var t = ev.touches && ev.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) cancelPress();
      }

      document.addEventListener('touchend', cancelPress, { once: true });
      document.addEventListener('touchcancel', cancelPress, { once: true });
      document.addEventListener('touchmove', maybeScroll, { passive: true });
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    function (e) {
      if (!drag) return;
      if (e.cancelable) e.preventDefault();
      var t = e.touches && e.touches[0];
      if (!t) return;
      moveGhost(t.clientX, t.clientY);
      var under = document.elementFromPoint(t.clientX, t.clientY);
      var target = cardFromEventTarget(under);
      document.querySelectorAll('#laiso-app .runt-set-card.runt-drag-over').forEach(function (el) {
        if (el !== target) el.classList.remove('runt-drag-over');
      });
      if (target && target !== drag.card) {
        target.classList.add('runt-drag-over');
        var to = parseInt(target.getAttribute('data-set-idx'), 10);
        if (!isNaN(to)) drag.lastTo = to;
      }
    },
    { passive: false }
  );

  document.addEventListener('touchend', function () {
    if (!drag) return;
    var from = drag.from;
    var to = drag.lastTo;
    clearMarks();
    drag = null;
    if (isNaN(from) || isNaN(to) || from === to) return;
    var arr = (state && state.ui && state.ui.generatedSet) || [];
    if (!arr[from] || !arr[to]) return;
    var moved = arr.splice(from, 1)[0];
    arr.splice(to, 0, moved);
    state.ui.generatedSet = arr;
    if (typeof haptic === 'function') haptic('light');
    if (typeof render === 'function') render();
  });

  document.addEventListener('touchcancel', function () {
    clearMarks();
    drag = null;
  });
})();

(function installVertaxTelegramChromeSync() {
  if (window.__vertaxTelegramChromeSyncInstalled) return;
  window.__vertaxTelegramChromeSyncInstalled = true;
  installTelegramWebAppChrome();
  syncTelegramChrome();
  setTimeout(syncTelegramChrome, 300);
})();

/* ============================================================
   VERTAX CENTRAL DISPLAY: clock ticker + boot screen typewriter
   ============================================================ */
function getVertaxUserName() {
  var debug = { source: null, hasTg: false, hasInitData: false, hasUser: false };
  try {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg) debug.hasTg = true;
    if (tg && typeof tg.ready === 'function') {
      try {
        tg.ready();
      } catch (_) {}
    }
    var user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) debug.hasUser = true;
    if (user && user.username) {
      debug.source = 'username';
      window.__vertaxNameDebug = debug;
      return String(user.username).toUpperCase();
    }
    var raw = tg && tg.initData;
    if (raw && typeof raw === 'string') {
      debug.hasInitData = true;
      try {
        var params = new URLSearchParams(raw);
        var u = params.get('user');
        if (u) {
          var parsed = JSON.parse(decodeURIComponent(u));
          if (parsed && parsed.username) {
            debug.source = 'initData.username';
            window.__vertaxNameDebug = debug;
            return String(parsed.username).toUpperCase();
          }
        }
      } catch (_) {}
    }
    var max = window.WebApp;
    var maxUser = max && max.initDataUnsafe && max.initDataUnsafe.user;
    if (maxUser && maxUser.username) {
      debug.source = 'max.username';
      window.__vertaxNameDebug = debug;
      return String(maxUser.username).toUpperCase();
    }
    var vk = makeVkWebAppAdapter();
    var vkUser = vk && vk.initDataUnsafe && vk.initDataUnsafe.user;
    if (vkUser && vkUser.username) {
      debug.source = 'vk.username';
      window.__vertaxNameDebug = debug;
      return String(vkUser.username).toUpperCase();
    }
    if (vkUser && vkUser.id) {
      debug.source = 'vk.id';
      window.__vertaxNameDebug = debug;
      return 'VK' + String(vkUser.id);
    }
  } catch (e) {}
  debug.source = 'fallback';
  window.__vertaxNameDebug = debug;
  try {
    if (
      (typeof isTelegramRuntime === 'function' && isTelegramRuntime()) ||
      (typeof isVkMiniApp === 'function' && isVkMiniApp()) ||
      (typeof isMaxRuntime === 'function' && isMaxRuntime())
    ) {
      console.warn(
        '[VERTAX] getVertaxUserName fell back to DUDE. Inspect window.__vertaxNameDebug and window.Telegram?.WebApp?.initDataUnsafe.'
      );
    }
  } catch (_) {}
  return 'DUDE';
}
window.getVertaxUserName = getVertaxUserName;

var __vertaxClockTimer = null;
function vertaxFormatTime(d) {
  var hh = String(d.getHours());
  if (hh.length < 2) hh = '0' + hh;
  var mm = String(d.getMinutes());
  if (mm.length < 2) mm = '0' + mm;
  return hh + '<span class="vertax-display-colon">:</span>' + mm;
}
function startVertaxClockTicker() {
  function tick() {
    var el = document.getElementById('vertax-clock');
    if (el) el.innerHTML = vertaxFormatTime(new Date());
  }
  tick();
  if (__vertaxClockTimer) return;
  __vertaxClockTimer = setInterval(function () {
    var el = document.getElementById('vertax-clock');
    if (!el) return;
    el.innerHTML = vertaxFormatTime(new Date());
  }, 30000);
}

function vertaxStandardDisplayInnerHtml() {
  var n = typeof state !== 'undefined' && state && state.collection ? state.collection.length : 0;
  var sets = typeof state !== 'undefined' && state && state.sets ? state.sets.length : 0;
  function pad3(x) {
    var s = String(x || 0);
    while (s.length < 3) s = '0' + s;
    return s;
  }
  return (
    '<div class="vertax-display-top">' +
    '<span class="vertax-display-status"><span class="vertax-display-led"></span>READY</span>' +
    '<span class="vertax-display-clock" id="vertax-clock">--<span class="vertax-display-colon">:</span>--</span>' +
    '</div>' +
    '<div class="vertax-display-title">DIG. PLAY. SHARE.</div>' +
    '<div class="vertax-display-stats">' +
    '<span class="vertax-display-stat"><strong>' +
    pad3(n) +
    '</strong><small>RECORDS</small></span>' +
    '<span class="vertax-display-stat"><strong>' +
    pad3(sets) +
    '</strong><small>SETS</small></span>' +
    '<span class="vertax-display-stat"><strong>LOCAL</strong><small>DB</small></span>' +
    '</div>'
  );
}

function vertaxFinalDisplayMarkup() {
  var n = typeof state !== 'undefined' && state && state.collection ? state.collection.length : 0;
  var sets = typeof state !== 'undefined' && state && state.sets ? state.sets.length : 0;
  function pad3(x) {
    var s = String(x || 0);
    while (s.length < 3) s = '0' + s;
    return s;
  }
  return [
    { cls: 'status', text: 'READY' },
    { cls: 'clock', html: vertaxFormatTime(new Date()) },
    { cls: 'title', text: 'DIG. PLAY. SHARE.' },
    { cls: 'stat', strong: pad3(n), small: 'RECORDS' },
    { cls: 'stat', strong: pad3(sets), small: 'SETS' },
    { cls: 'stat', strong: 'LOCAL', small: 'DB' },
  ];
}

function runVertaxBootSequence(display) {
  if (!display || display.dataset.vertaxBoot === 'running') return;
  display.dataset.vertaxBoot = 'running';
  var name = getVertaxUserName();
  var hello = 'HELLO, ' + name;
  if (hello.length > 26) hello = hello.slice(0, 25) + '…';
  var finalItems = vertaxFinalDisplayMarkup();
  display.innerHTML =
    '<div class="vertax-boot vertax-boot-full">' +
    '<div class="vertax-boot-line" id="vertax-boot-line"></div>' +
    '<span class="vertax-boot-caret"></span>' +
    '</div>';
  var boot = display.querySelector('.vertax-boot');
  var lineEl = display.querySelector('#vertax-boot-line');

  function alive() {
    return document.contains(display) && display.dataset.vertaxBoot === 'running';
  }

  function typeInto(el, text, done, charIdx) {
    if (!alive()) return;
    if (!el) return;
    charIdx = charIdx || 0;
    if (charIdx <= text.length) {
      el.textContent = text.slice(0, charIdx);
      var nextDelay = 24 + Math.random() * 14;
      setTimeout(function () {
        typeInto(el, text, done, charIdx + 1);
      }, nextDelay);
    } else {
      setTimeout(function () {
        if (alive() && done) done();
      }, 220);
    }
  }

  function erase(el, done) {
    if (!alive() || !el) return;
    var text = el.textContent || '';
    if (text.length) {
      el.textContent = text.slice(0, -1);
      setTimeout(
        function () {
          erase(el, done);
        },
        14 + Math.random() * 10
      );
    } else {
      setTimeout(function () {
        if (alive() && done) done();
      }, 120);
    }
  }

  function typeFinalItem(idx) {
    if (!alive()) return;
    if (idx >= finalItems.length) return finish();
    var item = finalItems[idx];
    var row = document.createElement('div');
    row.className = 'vertax-boot-row vertax-boot-row-' + item.cls;
    var caret = boot.querySelector('.vertax-boot-caret');
    if (item.cls === 'stat') {
      row.innerHTML = '<strong></strong><small></small>';
      boot.insertBefore(row, caret || null);
      typeInto(row.querySelector('strong'), item.strong, function () {
        typeInto(row.querySelector('small'), item.small, function () {
          typeFinalItem(idx + 1);
        });
      });
    } else if (item.html) {
      row.innerHTML = item.html;
      boot.insertBefore(row, caret || null);
      setTimeout(function () {
        typeFinalItem(idx + 1);
      }, 190);
    } else {
      boot.insertBefore(row, caret || null);
      typeInto(row, item.text, function () {
        typeFinalItem(idx + 1);
      });
    }
  }

  function finish() {
    if (!alive()) return;
    setTimeout(function () {
      if (!alive()) return;
      delete display.dataset.vertaxBoot;
      display.innerHTML = vertaxStandardDisplayInnerHtml();
      window.__vertaxBootDone = true;
      try {
        localStorage.setItem('vertaxBootLastShownAt', String(Date.now()));
      } catch (_) {}
      startVertaxClockTicker();
    }, 520);
  }
  typeInto(lineEl, hello, function () {
    erase(lineEl, function () {
      if (boot) boot.innerHTML = '<span class="vertax-boot-caret"></span>';
      typeFinalItem(0);
    });
  });
}

function vertaxNormalizeCamelotText(s) {
  return String(s || '')
    .replace(/KEY\s*:\s*/gi, '')
    .replace(/ТОНАЛЬНОСТЬ\s*:\s*/gi, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\s+/g, ' ')
    .trim();
}

function vertaxCamelotFromText(text) {
  var raw = vertaxNormalizeCamelotText(text);
  if (!raw) return null;
  var direct = raw.toUpperCase().match(/^([1-9]|1[0-2])[AB]$/);
  if (direct) return direct[0];
  try {
    if (typeof KEY_TO_CAMELOT !== 'undefined') {
      var low = raw.toLowerCase();
      for (var k in KEY_TO_CAMELOT) {
        if (
          Object.prototype.hasOwnProperty.call(KEY_TO_CAMELOT, k) &&
          String(k).toLowerCase() === low
        ) {
          return KEY_TO_CAMELOT[k];
        }
      }
    }
    if (typeof normalizeKeyName === 'function') {
      var nk = normalizeKeyName(raw);
      if (nk && typeof KEY_TO_CAMELOT !== 'undefined') return KEY_TO_CAMELOT[nk] || null;
    }
    if (typeof normalizeKey === 'function') {
      var nk2 = normalizeKey(raw);
      if (nk2 && typeof KEY_TO_CAMELOT !== 'undefined') return KEY_TO_CAMELOT[nk2] || null;
    }
  } catch (_) {}
  return null;
}

function vertaxApplyCamelotOnlyUi(root) {
  root = root || document.getElementById('laiso-root') || document.getElementById('laiso-app');
  if (!root) return;
  root.querySelectorAll('.laiso-set-big-key').forEach(function (el) {
    el.remove();
  });
  root.querySelectorAll('#et-cam option, #et-key option').forEach(function (opt) {
    var cam = vertaxCamelotFromText(opt.value || opt.textContent);
    if (cam) opt.textContent = cam;
  });
  root.querySelectorAll('.laiso-label').forEach(function (label) {
    if (!/тональность|key/i.test(label.textContent || '')) return;
    var panel = label.closest && label.closest('.laiso-panel');
    if (panel && panel.querySelector('#et-key')) panel.style.display = 'none';
  });
  root.querySelectorAll('.runt19-live-pill.soft').forEach(function (el) {
    var cam = vertaxCamelotFromText(el.textContent);
    if (cam && /key|major|minor/i.test(el.textContent || '')) el.textContent = cam;
  });
  root.querySelectorAll('.laiso-track').forEach(function (row) {
    var keyEl = row.querySelector('.laiso-track-key');
    var camEl = row.querySelector('.laiso-track-cam');
    var cam = camEl ? vertaxCamelotFromText(camEl.textContent) : null;
    if (!cam && keyEl) cam = vertaxCamelotFromText(keyEl.textContent);
    if (camEl && cam) camEl.textContent = cam;
    if (keyEl) {
      if (cam) {
        keyEl.textContent = cam;
        keyEl.classList.add('vertax-camelot-only');
      } else if (/\b(major|minor)\b/i.test(keyEl.textContent || '')) {
        keyEl.textContent = '—';
      }
    }
  });
  root.querySelectorAll('.laiso-lcd-cell').forEach(function (cell) {
    var label = cell.querySelector('.laiso-lcd-label');
    var value = cell.querySelector('.laiso-lcd-m');
    if (!label || !value) return;
    if (/^key$/i.test((label.textContent || '').trim())) {
      var cam = vertaxCamelotFromText(value.textContent);
      if (cam) {
        label.textContent = 'CAMELOT';
        value.textContent = cam;
      } else {
        cell.style.display = 'none';
      }
    }
  });
  root
    .querySelectorAll('.runt-chip,.runt25-pill,.laiso-pill,.laiso-chip,.laiso-badge')
    .forEach(function (el) {
      var text = el.textContent || '';
      if (!/\b(major|minor)\b/i.test(text)) return;
      var cam = vertaxCamelotFromText(text);
      if (cam) el.textContent = cam;
    });
}

vertaxAfterRenderCallbacks =
  window.__vertaxAfterRenderCallbacks || vertaxAfterRenderCallbacks || [];
window.__vertaxAfterRenderCallbacks = vertaxAfterRenderCallbacks;
function vertaxRegisterAfterRender(fn) {
  if (typeof fn !== 'function') return;
  if (vertaxAfterRenderCallbacks.indexOf(fn) >= 0) return;
  vertaxAfterRenderCallbacks.push(fn);
}
function vertaxRunAfterRenderCallbacks() {
  vertaxAfterRenderCallbacks.slice().forEach(function (fn) {
    try {
      fn();
    } catch (e) {
      console.warn('vertax after-render callback failed', e);
    }
  });
}
function vertaxAfterRender() {
  if (typeof state === 'undefined') return;
  vertaxApplyCamelotOnlyUi();
  syncTelegramChrome();
  vertaxRunAfterRenderCallbacks();
  if (state.view !== 'home') return;
  var display = document.getElementById('vertax-display');
  if (!display) return;
  if (!window.__vertaxBootDone && display.dataset.vertaxBoot !== 'running') {
    window.__vertaxBootStarted = true;
    runVertaxBootSequence(display);
    return;
  }
  if (!display.dataset.vertaxBoot) startVertaxClockTicker();
}
window.vertaxAfterRender = vertaxAfterRender;
window.vertaxRegisterAfterRender = vertaxRegisterAfterRender;
window.startVertaxClockTicker = startVertaxClockTicker;
window.vertaxApplyCamelotOnlyUi = vertaxApplyCamelotOnlyUi;

/* RUNT-01 PATCH 33 — Deezer BPM source (client-side, no keys) */
(function installVertaxDeezerBpmPatch() {
  if (window.__vertaxDeezerBpmPatchInstalled) return;
  window.__vertaxDeezerBpmPatchInstalled = true;

  function metadataEmpty(meta) {
    return !meta || (!meta.bpm && !meta.key && !meta.camelot);
  }

  function metadataFull(meta) {
    return !!(meta && meta.bpm && (meta.key || meta.camelot));
  }

  function hasKey(meta) {
    return !!(meta && (meta.key || meta.camelot));
  }

  function sourceName(meta) {
    return String((meta && (meta.source || meta.bpmSource || meta.keySource)) || '').toLowerCase();
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\s*[\[(][^\])]+[\])]/g, ' ')
      .replace(/\b(original|remaster(?:ed)?|remix|mix|edit|version|vip)\b/gi, ' ')
      .replace(/[^a-z0-9а-яё]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function leadArtist(value) {
    return String(value || '')
      .split(/\s*(?:,|&|\+|\bfeat\.?\b|\bft\.?\b|\bwith\b)\s*/i)[0]
      .trim();
  }

  function titleMatches(wantedTitle, trackTitle) {
    if (!wantedTitle || !trackTitle) return false;
    if (wantedTitle === trackTitle) return true;
    if (wantedTitle.length >= 6 && trackTitle.indexOf(wantedTitle) >= 0) return true;
    if (trackTitle.length >= 6 && wantedTitle.indexOf(trackTitle) >= 0) return true;
    return false;
  }

  function trackScore(track, artist, title) {
    if (!track) return 0;
    var wantedArtist = normalizeSearchText(leadArtist(artist));
    var wantedTitle = normalizeSearchText(title);
    var trackArtist = normalizeSearchText(track.artist && track.artist.name);
    var trackTitle = normalizeSearchText(track.title || track.title_short);
    var score = 0;
    if (wantedArtist && trackArtist.indexOf(wantedArtist) >= 0) score += 2;
    if (titleMatches(wantedTitle, trackTitle)) score += 3;
    return score;
  }

  function deezerJsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = '__vertaxDeezerJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      var script = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('Deezer JSONP timeout'));
      }, 8000);
      function cleanup() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          delete window[cb];
        } catch (_) {
          window[cb] = undefined;
        }
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };
      script.onerror = function () {
        cleanup();
        reject(new Error('Deezer JSONP failed'));
      };
      script.src =
        url +
        (url.indexOf('?') >= 0 ? '&' : '?') +
        'output=jsonp&callback=' +
        encodeURIComponent(cb);
      document.head.appendChild(script);
    });
  }

  async function deezerRequest(url) {
    try {
      return await deezerJsonp(url);
    } catch (_) {}
    var response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  }

  function buildDeezerQueries(artist, title) {
    var a = String(artist || '').trim();
    var t = String(title || '').trim();
    var cleanA = leadArtist(a);
    var cleanT = String(t)
      .replace(/\s*[\[(][^\])]+[\])]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    var variants = [
      'artist:"' + a + '" track:"' + t + '"',
      a + ' ' + t,
      cleanA + ' ' + cleanT,
      t + ' ' + a,
    ];
    var seen = {};
    return variants
      .map(function (q) {
        return q.replace(/\s+/g, ' ').trim();
      })
      .filter(function (q) {
        if (!q || seen[q]) return false;
        seen[q] = true;
        return true;
      });
  }

  async function findDeezerTrack(artist, title) {
    var queries = buildDeezerQueries(artist, title);
    var fallback = null;
    var fallbackScore = 0;
    for (var i = 0; i < queries.length; i++) {
      var searchUrl =
        'https://api.deezer.com/search?q=' + encodeURIComponent(queries[i]) + '&limit=5';
      var searchData = await deezerRequest(searchUrl);
      var tracks = searchData && Array.isArray(searchData.data) ? searchData.data : [];
      if (!tracks.length) continue;
      tracks.sort(function (a, b) {
        return trackScore(b, artist, title) - trackScore(a, artist, title);
      });
      var score = trackScore(tracks[0], artist, title);
      if (score > fallbackScore) {
        fallback = tracks[0];
        fallbackScore = score;
      }
      if (score >= 4) return tracks[0];
    }
    return fallbackScore >= 4 ? fallback : null;
  }

  async function fetchFromDeezer(artist, title) {
    try {
      if (!artist || !title) return null;
      window.__vertaxDeezerLastLookup = {
        artist: artist || '',
        title: title || '',
        status: 'request',
      };
      var track = await findDeezerTrack(artist, title);
      if (!track || !track.id) {
        window.__vertaxDeezerLastLookup.status = 'not-found';
        return null;
      }
      var trackUrl = 'https://api.deezer.com/track/' + encodeURIComponent(track.id);
      var trackData = await deezerRequest(trackUrl);
      window.__vertaxDeezerLastLookup.status = 'response';
      window.__vertaxDeezerLastLookup.track = {
        id: (trackData && trackData.id) || track.id,
        title: (trackData && trackData.title) || track.title || '',
        artist:
          (trackData && trackData.artist && trackData.artist.name) ||
          (track.artist && track.artist.name) ||
          '',
        bpm: trackData && trackData.bpm,
      };
      if (!trackData || !trackData.bpm || trackData.bpm === 0) {
        window.__vertaxDeezerLastLookup.status = 'no-bpm';
        return null;
      }
      return {
        bpm: Math.round(trackData.bpm),
        key: null,
        camelot: null,
        source: 'deezer',
        bpmSource: 'deezer',
        cover:
          trackData.album && trackData.album.cover_medium ? trackData.album.cover_medium : null,
        year: trackData.release_date ? String(trackData.release_date).slice(0, 4) : null,
        confidence: 'medium',
      };
    } catch (e) {
      window.__vertaxDeezerLastLookup = {
        artist: artist || '',
        title: title || '',
        status: 'error',
        message: e && e.message ? e.message : String(e),
      };
      console.warn('Deezer lookup failed', e);
      return null;
    }
  }
  window.fetchFromDeezer = fetchFromDeezer;

  function syncFetchingItem(track, meta) {
    try {
      var fp = state && state.ui && state.ui.fetchProgress;
      if (!fp || !Array.isArray(fp.items)) return;
      fp.items.forEach(function (item) {
        if (!item || String(item.trackId) !== String(track.id)) return;
        item.status = track.bpm || track.key || track.camelot ? 'ok' : 'notfound';
        item.meta =
          track.bpm || track.key || track.camelot
            ? {
                bpm: track.bpm || null,
                key: track.key || null,
                camelot: track.camelot || null,
                source: sourceName(meta) || track.bpmSource || track.keySource || 'manual',
                confidence: track.confidence || 'medium',
              }
            : null;
      });
    } catch (_) {}
  }

  function applyLookupMetaToTrack(track, vinyl, meta) {
    if (!track || !vinyl || !meta) return false;
    var changed = false;
    var src = sourceName(meta);
    if (meta.beatport) {
      if (!track.genre && meta.beatport.genre) {
        track.genre = meta.beatport.genre;
        changed = true;
      }
      if (!track.subGenre && meta.beatport.subGenre) {
        track.subGenre = meta.beatport.subGenre;
        changed = true;
      }
      if (!track.beatportUrl && meta.beatport.url) {
        track.beatportUrl = meta.beatport.url;
        changed = true;
      }
    }
    if (!track.bpm && meta.bpm) {
      track.bpm = meta.bpm;
      track.bpmSource = meta.bpmSource || src || null;
      track.originalBpm = meta.originalBpm || null;
      track.halftimeCorrected = !!meta.halftimeCorrected;
      changed = true;
    }
    if (!hasKey(track) && hasKey(meta)) {
      track.key = meta.key || null;
      track.camelot =
        meta.camelot ||
        (meta.key && typeof KEY_TO_CAMELOT !== 'undefined' ? KEY_TO_CAMELOT[meta.key] : null);
      track.keySource = meta.keySource || src || null;
      changed = true;
    }
    if (!changed) return false;
    track.conflict = null;
    track.confidence = meta.confidence || (track.bpm && hasKey(track) ? 'medium' : 'manual');
    syncFetchingItem(track, meta);
    try {
      if (typeof persistVinyl === 'function') persistVinyl(vinyl);
    } catch (_) {}
    return true;
  }

  function findTrackPairByActionEl(el) {
    var vid = el && el.dataset ? el.dataset.vid : null;
    var tid = el && el.dataset ? el.dataset.tid : null;
    var vinyl = typeof findVinyl === 'function' ? findVinyl(vid) : null;
    var track = vinyl && typeof findTrack === 'function' ? findTrack(vinyl, tid) : null;
    return { vinyl: vinyl, track: track };
  }

  function installManualLookupBridge() {
    if (typeof handlers === 'undefined' || !handlers) return false;
    if (window.__vertaxDeezerManualLookupBridgeInstalled) return true;
    var oldManual = handlers['track-manual-meta'];
    handlers['track-manual-meta'] = async function (e, el) {
      var pair = findTrackPairByActionEl(el);
      if (!pair.track || !pair.vinyl) {
        if (oldManual) return oldManual(e, el);
        return;
      }
      var needsBpm = !pair.track.bpm;
      var needsKey = !hasKey(pair.track);
      if (!needsBpm && !needsKey) {
        if (oldManual) return oldManual(e, el);
        return;
      }
      installMetadataCascade();
      if (typeof showToast === 'function') showToast('Ищу BPM/Key...', 900);
      var meta = null;
      try {
        if (typeof fetchTrackMetadata === 'function')
          meta = await fetchTrackMetadata(pair.track, pair.vinyl);
      } catch (err) {
        console.warn('Metadata lookup before manual input failed', err);
      }
      if (applyLookupMetaToTrack(pair.track, pair.vinyl, meta)) {
        if (typeof showToast === 'function')
          showToast('Нашлось: ' + String(sourceName(meta) || 'source').toUpperCase());
        if (typeof render === 'function') render();
        return;
      }
      var last = window.__vertaxDeezerLastLookup || {};
      if (typeof showToast === 'function') {
        if (last.status === 'no-bpm') showToast('Deezer нашёл трек, но BPM пустой', 1400);
        else showToast('Автопоиск не нашёл. Введи вручную.', 1400);
      }
      if (oldManual) return oldManual(e, el);
    };
    window.__vertaxDeezerManualLookupBridgeInstalled = true;
    return true;
  }

  function isDnbVinyl(vinyl) {
    var words = [
      'drum and bass',
      "drum 'n' bass",
      'drum & bass',
      'drum&bass',
      'dnb',
      'd&b',
      'jungle',
    ];
    var hay = [
      vinyl && vinyl.format,
      vinyl && vinyl.genre,
      vinyl && vinyl.style,
      vinyl && vinyl.label,
      vinyl && vinyl.title,
    ]
      .map(function (x) {
        return String(x || '').toLowerCase();
      })
      .join(' ');
    return words.some(function (word) {
      return hay.indexOf(word) >= 0;
    });
  }

  function normalizeMeta(meta) {
    if (!meta) return null;
    var out = Object.assign({}, meta);
    var src = sourceName(out);
    if (out.bpm && !out.bpmSource && src) out.bpmSource = src;
    if ((out.key || out.camelot) && !out.keySource && src) out.keySource = src;
    return out;
  }

  function combineMeta(base, addition) {
    var out = normalizeMeta(base) || {};
    var add = normalizeMeta(addition);
    if (!add) return metadataEmpty(out) ? null : out;
    var addSource = sourceName(add);
    if (!out.bpm && add.bpm) {
      out.bpm = add.bpm;
      out.bpmSource = add.bpmSource || addSource || null;
      if (add.originalBpm) out.originalBpm = add.originalBpm;
      if (add.halftimeCorrected) out.halftimeCorrected = add.halftimeCorrected;
    }
    if (!hasKey(out) && hasKey(add)) {
      out.key = add.key || null;
      out.camelot =
        add.camelot ||
        (add.key && typeof KEY_TO_CAMELOT !== 'undefined' ? KEY_TO_CAMELOT[add.key] : null);
      out.keySource = add.keySource || addSource || null;
    }
    out.source =
      out.bpmSource && out.keySource && out.bpmSource !== out.keySource
        ? out.bpmSource + '+' + out.keySource
        : out.bpmSource || out.keySource || addSource || out.source || null;
    out.confidence = out.confidence || add.confidence || 'medium';
    return metadataEmpty(out) ? null : out;
  }

  function applyFinalHalftimeCorrection(meta, vinyl) {
    var result = meta;
    if (typeof applyHalftimeCorrection === 'function') {
      result = applyHalftimeCorrection(result, vinyl);
    }
    if (
      result &&
      result.bpmSource === 'deezer' &&
      result.bpm &&
      !result.halftimeCorrected &&
      isDnbVinyl(vinyl) &&
      result.bpm < 100
    ) {
      result = Object.assign({}, result, {
        bpm: result.bpm * 2,
        halftimeCorrected: true,
        originalBpm: result.bpm,
      });
    }
    return result;
  }

  function installMetadataCascade() {
    if (typeof fetchTrackMetadata !== 'function') return false;
    if (typeof fetchFromGetSongBPM !== 'function') return false;
    if (typeof fetchFromAcousticBrainz !== 'function') return false;
    if (window.__vertaxDeezerFetchTrackMetadataWrapped) return true;

    fetchTrackMetadata = window.fetchTrackMetadata = async function (track, vinyl) {
      vinyl = vinyl || {};
      track = track || {};
      var artist = vinyl.artist || track.vinylArtist || '';
      var title = track.title || '';
      var cacheKey =
        String(artist || '')
          .toLowerCase()
          .trim() +
        '|' +
        String(title || '')
          .toLowerCase()
          .trim();
      var result = null;

      if (typeof getCachedMetadata === 'function') {
        var cached = await getCachedMetadata(cacheKey);
        if (cached) {
          result = normalizeMeta(cached);
          if (metadataFull(result)) return result;
        }
      }

      if (!metadataFull(result) && metadataEmpty(result)) {
        result = combineMeta(result, await fetchFromGetSongBPM(artist, title));
        if (metadataFull(result)) {
          result = applyFinalHalftimeCorrection(result, vinyl);
          if (typeof setCachedMetadata === 'function') await setCachedMetadata(cacheKey, result);
          return result;
        }
      }

      if (!metadataFull(result)) {
        result = combineMeta(result, await fetchFromAcousticBrainz(artist, title));
        if (metadataFull(result)) {
          result = applyFinalHalftimeCorrection(result, vinyl);
          if (typeof setCachedMetadata === 'function') await setCachedMetadata(cacheKey, result);
          return result;
        }
      }

      if (!result || !result.bpm) {
        result = combineMeta(result, await fetchFromDeezer(artist, title));
      }

      if (result && result.bpm) result = applyFinalHalftimeCorrection(result, vinyl);
      if (result && typeof setCachedMetadata === 'function')
        await setCachedMetadata(cacheKey, result);
      return result;
    };

    window.__vertaxDeezerFetchTrackMetadataWrapped = true;
    return true;
  }

  function getTrackBpmSource(track) {
    return String((track && (track.bpmSource || track.source || '')) || '').toLowerCase();
  }

  function injectDeezerBadges() {
    if (typeof state === 'undefined' || !state) return;
    if (state.view === 'tracklist') {
      var vinyl =
        typeof findVinyl === 'function' ? findVinyl(state.ui && state.ui.currentVinylId) : null;
      if (vinyl && Array.isArray(vinyl.tracklist)) {
        document.querySelectorAll('#laiso-app .laiso-track[data-track-id]').forEach(function (row) {
          var tr = vinyl.tracklist.find(function (t) {
            return String(t.id) === String(row.getAttribute('data-track-id'));
          });
          if (!tr || getTrackBpmSource(tr) !== 'deezer' || !tr.bpm) return;
          var box = row.querySelector('.laiso-track-bpm');
          if (box && !box.querySelector('.vertax-source-deezer')) {
            box.insertAdjacentHTML(
              'beforeend',
              '<span class="vertax-source-deezer">DEEZER' +
                (tr.halftimeCorrected ? ' <span>1/2x</span>' : '') +
                '</span>'
            );
          }
        });
      }
    }
    if (state.view === 'edit-track') {
      var v =
        typeof findVinyl === 'function' ? findVinyl(state.ui && state.ui.currentVinylId) : null;
      var t =
        v && typeof findTrack === 'function'
          ? findTrack(v, state.ui && state.ui.currentTrackId)
          : null;
      if (!t || getTrackBpmSource(t) !== 'deezer') return;
      var toggle = document.querySelector('#laiso-app .laiso-toggle');
      if (toggle && !toggle.querySelector('.vertax-source-deezer-toggle')) {
        toggle.insertAdjacentHTML(
          'beforeend',
          '<button type="button" class="active vertax-source-deezer-toggle">DEEZER</button>'
        );
      }
    }
  }

  function afterRender() {
    installMetadataCascade();
    installManualLookupBridge();
    injectDeezerBadges();
  }

  var style = document.createElement('style');
  style.textContent = [
    '#laiso-app .vertax-source-deezer{display:block;font-family:var(--font-mono);font-size:8px;color:var(--text-tertiary);letter-spacing:.04em;margin-top:1px;line-height:1;text-transform:uppercase;}',
    '#laiso-app .vertax-source-deezer span{color:var(--warning);}',
    '#laiso-app .vertax-source-deezer-toggle{background:var(--bg-panel)!important;color:var(--text-primary)!important;border-color:var(--border)!important;}',
    'body #laiso-app input,body #laiso-app input.laiso-input,body #laiso-app textarea,body #laiso-app textarea.laiso-textarea,body #laiso-app select,body #laiso-app select.laiso-select,body #laiso-app [contenteditable="true"]{caret-color:var(--runt-accent,#C8FF2E)!important;}',
  ].join('\n');
  document.head.appendChild(style);

  if (typeof window.vertaxRegisterAfterRender === 'function')
    window.vertaxRegisterAfterRender(afterRender);
  afterRender();
  setTimeout(afterRender, 300);
  console.log('RUNT-01 PATCH-33 loaded: Deezer BPM source');
})();

/* RUNT-01 PATCH 34 — Beatport first BPM/Key source via Vercel proxy */
(function installVertaxBeatportBpmPatch() {
  if (window.__vertaxBeatportBpmPatchInstalled) return;
  window.__vertaxBeatportBpmPatchInstalled = true;

  function hasMeta(meta) {
    return !!(meta && (meta.bpm || meta.key || meta.camelot));
  }

  function hasFullMeta(meta) {
    return !!(meta && meta.bpm && (meta.key || meta.camelot));
  }

  function sourceName(meta) {
    return String((meta && (meta.source || meta.bpmSource || meta.keySource)) || '').toLowerCase();
  }

  function normalizeBeatportKey(keyName, camelot) {
    if (camelot && typeof CAMELOT_TO_KEY !== 'undefined' && CAMELOT_TO_KEY[camelot])
      return CAMELOT_TO_KEY[camelot];
    if (!keyName) return null;
    var text = String(keyName)
      .trim()
      .replace(/\bmin\b/i, 'minor')
      .replace(/\bmaj\b/i, 'major');
    if (typeof normalizeKeyName === 'function') return normalizeKeyName(text);
    return text || null;
  }

  async function fetchFromBeatport(artist, title, label) {
    try {
      if (!artist || !title) return null;
      var url =
        '/api/beatport-lookup?artist=' +
        encodeURIComponent(artist) +
        '&title=' +
        encodeURIComponent(title);
      if (label) url += '&label=' + encodeURIComponent(label);
      window.__vertaxBeatportLastLookup = {
        artist: artist || '',
        title: title || '',
        status: 'request',
      };
      var response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        window.__vertaxBeatportLastLookup.status = response.status === 429 ? 'rate-limit' : 'error';
        window.__vertaxBeatportLastLookup.httpStatus = response.status;
        return null;
      }
      var data = await response.json();
      window.__vertaxBeatportLastLookup = Object.assign(
        {
          artist: artist || '',
          title: title || '',
          status: data && data.matched ? 'matched' : 'not-found',
        },
        data || {}
      );
      if (!data || data.matched === false) return null;
      var key = normalizeBeatportKey(data.key_name, data.camelot);
      if (!data.bpm && !data.camelot && !key) return null;
      return {
        bpm: data.bpm ? Math.round(Number(data.bpm)) : null,
        key: key,
        camelot:
          data.camelot ||
          (key && typeof KEY_TO_CAMELOT !== 'undefined' ? KEY_TO_CAMELOT[key] : null),
        source: 'beatport',
        bpmSource: data.bpm ? 'beatport' : null,
        keySource: data.camelot || key ? 'beatport' : null,
        confidence: data.confidence >= 0.9 ? 'high' : 'medium',
        beatport: {
          label: data.label || null,
          genre: data.genre || null,
          subGenre: data.sub_genre || null,
          releaseYear: data.release_year || null,
          mixName: data.mix_name || null,
          url: data.beatport_url || null,
          confidence: data.confidence || null,
        },
      };
    } catch (e) {
      window.__vertaxBeatportLastLookup = {
        artist: artist || '',
        title: title || '',
        status: 'error',
        message: e && e.message ? e.message : String(e),
      };
      console.warn('Beatport lookup failed', e);
      return null;
    }
  }
  window.fetchFromBeatport = fetchFromBeatport;

  function applyBeatportHalftime(meta, vinyl) {
    var result = meta;
    if (typeof applyHalftimeCorrection === 'function')
      result = applyHalftimeCorrection(result, vinyl);
    if (!result || sourceName(result) !== 'beatport' || !result.bpm || result.halftimeCorrected)
      return result;
    var hay = [
      vinyl && vinyl.format,
      vinyl && vinyl.genre,
      vinyl && vinyl.style,
      vinyl && vinyl.label,
      vinyl && vinyl.title,
      result.beatport && result.beatport.genre,
      result.beatport && result.beatport.subGenre,
    ]
      .map(function (x) {
        return String(x || '').toLowerCase();
      })
      .join(' ');
    if (
      /(drum\s*(?:&|and)?\s*bass|dnb|d&b|jungle|neurofunk|liquid funk|techstep)/i.test(hay) &&
      result.bpm < 100
    ) {
      result = Object.assign({}, result, {
        bpm: result.bpm * 2,
        halftimeCorrected: true,
        originalBpm: result.bpm,
      });
    }
    return result;
  }

  function installBeatportFirstCascade() {
    if (typeof fetchTrackMetadata !== 'function') return false;
    if (window.__vertaxBeatportFetchTrackMetadataWrapped) return true;
    var oldFetchTrackMetadata = fetchTrackMetadata;

    fetchTrackMetadata = window.fetchTrackMetadata = async function (track, vinyl) {
      track = track || {};
      vinyl = vinyl || {};
      var artist = vinyl.artist || track.vinylArtist || '';
      var title = track.title || '';
      var label = vinyl.label || track.vinylLabel || '';
      var cacheKey =
        String(artist || '')
          .toLowerCase()
          .trim() +
        '|' +
        String(title || '')
          .toLowerCase()
          .trim();

      var beatport = await fetchFromBeatport(artist, title, label);
      if (hasMeta(beatport)) {
        beatport = applyBeatportHalftime(beatport, vinyl);
        if (typeof setCachedMetadata === 'function') {
          try {
            await setCachedMetadata(cacheKey, beatport);
          } catch (_) {}
        }
        return beatport;
      }

      var fallback = await oldFetchTrackMetadata(track, vinyl);
      if (hasFullMeta(fallback)) return fallback;
      return fallback || null;
    };

    window.__vertaxBeatportFetchTrackMetadataWrapped = true;
    return true;
  }

  function trackSource(track) {
    return String(
      (track && (track.bpmSource || track.keySource || track.source || '')) || ''
    ).toLowerCase();
  }

  function injectBeatportBadges() {
    if (typeof state === 'undefined' || !state) return;
    if (state.view === 'tracklist') {
      var vinyl =
        typeof findVinyl === 'function' ? findVinyl(state.ui && state.ui.currentVinylId) : null;
      if (vinyl && Array.isArray(vinyl.tracklist)) {
        document.querySelectorAll('#laiso-app .laiso-track[data-track-id]').forEach(function (row) {
          var tr = vinyl.tracklist.find(function (t) {
            return String(t.id) === String(row.getAttribute('data-track-id'));
          });
          if (!tr || trackSource(tr) !== 'beatport' || !tr.bpm) return;
          var box = row.querySelector('.laiso-track-bpm');
          if (box && !box.querySelector('.vertax-source-beatport')) {
            box.insertAdjacentHTML(
              'beforeend',
              '<span class="vertax-source-beatport">BEATPORT' +
                (tr.halftimeCorrected ? ' <span>1/2x</span>' : '') +
                '</span>'
            );
          }
        });
      }
    }
    if (state.view === 'edit-track') {
      var v =
        typeof findVinyl === 'function' ? findVinyl(state.ui && state.ui.currentVinylId) : null;
      var t =
        v && typeof findTrack === 'function'
          ? findTrack(v, state.ui && state.ui.currentTrackId)
          : null;
      if (!t || trackSource(t) !== 'beatport') return;
      var toggle = document.querySelector('#laiso-app .laiso-toggle');
      if (toggle && !toggle.querySelector('.vertax-source-beatport-toggle')) {
        toggle.insertAdjacentHTML(
          'afterbegin',
          '<button type="button" class="active vertax-source-beatport-toggle">BEATPORT</button>'
        );
      }
    }
  }

  function afterRender() {
    installBeatportFirstCascade();
    injectBeatportBadges();
  }

  var style = document.createElement('style');
  style.textContent = [
    '#laiso-app .vertax-source-beatport{display:block;font-family:var(--font-mono);font-size:8px;color:var(--text-tertiary);letter-spacing:.04em;margin-top:1px;line-height:1;text-transform:uppercase;}',
    '#laiso-app .vertax-source-beatport span{color:var(--warning);}',
    '#laiso-app .vertax-source-beatport-toggle{background:var(--runt-accent,#C8FF2E)!important;color:#101010!important;border-color:var(--runt-accent-dark,#A7E600)!important;-webkit-text-fill-color:#101010!important;}',
  ].join('\n');
  document.head.appendChild(style);

  if (typeof window.vertaxRegisterAfterRender === 'function')
    window.vertaxRegisterAfterRender(afterRender);
  afterRender();
  setTimeout(afterRender, 500);
  console.log('RUNT-01 PATCH-34 loaded: Beatport first BPM/Key source');
})();

(function installVertaxManualMetaModal() {
  if (window.__vertaxManualMetaModalInstalled) return;
  window.__vertaxManualMetaModalInstalled = true;

  function findPairFromEl(el) {
    var vid =
      (el && el.dataset && (el.dataset.vid || el.dataset.vinylId)) ||
      (state.ui && state.ui.currentVinylId);
    var tid =
      (el && el.dataset && (el.dataset.tid || el.dataset.trackId)) ||
      (state.ui && state.ui.currentTrackId);
    var v = typeof findVinyl === 'function' ? findVinyl(vid) : null;
    var t = v && typeof findTrack === 'function' ? findTrack(v, tid) : null;
    return { v: v, t: t };
  }

  function parseBpm(raw) {
    var value = String(raw == null ? '' : raw)
      .trim()
      .replace(',', '.');
    if (!value) return null;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return { error: 'BPM должен быть числом' };
    var n = Number(value);
    if (!isFinite(n) || n < 40 || n > 250) return { error: 'BPM должен быть от 40 до 250' };
    return Math.round(n * 10) / 10;
  }

  function parseKey(raw) {
    var value = String(raw == null ? '' : raw).trim();
    if (!value) return { key: null, camelot: null };
    if (typeof window.runtValidateKey === 'function') {
      var parsed = window.runtValidateKey(value);
      if (parsed && parsed.error) return parsed;
      return parsed || { key: null, camelot: null };
    }
    if (typeof parseManualKeyInput === 'function') return parseManualKeyInput(value);
    if (/^\d{1,2}[ab]$/i.test(value)) {
      var cam = value.toUpperCase();
      return { key: CAMELOT_TO_KEY[cam] || null, camelot: cam };
    }
    var key = typeof normalizeKeyName === 'function' ? normalizeKeyName(value) : null;
    return { key: key || value, camelot: key && KEY_TO_CAMELOT ? KEY_TO_CAMELOT[key] : null };
  }

  function syncFetchingItem(track) {
    try {
      var fp = state && state.ui && state.ui.fetchProgress;
      if (!fp || !fp.items) return;
      fp.items.forEach(function (it) {
        if (it.trackId === track.id) {
          it.status = track.bpm || track.camelot || track.key ? 'ok' : 'notfound';
          it.meta =
            track.bpm || track.camelot || track.key
              ? {
                  bpm: track.bpm || null,
                  key: track.key || null,
                  camelot: track.camelot || null,
                  source: 'manual',
                  confidence: 'manual',
                }
              : null;
        }
      });
    } catch (_) {}
  }

  function openManualMetaModal(track, vinyl) {
    if (!track || !vinyl) return false;
    state.ui.manualMeta = {
      vinylId: vinyl.id,
      trackId: track.id,
      bpm: track.bpm || '',
      key: track.camelot || track.key || '',
      error: null,
    };
    state.modal = 'manual-meta';
    render();
    setTimeout(function () {
      var input = document.getElementById('manual-meta-bpm');
      if (input) input.focus();
    }, 30);
    return true;
  }

  function saveManualMetaModal() {
    var data = state.ui && state.ui.manualMeta;
    if (!data) return;
    var v = typeof findVinyl === 'function' ? findVinyl(data.vinylId) : null;
    var t = v && typeof findTrack === 'function' ? findTrack(v, data.trackId) : null;
    if (!v || !t) {
      state.modal = null;
      render();
      return;
    }
    var bpmEl = document.getElementById('manual-meta-bpm');
    var keyEl = document.getElementById('manual-meta-key');
    var bpmParsed = parseBpm(bpmEl ? bpmEl.value : '');
    if (bpmParsed && bpmParsed.error) {
      state.ui.manualMeta.error = bpmParsed.error;
      render();
      return;
    }
    var keyParsed = parseKey(keyEl ? keyEl.value : '');
    if (keyParsed && keyParsed.error) {
      state.ui.manualMeta.error = keyParsed.error;
      render();
      return;
    }
    t.bpm = bpmParsed === null ? null : bpmParsed;
    t.bpmSource = t.bpm ? 'manual' : null;
    t.originalBpm = null;
    t.halftimeCorrected = false;
    t.conflict = null;
    t.key = keyParsed.key;
    t.camelot = keyParsed.camelot;
    t.keySource = t.key || t.camelot ? 'manual' : null;
    t.confidence =
      t.bpm && (t.key || t.camelot) ? 'medium' : t.bpm || t.key || t.camelot ? 'medium' : 'manual';
    syncFetchingItem(t);
    if (typeof persistVinyl === 'function') persistVinyl(v);
    state.modal = null;
    state.ui.manualMeta = null;
    if (typeof showToast === 'function') showToast('BPM/Key сохранены');
    render();
  }

  function installOverride() {
    if (typeof handlers === 'undefined' || !handlers) return;
    handlers['track-manual-meta'] = function (_, el) {
      var pair = findPairFromEl(el);
      openManualMetaModal(pair.t, pair.v);
    };
    handlers['manual-meta-save'] = function () {
      saveManualMetaModal();
    };
    handlers['manual-meta-cancel'] = function () {
      state.modal = null;
      if (state.ui) state.ui.manualMeta = null;
      render();
    };
  }

  document.addEventListener('keydown', function (e) {
    if (!state || state.modal !== 'manual-meta') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (handlers && handlers['manual-meta-cancel']) handlers['manual-meta-cancel']();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      saveManualMetaModal();
    }
  });

  window.vertaxOpenManualMetaModal = openManualMetaModal;
  installOverride();
  setTimeout(installOverride, 0);
  setTimeout(installOverride, 600);
})();

(function exposeVertaxNamespace() {
  var api = (window.vertax = window.vertax || {});
  api.version = '1.0.0';
  api.state = state;
  api.handlers = handlers;
  api.render = function () {
    return render();
  };
  api.findVinyl = findVinyl;
  api.findTrack = findTrack;
  api.showToast = showToast;
  api.platform = {
    initBridge: initPlatformBridge,
    isTelegram: isTelegramRuntime,
    isVk: isVkMiniApp,
    isMax: isMaxRuntime,
  };
  api.data = {
    persistVinyl: persistVinyl,
    persistSet: persistSet,
    deleteVinyl: deleteVinylFromDb,
    deleteSet: deleteSetFromDb,
  };
  api.discogs = {
    search: discogsSearch,
    release: discogsRelease,
    collectionPage: discogsCollectionPage,
  };
  api.metadata = {
    fetchTrack: fetchTrackMetadata,
    getCached: getCachedMetadata,
    setCached: setCachedMetadata,
  };
  window.laisoBuck = window.laisoBuck || {};
  window.laisoBuck.state = state;
  window.laisoBuck.render = api.render;
})();
