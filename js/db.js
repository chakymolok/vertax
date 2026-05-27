/* VERTAX-01 / RUNT-01 IndexedDB and persistence helpers. */

/* ============================================================ */ /* INDEXED DB */ /* ============================================================ */ var DB_NAME =
  'laiso-buck-db';
var DB_VERSION = 2;
var dbInstance = null;
function dbOpen() {
  return new Promise(function (resolve, reject) {
    try {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('vinyls'))
          db.createObjectStore('vinyls', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('bpm_cache'))
          db.createObjectStore('bpm_cache', { keyPath: 'cacheKey' });
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    } catch (e) {
      reject(e);
    }
  });
}
function dbPut(store, value) {
  return new Promise(function (res, rej) {
    try {
      var r = dbInstance.transaction(store, 'readwrite').objectStore(store).put(value);
      r.onsuccess = function () {
        res(value);
      };
      r.onerror = function () {
        rej(r.error);
      };
    } catch (e) {
      rej(e);
    }
  });
}
function dbGetAll(store) {
  return new Promise(function (res, rej) {
    try {
      var r = dbInstance.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = function () {
        res(r.result || []);
      };
      r.onerror = function () {
        rej(r.error);
      };
    } catch (e) {
      rej(e);
    }
  });
}
function dbDelete(store, id) {
  return new Promise(function (res, rej) {
    try {
      var r = dbInstance.transaction(store, 'readwrite').objectStore(store).delete(id);
      r.onsuccess = function () {
        res();
      };
      r.onerror = function () {
        rej(r.error);
      };
    } catch (e) {
      rej(e);
    }
  });
}
function dbClear(store) {
  return new Promise(function (res, rej) {
    try {
      var r = dbInstance.transaction(store, 'readwrite').objectStore(store).clear();
      r.onsuccess = function () {
        res();
      };
      r.onerror = function () {
        rej(r.error);
      };
    } catch (e) {
      rej(e);
    }
  });
}

/* ============================================================ */ /* PERSISTENCE HELPERS */ /* ============================================================ */ async function persistVinyl(
  v
) {
  try {
    await dbPut('vinyls', v);
  } catch (e) {
    console.warn('persistVinyl error', e);
    if (e && e.name === 'QuotaExceededError')
      showToast('Локальное хранилище переполнено. Экспортируй коллекцию и очисти данные.', 5000);
  }
}
async function deleteVinylFromDb(id) {
  try {
    await dbDelete('vinyls', id);
  } catch (e) {}
}
async function persistSet(s) {
  try {
    await dbPut('sets', s);
  } catch (e) {}
}
async function deleteSetFromDb(id) {
  try {
    await dbDelete('sets', id);
  } catch (e) {}
}
