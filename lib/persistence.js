/**
 * localStorage persistence utilities
 */

const STORAGE_PREFIX = 'fullsail_calc_';

/**
 * Save inputs to localStorage
 * @param {string} key - Storage key (will be prefixed)
 * @param {object} data - Data to save
 */
export function saveInputs(key, data) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

/**
 * Load inputs from localStorage
 * @param {string} key - Storage key (will be prefixed)
 * @returns {object|null} - Saved data or null
 */
export function loadInputs(key) {
    try {
        const saved = localStorage.getItem(STORAGE_PREFIX + key);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
        return null;
    }
}

/**
 * Clear all saved inputs
 */
export function clearInputs() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(STORAGE_PREFIX))
            .forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.warn('Failed to clear localStorage:', e);
    }
}
