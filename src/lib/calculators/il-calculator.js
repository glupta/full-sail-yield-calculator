/**
 * Impermanent Loss Calculator for Concentrated Liquidity (Uniswap v3 style)
 * 
 * Uses the concentrated IL formula:
 * IL = 2 * sqrt(P1/P0) / (1 + P1/P0) - 1
 */

/**
 * Calculate impermanent loss for a concentrated liquidity position
 * @param {number} P0 - Initial price
 * @param {number} P1 - Final price  
 * @returns {number} - IL as a decimal (negative = loss, e.g., -0.05 = 5% loss)
 */
export function calculateIL(P0, P1) {
    if (P0 <= 0 || P1 <= 0) return 0;

    const ratio = P1 / P0;
    const sqrtRatio = Math.sqrt(ratio);

    // IL = 2 * sqrt(P1/P0) / (1 + P1/P0) - 1
    const il = (2 * sqrtRatio) / (1 + ratio) - 1;

    return il;
}

/**
 * Estimate IL based on volatility and time
 * Uses simplified model: expected price change = volatility * sqrt(time)
 * @param {number} annualizedVolatility - Annualized volatility (e.g., 0.8 = 80%)
 * @param {number} timelineDays - Time horizon in days
 * @returns {object} - Expected IL scenarios { optimistic, expected, pessimistic }
 */
export function estimateILFromVolatility(annualizedVolatility, timelineDays) {
    // Scale volatility to the time period
    const timeScale = Math.sqrt(timelineDays / 365);
    const scaledVol = annualizedVolatility * timeScale;

    // Estimate price changes at different confidence levels
    // Using simplified normal distribution assumptions
    const scenarios = {
        optimistic: 1 + scaledVol * 0.5,    // 0.5 std dev move
        expected: 1 + scaledVol * 1.0,       // 1 std dev move
        pessimistic: 1 + scaledVol * 2.0,    // 2 std dev move
    };

    return {
        optimistic: calculateIL(1, scenarios.optimistic),
        expected: calculateIL(1, scenarios.expected),
        pessimistic: calculateIL(1, scenarios.pessimistic),
        priceChanges: scenarios,
    };
}

/**
 * Calculate dollar value of IL
 * @param {number} depositUsd - Initial deposit in USD
 * @param {number} ilPercent - IL as decimal (e.g., -0.05)
 * @returns {number} - Dollar loss (positive number)
 */
export function calculateILDollarValue(depositUsd, ilPercent) {
    // IL is already negative, so this returns a positive loss value
    return Math.abs(ilPercent) * depositUsd;
}
