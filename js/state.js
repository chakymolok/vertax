/* VERTAX-01 / RUNT-01 state, constants, and shared utilities. */

/* ============================================================ */ /* CONSTANTS */ /* ============================================================ */ var ACOUSTICBRAINZ_BASE =
  'https://acousticbrainz.org/api/v1';
var MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2';
var BPM_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/* 30 days */ var FETCH_DELAY_MS = 350;
/* between tracks */ var SET_LENGTH = 8;
var SESSION_LIMIT = 30;
/* 24 keys in canonical order: A minor, A# minor, ... C major, C# major, ... */ var KEY_TO_CAMELOT =
  {
    'A minor': '8A',
    'A# minor': '3A',
    'B minor': '10A',
    'C minor': '5A',
    'C# minor': '12A',
    'D minor': '7A',
    'D# minor': '2A',
    'E minor': '9A',
    'F minor': '4A',
    'F# minor': '11A',
    'G minor': '6A',
    'G# minor': '1A',
    'A major': '11B',
    'A# major': '6B',
    'B major': '1B',
    'C major': '8B',
    'C# major': '3B',
    'D major': '10B',
    'D# major': '5B',
    'E major': '12B',
    'F major': '7B',
    'F# major': '2B',
    'G major': '9B',
    'G# major': '4B',
  };
/* Aliases with flat symbols → canonical (#) name */ var KEY_ALIAS = {
  'A♭ minor': 'G# minor',
  'B♭ minor': 'A# minor',
  'D♭ minor': 'C# minor',
  'E♭ minor': 'D# minor',
  'G♭ minor': 'F# minor',
  'A♭ major': 'G# major',
  'B♭ major': 'A# major',
  'D♭ major': 'C# major',
  'E♭ major': 'D# major',
  'G♭ major': 'F# major',
};
var ALL_KEYS = Object.keys(KEY_TO_CAMELOT);
var CAMELOT_TO_KEY = {};
ALL_KEYS.forEach(function (k) {
  CAMELOT_TO_KEY[KEY_TO_CAMELOT[k]] = k;
});

/* ============================================================ */ /* STATE */ /* ============================================================ */ var state =
  {
    view: 'home',
    /* home | add | match | tracklist | edit-track | set | collection | about | fetching */ modal:
      null,
    /* null | 'add-vinyl' | 'manual-edit' | 'about' | 'help' | 'confirm-clear' | 'manual-vinyl' */ toast:
      null,
    vinyls: [],
    /* current session vinyls (list of vinyl objects) */ collection: [],
    /* saved vinyls */ sets: [],
    /* saved sets */ ui: {
      currentVinylId: null,
      currentTrackId: null,
      currentSetId: null,
      candidates: [],
      /* discogs candidates for match screen */ activeSide: 'A',
      setMode: 'best-flow',
      setOptions: { tempoRange: 4, targetCamelot: null, energyShape: 'smooth', camelotSet: {} },
      generatedSet: [],
      collectionSort: 'recent',
      /* recent | title | bpm-asc | bpm-desc | camelot | vinyl */ setOpenDataPanel: false,
      setLastWarning: null,
      /* free-text search (VERTAX-01 main flow) */ searchQuery: '',
      searchResults: [],
      searchLoading: false,
      searchError: null,
      collectionFilter: '',
      previousView: 'home',
      manualVinyl: null,
      discogsImportUsername: '',
      discogsImportLoading: false,
      discogsImportLoaded: false,
      discogsImportProgress: 0,
      discogsImportVinyls: [],
      discogsImportFetchTracks: false,
      discogsImportFetchMeta: false,
      discogsImportEnrichStage: null,
      /* null | 'tracks' | 'meta' */ discogsImportEnrichDone: 0,
      discogsImportEnrichTotal: 0,
      discogsImportEnrichCancel: false,
      fetchProgress: {
        items: [],
        doneCount: 0,
        total: 0,
        cancelled: false,
        complete: false,
        vinylId: null,
      },
      fitCheckQuery: '',
      fitCheckLoading: false,
      fitCheckError: null,
      fitCheckHash: null,
      fitCheckCandidates: [],
      fitCheckResult: null,
      fitCheckManual: {},
      fitCheckAiLoading: false,
      fitCheckAiError: null,
      fitCheckAiVerdict: null,
    },
  };

/* ============================================================ */ /* UTILITIES */ /* ============================================================ */ function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function showToast(msg, ms) {
  state.toast = msg;
  try {
    var lo = String(msg || '').toLowerCase();
    var ht = null;
    if (/(не удалось|ошибка|некоррект|не найдена)/.test(lo)) ht = 'error';
    else if (/(недостаточно|сначала|лимит|пропущен|прерв)/.test(lo)) ht = 'warning';
    else if (
      /(сохранён|сохранен|готово|импортирован|экспортирован|стёрты|стерты|добавлен)/.test(lo)
    )
      ht = 'success';
    if (ht && typeof haptic === 'function') haptic(ht);
  } catch (_) {}
  render();
  if (state._toastT) clearTimeout(state._toastT);
  state._toastT = setTimeout(function () {
    state.toast = null;
    render();
  }, ms || 2600);
}
function parsePos(pos) {
  if (!pos) return { side: 'A', num: 0, raw: '' };
  var m = String(pos)
    .toUpperCase()
    .match(/^([A-F]{1,2})(\d*)/);
  if (!m) return { side: 'A', num: 0, raw: String(pos) };
  return { side: m[1].charAt(0), num: parseInt(m[2] || '0', 10), raw: String(pos).toUpperCase() };
}
/* For DJ-style display: "A" → "A1" if it's the first track on the side and the rest also lack numbers. */ /* Returns "A1" / "B2" / etc. Always at least Side+Number. */ function displayPosition(
  track,
  vinyl
) {
  var p = parsePos(track && track.position);
  if (p.num > 0) return p.side + p.num;
  if (!vinyl || !vinyl.tracklist) return p.side + '1';
  /* Compute index on this side among siblings whose position starts with same side letter */ var side =
    p.side;
  var idx = 0;
  var found = -1;
  for (var i = 0; i < vinyl.tracklist.length; i++) {
    var t = vinyl.tracklist[i];
    var tp = parsePos(t.position);
    if (tp.side === side) {
      idx++;
      if (t.id === track.id) {
        found = idx;
        break;
      }
    }
  }
  return side + (found > 0 ? found : 1);
}
function normalizeKey(k) {
  if (!k) return null;
  if (KEY_TO_CAMELOT[k]) return k;
  if (KEY_ALIAS[k]) return KEY_ALIAS[k];
  return null;
}
function findVinyl(id) {
  return (
    state.vinyls.find(function (v) {
      return v.id === id;
    }) ||
    state.collection.find(function (v) {
      return v.id === id;
    }) ||
    null
  );
}
function findTrack(vinyl, trackId) {
  if (!vinyl || !vinyl.tracklist) return null;
  return (
    vinyl.tracklist.find(function (t) {
      return t.id === trackId;
    }) || null
  );
}
