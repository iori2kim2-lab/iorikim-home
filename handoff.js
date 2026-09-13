// Shared helper for passing one image (as a real Blob, no size cap worth
// worrying about) from one tool page to another via a full navigation.
// sessionStorage tops out around 5-10MB and can't hold a Blob directly, so
// this uses IndexedDB instead.
window.IorikimHandoff = (function () {
  var DB_NAME = "iorikim-handoff";
  var STORE_NAME = "items";
  var KEY = "pending";

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function save(blob, name) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ blob: blob, name: name }, KEY);
        tx.oncomplete = function () {
          db.close();
          resolve();
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  function load() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        var store = tx.objectStore(STORE_NAME);
        var getReq = store.get(KEY);
        var result = null;
        getReq.onsuccess = function () {
          result = getReq.result || null;
          store.delete(KEY);
        };
        tx.oncomplete = function () {
          db.close();
          resolve(result);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  return { save: save, load: load };
})();
