/**
 * oSAIL Emission Projector
 * 
 * Projects oSAIL emissions for an LP position based on pool data.
 * LPs earn oSAIL emissions only (not trading fees in ve(4,4)).
 */

/**
 * Project oSAIL emissions for a position
 * @param {number} depositUsd - Position value in USD
 * @param {number} poolTVL - Total pool TVL in USD
 * @param {number} distributedOsail24h - Pool's 24h oSAIL distribution
 * @param {number} timelineDays - Projection timeline
 * @returns {number} - Projected oSAIL tokens earned
 */
export function projectEmissions(depositUsd, poolTVL, distributedOsail24h, timelineDays) {
    if (poolTVL <= 0 || depositUsd <= 0) return 0;

    const share = depositUsd / poolTVL;
    const dailyEmissions = distributedOsail24h * share;

    return dailyEmissions * timelineDays;
}

/**
 * Calculate emission APR from 24h oSAIL data
 * @param {number} distributedOsail24h - 24h oSAIL emissions
 * @param {number} sailPrice - SAIL token price in USD
 * @param {number} poolTVL - Pool TVL in USD
 * @returns {number} - APR as decimal (e.g., 0.25 = 25%)
 */
export function calculateEmissionAPR(distributedOsail24h, sailPrice, poolTVL) {
    if (poolTVL <= 0) return 0;

    const dailyValueUsd = distributedOsail24h * sailPrice;
    const annualizedValue = dailyValueUsd * 365;

    return annualizedValue / poolTVL;
}

/**
 * Get effective value of projected oSAIL based on chosen strategy
 * @param {number} osailAmount - Projected oSAIL tokens
 * @param {number} sailPrice - SAIL price in USD
 * @param {number} lockPct - Percentage to lock (0-1)
 * @returns {object} - Breakdown of value
 */
export function getEmissionValue(osailAmount, sailPrice, lockPct) {
    // Lock: 1:1 SAIL value
    const lockPortion = osailAmount * lockPct;
    const lockValue = lockPortion * sailPrice;

    // Redeem: 50% of SAIL price
    const redeemPortion = osailAmount * (1 - lockPct);
    const redeemValue = redeemPortion * sailPrice * 0.5;

    return {
        lockPortion,
        lockValue,
        redeemPortion,
        redeemValue,
        totalValue: lockValue + redeemValue,
    };
}
