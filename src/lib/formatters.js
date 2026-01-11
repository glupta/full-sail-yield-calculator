/**
 * Formatting utilities for display
 */

/**
 * Round to reasonable significant figures for clean display
 * @param {number} num - Number to round
 * @param {number} sigFigs - Number of significant figures (default: 4)
 * @returns {number} - Rounded number
 */
export function roundToSigFigs(num, sigFigs = 4) {
    if (num === 0 || !Number.isFinite(num)) return 0;
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, sigFigs - 1 - magnitude);
    return Math.round(num * scale) / scale;
}

/**
 * Format a number as USD currency
 * @param {number} val - Value to format
 * @returns {string} - Formatted USD string
 */
export function formatUsd(val) {
    if (!Number.isFinite(val)) return '$0.00';
    return `$${val.toFixed(2)}`;
}

/**
 * Format a price value with appropriate precision
 * Uses sig figs for small numbers, 2 decimals for larger numbers
 * @param {number} price - Price to format
 * @returns {string} - Formatted price
 */
export function formatPrice(price) {
    if (!Number.isFinite(price) || price === 0) return '0';
    if (price < 0.01) return roundToSigFigs(price, 4).toString();
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(0);
}
