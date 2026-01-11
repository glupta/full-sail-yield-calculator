/**
 * oSAIL Strategy Calculator
 * 
 * Calculates value from different oSAIL strategies:
 * - Lock: Convert to veSAIL at 1:1 SAIL value
 * - Redeem: Convert to USDC at 50% SAIL spot price
 */

/**
 * Calculate total value from oSAIL strategy
 * @param {number} osailAmount - Amount of oSAIL tokens
 * @param {number} sailPrice - SAIL token price in USD
 * @param {number} lockPct - Percentage to lock (0-1, e.g., 0.7 = 70% lock)
 * @returns {object} - Strategy breakdown
 */
export function calculateStrategyValue(osailAmount, sailPrice, lockPct) {
    const redeemPct = 1 - lockPct;

    // Lock portion: 1:1 SAIL value (effectively 2x vs redeem)
    const lockAmount = osailAmount * lockPct;
    const lockValue = lockAmount * sailPrice;

    // Redeem portion: 50% of SAIL price
    const redeemAmount = osailAmount * redeemPct;
    const redeemValue = redeemAmount * sailPrice * 0.5;

    const totalValue = lockValue + redeemValue;

    // Calculate the multiplier vs. 100% redeem baseline
    const baselineRedeemAll = osailAmount * sailPrice * 0.5;
    const valueMultiplier = baselineRedeemAll > 0 ? totalValue / baselineRedeemAll : 1;

    return {
        lockAmount,
        lockValue,
        lockValuePct: lockPct,
        redeemAmount,
        redeemValue,
        redeemValuePct: redeemPct,
        totalValue,
        valueMultiplier,
    };
}

/**
 * Compare two strategies
 * @param {object} strategy1 - First strategy result
 * @param {object} strategy2 - Second strategy result
 * @returns {object} - Comparison metrics
 */
export function compareStrategies(strategy1, strategy2) {
    const valueDiff = strategy1.totalValue - strategy2.totalValue;
    const percentDiff = strategy2.totalValue > 0
        ? (valueDiff / strategy2.totalValue) * 100
        : 0;

    return {
        valueDiff,
        percentDiff,
        winner: valueDiff > 0 ? 1 : valueDiff < 0 ? 2 : 0,
    };
}

/**
 * Preset strategies for quick selection
 */
export const STRATEGY_PRESETS = {
    LOCK_ALL: { name: '100% Lock', lockPct: 1.0 },
    REDEEM_ALL: { name: '100% Redeem', lockPct: 0 },
    BALANCED: { name: '50/50', lockPct: 0.5 },
    MOSTLY_LOCK: { name: '70% Lock', lockPct: 0.7 },
};
