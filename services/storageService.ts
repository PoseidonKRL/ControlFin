import { UserProfile, UserData } from '../types';

const PROFILES_DB_KEY = 'controlFin_profiles_db';
const PASSWORDS_DB_KEY = 'controlFin_passwords_db';
const USER_DATA_PREFIX = 'controlFinData_';

// A simple in-memory cache to reduce redundant localStorage reads
const cache = new Map<string, any>();

const readFromStorage = <T>(key: string, defaultValue: T): T => {
    if (cache.has(key)) {
        return cache.get(key) as T;
    }
    try {
        const item = localStorage.getItem(key);
        const data = item ? JSON.parse(item) : defaultValue;
        cache.set(key, data);
        return data;
    } catch (error) {
        console.error(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const writeToStorage = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        cache.set(key, data);
    } catch (error) {
        console.error(`Error writing to localStorage key "${key}":`, error);
    }
};

const removeFromStorage = (key: string): void => {
    localStorage.removeItem(key);
    cache.delete(key);
}

// --- Profile and Password Management ---

export const getAllProfiles = (): { [key: string]: UserProfile } => {
    return readFromStorage<{ [key: string]: UserProfile }>(PROFILES_DB_KEY, {});
};

export const saveAllProfiles = (profiles: { [key: string]: UserProfile }): void => {
    writeToStorage(PROFILES_DB_KEY, profiles);
};

export const getAllPasswords = (): { [key: string]: string } => {
    return readFromStorage<{ [key: string]: string }>(PASSWORDS_DB_KEY, {});
};

export const saveAllPasswords = (passwords: { [key: string]: string }): void => {
    writeToStorage(PASSWORDS_DB_KEY, passwords);
};


// --- User-specific Financial Data ---

export const getUserData = (username: string): UserData | null => {
    // Since this is called once on login, we bypass the cache to ensure freshness
    try {
        const item = localStorage.getItem(`${USER_DATA_PREFIX}${username}`);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error reading user data for "${username}":`, error);
        return null;
    }
};

export const saveUserData = (username: string, data: UserData): void => {
    writeToStorage(`${USER_DATA_PREFIX}${username}`, data);
};

export const removeUserData = (username: string): void => {
    removeFromStorage(`${USER_DATA_PREFIX}${username}`);
}