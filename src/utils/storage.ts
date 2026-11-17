import { FinanceState } from '../types/finance';

const DB_NAME = 'cerebro_financeiro_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'primary';
const LS_BACKUP_KEY = 'cerebro_financeiro_state_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadFinanceState(): Promise<FinanceState | null> {
  // 1. Try IndexedDB first (with timeout safety)
  try {
    const result = await Promise.race<FinanceState | null>([
      (async () => {
        const db = await openDB();
        const res = await new Promise<FinanceState | null>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(STATE_KEY);
          req.onsuccess = () => resolve((req.result as FinanceState) ?? null);
          req.onerror = () => reject(req.error);
        });
        db.close();
        return res;
      })(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (result) return result;
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) return JSON.parse(raw) as FinanceState;
  } catch {
    // Ignore parse error
  }
  return null;
}

export async function saveFinanceState(state: FinanceState): Promise<void> {
  // Always keep synchronous localStorage backup for instant reload reliability
  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors if receipt images are huge
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // localStorage mirror already handled above
  }
}

export async function clearFinanceStorage(): Promise<void> {
  try {
    localStorage.removeItem(LS_BACKUP_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
