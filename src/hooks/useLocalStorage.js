import { useState } from 'react';

/**
 * Persists state to localStorage and syncs on read/update.
 * Falls back to initialValue when stored JSON is corrupt or the wrong top-level type.
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
            if (!item) return initialValue;
            const parsed = JSON.parse(item);
            // Guard against wrong top-level types (e.g. object stored where array expected).
            if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue;
            if (
                initialValue !== null &&
                typeof initialValue === 'object' &&
                !Array.isArray(initialValue) &&
                (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
            ) {
                return initialValue;
            }
            return parsed;
        } catch (error) {
            console.warn('Error reading localStorage', key, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        setStoredValue((prev) => {
            try {
                const valueToStore = value instanceof Function ? value(prev) : value;
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
                return valueToStore;
            } catch (error) {
                console.warn('Error setting localStorage', key, error);
                return prev;
            }
        });
    };

    return [storedValue, setValue];
}
