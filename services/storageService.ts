import { UserProfile, UserData } from '../types';

const DB_NAME = 'ControlFinDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// --- IndexedDB Helper ---
let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                console.error('IndexedDB is not supported in this browser.');
                reject('IndexedDB not supported');
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject('IndexedDB error');
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }
    return dbPromise;
};

const dbGet = async <T>(key: string): Promise<T | undefined> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.value);
    });
};

const dbSet = async (key: string, value: any): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ key, value });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

const dbDelete = async (key: string): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};


// --- Service Logic using IndexedDB ---

const PROFILES_DB_KEY = 'controlFin_profiles_db';
const PASSWORDS_DB_KEY = 'controlFin_passwords_db';
const USER_DATA_PREFIX = 'controlFinData_';

const readFromDb = async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
        const data = await dbGet<T>(key);
        return data !== undefined ? data : defaultValue;
    } catch (error) {
        console.error(`Error reading from IndexedDB key "${key}":`, error);
        return defaultValue;
    }
};

const writeToDb = async <T>(key: string, data: T): Promise<void> => {
    try {
        await dbSet(key, data);
    } catch (error) {
        console.error(`Error writing to IndexedDB key "${key}":`, error);
    }
};

const removeFromDb = async (key: string): Promise<void> => {
    try {
        await dbDelete(key);
    } catch (error) {
        console.error(`Error deleting from IndexedDB key "${key}":`, error);
    }
};

// --- Profile and Password Management (ASYNC) ---

export const getAllProfiles = async (): Promise<{ [key: string]: UserProfile }> => {
    return readFromDb<{ [key: string]: UserProfile }>(PROFILES_DB_KEY, {});
};

export const saveAllProfiles = async (profiles: { [key: string]: UserProfile }): Promise<void> => {
    await writeToDb(PROFILES_DB_KEY, profiles);
};

export const getAllPasswords = async (): Promise<{ [key: string]: string }> => {
    return readFromDb<{ [key: string]: string }>(PASSWORDS_DB_KEY, {});
};

export const saveAllPasswords = async (passwords: { [key: string]: string }): Promise<void> => {
    await writeToDb(PASSWORDS_DB_KEY, passwords);
};


// --- User-specific Financial Data (ASYNC) ---

export const getUserData = async (username: string): Promise<UserData | null> => {
    return await readFromDb<UserData | null>(`${USER_DATA_PREFIX}${username}`, null);
};

export const saveUserData = async (username: string, data: UserData): Promise<void> => {
    await writeToDb(`${USER_DATA_PREFIX}${username}`, data);
};

export const removeUserData = async (username: string): Promise<void> => {
    await removeFromDb(`${USER_DATA_PREFIX}${username}`);
}