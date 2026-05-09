/* VERTAX-01 / RUNT-01 app entrypoint. */

(function() {
    var webApp, botUsername;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      webApp = window.Telegram.WebApp;
      botUsername = "vertaksbot"; // заменить на username телеграм бота
    } else if (window.WebApp && window.WebApp.initData) {
      webApp = window.WebApp;
      botUsername = "id503124294144_2_bot"; // заменить на username макс бота
    }
    if (webApp) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.onedam.me/webapp/" + botUsername);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(webApp));
    }
  })();

document.addEventListener("gesturestart",function(e){e.preventDefault();},{passive:false});document.addEventListener("touchmove",function(e){if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});

/* Telegram Haptic Feedback wrapper. No-op outside Telegram WebApp. */
function haptic(type){
  var tg = getHostWebApp();
  var h = tg && tg.HapticFeedback;
  if (!h) return;
  try {
    if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
    else h.impactOccurred(type || 'light');
  } catch(_) {}
}
window.haptic = haptic;

function getHostWebApp(){
  if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
  if (window.WebApp) return window.WebApp;
  return null;
}

function getVertaxTheme(){
  try {
    var value = localStorage.getItem('vertax-theme');
    return value === 'dark' ? 'dark' : 'light';
  } catch(e) {
    return 'light';
  }
}

function applyVertaxTheme(theme){
  var normalized = theme === 'dark' ? 'dark' : 'light';
  if (document.body) {
    document.body.classList.remove('vertax-theme-light', 'vertax-theme-dark');
    document.body.classList.add(normalized === 'dark' ? 'vertax-theme-dark' : 'vertax-theme-light');
  }
  try {
    localStorage.setItem('vertax-theme', normalized);
  } catch(e) {}
  try {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', normalized === 'dark' ? '#0B0D0C' : '#ECEFF1');
  } catch(e) {}
  return normalized;
}

function toggleVertaxTheme(){
  return applyVertaxTheme(getVertaxTheme() === 'dark' ? 'light' : 'dark');
}

window.getVertaxTheme = getVertaxTheme;
window.applyVertaxTheme = applyVertaxTheme;
window.toggleVertaxTheme = toggleVertaxTheme;
applyVertaxTheme(getVertaxTheme());

function getTelegramWebApp(){
  return getHostWebApp();
}

function maximizeTelegramWebApp(){
  var tg = getHostWebApp();
  if (!tg) return;
  try { if (typeof tg.ready === 'function') tg.ready(); } catch(_) {}
  try { if (typeof tg.expand === 'function') tg.expand(); } catch(_) {}
  try { if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes(); } catch(_) {}
}

function canTelegramGoBack(){
  if (typeof state === 'undefined') return false;
  return !!state.modal || (state.view && state.view !== 'home');
}

function telegramBack(){
  if (typeof state === 'undefined') return;
  if (state.modal) {
    state.modal = null;
    render();
    return;
  }
  if (typeof handlers !== 'undefined' && handlers && typeof handlers.back === 'function') {
    handlers.back({ preventDefault:function(){}, stopPropagation:function(){} }, { dataset:{ action:'back' } });
    return;
  }
  state.view = 'home';
  render();
}

function syncTelegramChrome(){
  if (document.body && typeof state !== 'undefined') {
    document.body.classList.toggle('vertax-dark', state.view === 'live-set');
  }
  var tg = getHostWebApp();
  if (!tg) return;
  try {
    if (tg.BackButton) {
      if (canTelegramGoBack()) tg.BackButton.show();
      else tg.BackButton.hide();
    }
  } catch(_) {}
}

function installTelegramWebAppChrome(){
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
  } catch(_) {}
  syncTelegramChrome();
}
window.getTelegramWebApp = getTelegramWebApp;
window.getHostWebApp = getHostWebApp;
window.maximizeTelegramWebApp = maximizeTelegramWebApp;

/* ============================================================ *//* GLOBAL EVENT DELEGATION *//* ============================================================ */function getActionTarget(e){ var n = e.target; while (n && n !== document.body) { if (n.dataset && n.dataset.action) return n; n = n.parentNode; } return null; } document.addEventListener('click', function(e){ if (!document.getElementById('laiso-app')) return; if (!e.target.closest || !e.target.closest('#laiso-app')) return; /* Close menus when clicking outside */var clickedMenu = e.target.closest && e.target.closest('.laiso-menu'); if (!clickedMenu) { document.querySelectorAll('#laiso-app .laiso-menu.open').forEach(function(m){ m.classList.remove('open'); }); } var t = getActionTarget(e); if (!t) return; var action = t.dataset.action; var fn = handlers[action]; if (fn) { try { fn(e, t); } catch(err){ console.warn('action error', action, err); showToast('Ошибка: ' + err.message); } } }); document.addEventListener('change', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; var t = getActionTarget(e); if (!t) return; var action = t.dataset.action; var fn = handlers[action]; if (fn) try { fn(e, t); } catch(err){ console.warn('change error', err); } }); document.addEventListener('input', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; /* Live-bind addCatno / addArtist / searchQuery / photoOcrText */var bind = e.target.dataset && e.target.dataset.bind; if (bind) { state.ui[bind] = e.target.value; /* Don't re-render to keep focus */return; } var t = getActionTarget(e); if (!t) return; if (t.dataset.action === 'collection-search' || t.dataset.action === 'bpm-input' || t.dataset.action === 'add-track-search') { var fn = handlers[t.dataset.action]; if (fn) try { fn(e, t); } catch(err){} } }); /* Enter-key submit for free-text search field */document.addEventListener('keydown', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; if (e.key !== 'Enter') return; var action = e.target.dataset && e.target.dataset.action; if (action === 'search-input') { e.preventDefault(); runDiscogsSearch(); } }); /* ============================================================ *//* INIT *//* ============================================================ */async function init(){ try { dbInstance = await dbOpen(); var loadedVinyls = await dbGetAll('vinyls'); var loadedSets = await dbGetAll('sets'); state.collection = loadedVinyls || []; state.sets = loadedSets || []; } catch(e){ console.warn('IndexedDB unavailable, running in volatile mode:', e); } render(); } init(); /* Expose for console debug (optional) */window.laisoBuck = { state: state, render: render };

(function installRuntAndVertaxExtensions(){
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
    installRuntSetTargetNote,
    installRuntLiveSuggestions,
    installRuntDiagnosticsPanel,
    installRuntSourceSelectionPage,
    installRuntBackButtonCopy,
    installRuntSourceEntryButtons,
    installRuntSourceSelectionControls,
    installRuntSourceSelectionHardFix,
    installRuntAscendingTempoMode,
    installVertaxBackupFeature
  ];
  for (var i = 0; i < installers.length; i++) {
    try {
      if (typeof installers[i] === 'function') installers[i]();
    } catch(e) {
      console.warn('extension install failed', installers[i] && installers[i].name, e);
    }
  }
})();

(function installVertaxCompactSetTouchDnd(){
  if (window.__vertaxCompactSetTouchDndInstalled) return;
  window.__vertaxCompactSetTouchDndInstalled = true;
  var drag = null;
  var ghost = null;

  function clearMarks(){
    document.querySelectorAll('#laiso-app .runt-set-card.runt-dragging,#laiso-app .runt-set-card.runt-drag-over').forEach(function(el){
      el.classList.remove('runt-dragging', 'runt-drag-over');
    });
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
  }

  function cardFromEventTarget(target){
    return target && target.closest && target.closest('#laiso-app .runt-set-card[data-set-idx]');
  }

  function moveGhost(x, y){
    if (!ghost) return;
    ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) rotate(-1.5deg)';
  }

  function createGhost(card, x, y){
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

  document.addEventListener('touchstart', function(e){
    if (e.touches && e.touches.length !== 1) return;
    var card = cardFromEventTarget(e.target);
    if (!card) return;
    var idx = parseInt(card.getAttribute('data-set-idx'), 10);
    if (isNaN(idx)) return;

    var start = e.touches[0];
    var sx = start.clientX;
    var sy = start.clientY;
    var timer = setTimeout(function(){
      drag = { from: idx, card: card, lastTo: idx };
      card.classList.add('runt-dragging');
      createGhost(card, sx, sy);
      if (typeof haptic === 'function') haptic('medium');
    }, 280);

    function cancelPress(){
      clearTimeout(timer);
      document.removeEventListener('touchend', cancelPress);
      document.removeEventListener('touchcancel', cancelPress);
      document.removeEventListener('touchmove', maybeScroll);
    }

    function maybeScroll(ev){
      if (drag) return;
      var t = ev.touches && ev.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) cancelPress();
    }

    document.addEventListener('touchend', cancelPress, { once: true });
    document.addEventListener('touchcancel', cancelPress, { once: true });
    document.addEventListener('touchmove', maybeScroll, { passive: true });
  }, { passive: true });

  document.addEventListener('touchmove', function(e){
    if (!drag) return;
    if (e.cancelable) e.preventDefault();
    var t = e.touches && e.touches[0];
    if (!t) return;
    moveGhost(t.clientX, t.clientY);
    var under = document.elementFromPoint(t.clientX, t.clientY);
    var target = cardFromEventTarget(under);
    document.querySelectorAll('#laiso-app .runt-set-card.runt-drag-over').forEach(function(el){
      if (el !== target) el.classList.remove('runt-drag-over');
    });
    if (target && target !== drag.card) {
      target.classList.add('runt-drag-over');
      var to = parseInt(target.getAttribute('data-set-idx'), 10);
      if (!isNaN(to)) drag.lastTo = to;
    }
  }, { passive: false });

  document.addEventListener('touchend', function(){
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

  document.addEventListener('touchcancel', function(){
    clearMarks();
    drag = null;
  });
})();

(function installVertaxTelegramChromeSync(){
  if (window.__vertaxTelegramChromeSyncInstalled) return;
  window.__vertaxTelegramChromeSyncInstalled = true;
  function wrapRenderForTelegramChrome(){
    installTelegramWebAppChrome();
    if (window.laisoBuck && typeof window.laisoBuck.render === 'function' && !window.__vertaxTelegramChromeBuckWrapped) {
      var oldBuckRender = window.laisoBuck.render;
      window.laisoBuck.render = function(){
        oldBuckRender();
        syncTelegramChrome();
      };
      window.__vertaxTelegramChromeBuckWrapped = true;
    }
    try {
      if (typeof render === 'function' && !window.__vertaxTelegramChromeGlobalWrapped) {
        var oldRender = render;
        render = function(){
          oldRender();
          syncTelegramChrome();
        };
        window.__vertaxTelegramChromeGlobalWrapped = true;
      }
    } catch(_) {}
    syncTelegramChrome();
  }
  wrapRenderForTelegramChrome();
  setTimeout(wrapRenderForTelegramChrome, 300);
})();

/* ============================================================
   VERTAX CENTRAL DISPLAY: clock ticker + boot screen typewriter
   ============================================================ */
function getVertaxUserName(){
  try {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && typeof tg.ready === 'function') { try { tg.ready(); } catch(_) {} }
    var user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user && user.first_name) return String(user.first_name).toUpperCase();
    if (user && user.last_name) return String(user.last_name).toUpperCase();
    if (user && user.username) return '@' + String(user.username).toUpperCase();
    var raw = tg && tg.initData;
    if (raw && typeof raw === 'string') {
      try {
        var params = new URLSearchParams(raw);
        var u = params.get('user');
        if (u) {
          var parsed = JSON.parse(decodeURIComponent(u));
          if (parsed && parsed.first_name) return String(parsed.first_name).toUpperCase();
          if (parsed && parsed.username) return '@' + String(parsed.username).toUpperCase();
        }
      } catch(_) {}
    }
    var max = window.WebApp;
    var maxUser = max && max.initDataUnsafe && max.initDataUnsafe.user;
    if (maxUser && maxUser.first_name) return String(maxUser.first_name).toUpperCase();
  } catch(e) {}
  return 'SELECTOR';
}
window.getVertaxUserName = getVertaxUserName;

var __vertaxClockTimer = null;
function vertaxFormatTime(d){
  var hh = String(d.getHours()); if (hh.length < 2) hh = '0' + hh;
  var mm = String(d.getMinutes()); if (mm.length < 2) mm = '0' + mm;
  return hh + '<span class="vertax-display-colon">:</span>' + mm;
}
function startVertaxClockTicker(){
  function tick(){
    var el = document.getElementById('vertax-clock');
    if (el) el.innerHTML = vertaxFormatTime(new Date());
  }
  tick();
  if (__vertaxClockTimer) return;
  __vertaxClockTimer = setInterval(function(){
    var el = document.getElementById('vertax-clock');
    if (!el) return;
    el.innerHTML = vertaxFormatTime(new Date());
  }, 30000);
}

function vertaxStandardDisplayInnerHtml(){
  var n = (typeof state !== 'undefined' && state && state.collection) ? state.collection.length : 0;
  var sets = (typeof state !== 'undefined' && state && state.sets) ? state.sets.length : 0;
  function pad3(x){ var s = String(x || 0); while (s.length < 3) s = '0' + s; return s; }
  return '<div class="vertax-display-top">' +
    '<span class="vertax-display-status"><span class="vertax-display-led"></span>READY</span>' +
    '<span class="vertax-display-clock" id="vertax-clock">--<span class="vertax-display-colon">:</span>--</span>' +
    '</div>' +
    '<div class="vertax-display-title">DIG. PLAY. SHARE.</div>' +
    '<div class="vertax-display-stats">' +
      '<span class="vertax-display-stat"><strong>' + pad3(n) + '</strong><small>RECORDS</small></span>' +
      '<span class="vertax-display-stat"><strong>' + pad3(sets) + '</strong><small>SETS</small></span>' +
      '<span class="vertax-display-stat"><strong>LOCAL</strong><small>DB</small></span>' +
    '</div>';
}

function runVertaxBootSequence(display){
  if (!display || display.dataset.vertaxBoot === 'running') return;
  display.dataset.vertaxBoot = 'running';
  var name = getVertaxUserName();
  var lines = ['BOOTING VERTAX-01...', 'HI, ' + name, 'LOCAL DB ONLINE'];
  display.innerHTML =
    '<div class="vertax-display-top">' +
      '<span class="vertax-display-status"><span class="vertax-display-led"></span>BOOT</span>' +
      '<span class="vertax-display-clock"></span>' +
    '</div>' +
    '<div class="vertax-boot">' +
      '<div class="vertax-boot-line"></div>' +
      '<div class="vertax-boot-line"></div>' +
      '<div class="vertax-boot-line"></div>' +
      '<span class="vertax-boot-caret"></span>' +
    '</div>';
  var lineEls = display.querySelectorAll('.vertax-boot-line');

  function alive(){ return document.contains(display) && display.dataset.vertaxBoot === 'running'; }

  function typeChar(idx, charIdx){
    if (!alive()) return;
    var text = lines[idx];
    var el = lineEls[idx];
    if (!el) return;
    if (charIdx <= text.length) {
      el.textContent = text.slice(0, charIdx);
      var nextDelay = 24 + Math.random() * 14;
      setTimeout(function(){ typeChar(idx, charIdx + 1); }, nextDelay);
    } else {
      setTimeout(function(){
        if (!alive()) return;
        if (idx + 1 < lines.length) typeChar(idx + 1, 0);
        else finish();
      }, 220);
    }
  }
  function finish(){
    if (!alive()) return;
    setTimeout(function(){
      if (!alive()) return;
      display.classList.add('is-boot-fading');
      setTimeout(function(){
        if (!document.contains(display)) return;
        display.classList.remove('is-boot-fading');
        delete display.dataset.vertaxBoot;
        display.innerHTML = vertaxStandardDisplayInnerHtml();
        window.__vertaxBootDone = true;
        startVertaxClockTicker();
      }, 350);
    }, 1000);
  }
  typeChar(0, 0);
}

function vertaxAfterRender(){
  if (typeof state === 'undefined') return;
  if (state.view !== 'home') return;
  var display = document.getElementById('vertax-display');
  if (!display) return;
  if (!window.__vertaxBootStarted) {
    window.__vertaxBootStarted = true;
    runVertaxBootSequence(display);
  }
  if (!display.dataset.vertaxBoot) startVertaxClockTicker();
}
window.vertaxAfterRender = vertaxAfterRender;
window.startVertaxClockTicker = startVertaxClockTicker;
