const codebookDbName = "codebook-db";
const codebookDbVersion = 1;
const recordsStoreName = "records";
let codebookDbPromise = null;

function openCodebookDb() {
  if (!codebookDbPromise) {
    codebookDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(codebookDbName, codebookDbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(recordsStoreName)) {
          db.createObjectStore(recordsStoreName, { keyPath: "record_id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB."));
    });
  }
  return codebookDbPromise;
}

function idbGetAllRecords() {
  return openCodebookDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(recordsStoreName, "readonly");
    const request = transaction.objectStore(recordsStoreName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

function idbPutRecord(record) {
  return openCodebookDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(recordsStoreName, "readwrite");
    transaction.objectStore(recordsStoreName).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}

function idbDeleteRecord(recordId) {
  return openCodebookDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(recordsStoreName, "readwrite");
    transaction.objectStore(recordsStoreName).delete(recordId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}

function idbClearRecords() {
  return openCodebookDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(recordsStoreName, "readwrite");
    transaction.objectStore(recordsStoreName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }));
}
