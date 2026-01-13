/**
 * localStorage persistence utilities
 * DISABLED - always returns fresh state
 */

const STORAGE_PREFIX = 'fullsail_calc_';

/**
 * Save inputs to localStorage - DISABLED
 * @param {string} key - Storage key (will be prefixed)
 * @param {object} data - Data to save
 */
export function saveInputs(key, data) {
    // DISABLED - no persistence
}

/**
 * Load inputs from localStorage - DISABLED, always returns null
 * @param {string} key - Storage key (will be prefixed)
 * @returns {object|null} - Always null (fresh state)
 */
export function loadInputs(key) {
    return null; // Always return fresh state
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

// Clear on load to remove any stale data
clearInputs();
