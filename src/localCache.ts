const DB_NAME = '3t-novelgame-local-cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

type CacheEnvelope<T> = {
  key: string;
  value: T;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openCacheDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open local cache'));
  });
  return dbPromise;
};

export async function getLocalCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CacheEnvelope<T> | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function setLocalCache<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, value, updatedAt: Date.now() } satisfies CacheEnvelope<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Local cache is an optimization; never block app behavior.
  }
}

export async function deleteLocalCache(key: string): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}

