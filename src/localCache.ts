const DB_NAME = '3t-novelgame-local-cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

type CacheEnvelope<T> = {
  key: string;
  value: T;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const withLocalCacheTimeout = async <T>(promise: Promise<T>, ms = 1200): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Local cache timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const openCacheDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      dbPromise = null;
      reject(new Error('IndexedDB open timeout'));
    }, 1200);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      window.clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timeout);
      dbPromise = null;
      reject(request.error || new Error('Unable to open local cache'));
    };
    request.onblocked = () => {
      window.clearTimeout(timeout);
      dbPromise = null;
      reject(new Error('IndexedDB open blocked'));
    };
  });
  return dbPromise;
};

export async function getLocalCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const db = await withLocalCacheTimeout(openCacheDb());
    return await withLocalCacheTimeout(new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CacheEnvelope<T> | undefined) || null);
      request.onerror = () => reject(request.error);
    }));
  } catch {
    return null;
  }
}

export async function setLocalCache<T>(key: string, value: T): Promise<void> {
  try {
    const db = await withLocalCacheTimeout(openCacheDb());
    await withLocalCacheTimeout(new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, value, updatedAt: Date.now() } satisfies CacheEnvelope<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch {
    // Local cache is an optimization; never block app behavior.
  }
}

export async function deleteLocalCache(key: string): Promise<void> {
  try {
    const db = await withLocalCacheTimeout(openCacheDb());
    await withLocalCacheTimeout(new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch {
    // Ignore cache cleanup failures.
  }
}

export async function pruneLocalCache(options?: { maxEntries?: number; maxAgeMs?: number }): Promise<void> {
  try {
    const db = await withLocalCacheTimeout(openCacheDb());
    const maxEntries = Math.max(20, options?.maxEntries ?? 160);
    const maxAgeMs = Math.max(24 * 60 * 60 * 1000, options?.maxAgeMs ?? 45 * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const entries = await withLocalCacheTimeout(new Promise<Array<CacheEnvelope<unknown>>>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    }));
    const sorted = entries
      .filter((entry) => entry?.key)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    const staleKeys = new Set<string>();
    sorted.forEach((entry, index) => {
      const updatedAt = Number(entry.updatedAt || 0);
      if (index >= maxEntries || !updatedAt || now - updatedAt > maxAgeMs) {
        staleKeys.add(entry.key);
      }
    });
    if (staleKeys.size === 0) return;
    await withLocalCacheTimeout(new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      staleKeys.forEach((key) => store.delete(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch {
    // Cache pruning should never block the app.
  }
}

