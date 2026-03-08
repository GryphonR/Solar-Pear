import { useState } from 'react';

/**
 * Persists state to localStorage and syncs on read/update.
 * @param {string} key - localStorage key
 * @param {*} initialValue - value when key is missing or invalid
 * @returns {[*, function]} [storedValue, setValue] - same API as useState
 */
export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn('Error reading localStorage', key, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn('Error setting localStorage', key, error);
        }
    };

    return [storedValue, setValue];
}
