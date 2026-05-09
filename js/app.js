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
  var tg = window.Telegram && window.Telegram.WebApp;
  var h = tg && tg.HapticFeedback;
  if (!h) return;
  try {
    if (type === 'success' || type === 'error' || type === 'warning') h.notificationOccurred(type);
    else h.impactOccurred(type || 'light');
  } catch(_) {}
}
window.haptic = haptic;

function getTelegramWebApp(){
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

function maximizeTelegramWebApp(){
  var tg = getTelegramWebApp();
  if (!tg) return;
  try { if (typeof tg.ready === 'function') tg.ready(); } catch(_) {}
  try { if (typeof tg.expand === 'function') tg.expand(); } catch(_) {}
  try { if (typeof tg.requestFullscreen === 'function') tg.requestFullscreen(); } catch(_) {}
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
  var tg = getTelegramWebApp();
  if (!tg) return;
  try {
    if (tg.BackButton) {
      if (canTelegramGoBack()) tg.BackButton.show();
      else tg.BackButton.hide();
    }
  } catch(_) {}
}

function installTelegramWebAppChrome(){
  var tg = getTelegramWebApp();
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
