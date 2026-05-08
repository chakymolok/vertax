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

/* ============================================================ *//* GLOBAL EVENT DELEGATION *//* ============================================================ */function getActionTarget(e){ var n = e.target; while (n && n !== document.body) { if (n.dataset && n.dataset.action) return n; n = n.parentNode; } return null; } document.addEventListener('click', function(e){ if (!document.getElementById('laiso-app')) return; if (!e.target.closest || !e.target.closest('#laiso-app')) return; /* Close menus when clicking outside */var clickedMenu = e.target.closest && e.target.closest('.laiso-menu'); if (!clickedMenu) { document.querySelectorAll('#laiso-app .laiso-menu.open').forEach(function(m){ m.classList.remove('open'); }); } var t = getActionTarget(e); if (!t) return; var action = t.dataset.action; var fn = handlers[action]; if (fn) { try { fn(e, t); } catch(err){ console.warn('action error', action, err); showToast('Ошибка: ' + err.message); } } }); document.addEventListener('change', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; var t = getActionTarget(e); if (!t) return; var action = t.dataset.action; var fn = handlers[action]; if (fn) try { fn(e, t); } catch(err){ console.warn('change error', err); } }); document.addEventListener('input', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; /* Live-bind addCatno / addArtist / searchQuery / photoOcrText */var bind = e.target.dataset && e.target.dataset.bind; if (bind) { state.ui[bind] = e.target.value; /* Don't re-render to keep focus */return; } var t = getActionTarget(e); if (!t) return; if (t.dataset.action === 'collection-search' || t.dataset.action === 'bpm-input') { var fn = handlers[t.dataset.action]; if (fn) try { fn(e, t); } catch(err){} } }); /* Enter-key submit for free-text search field */document.addEventListener('keydown', function(e){ if (!e.target.closest || !e.target.closest('#laiso-app')) return; if (e.key !== 'Enter') return; var action = e.target.dataset && e.target.dataset.action; if (action === 'search-input') { e.preventDefault(); runDiscogsSearch(); } }); /* ============================================================ *//* INIT *//* ============================================================ */async function init(){ try { dbInstance = await dbOpen(); var loadedVinyls = await dbGetAll('vinyls'); var loadedSets = await dbGetAll('sets'); state.collection = loadedVinyls || []; state.sets = loadedSets || []; } catch(e){ console.warn('IndexedDB unavailable, running in volatile mode:', e); } render(); } init(); /* Expose for console debug (optional) */window.laisoBuck = { state: state, render: render };

(function installRuntAndVertaxExtensions(){
  if (window.__runtAndVertaxExtensionsInstalled) return;
  window.__runtAndVertaxExtensionsInstalled = true;
  var installers = [
    installRuntHomeView,
    installRuntPhysicalRecordKeys,
    installRuntFetchingMetadataFlow,
    installRuntBpmX2LiveToggle,
    installRuntSetManualMetaControls,
    installRuntSetDndAndAddTrackModal,
    installRuntCompactSetCards,
    installRuntManualMetadataHandlers,
    installRuntDuplicateTrackGuard,
    installRuntTrackPositionHelpers,
    installRuntFetchingManualPanel,
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
    installRuntSourceToolsHidden,
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
