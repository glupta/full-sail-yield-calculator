/**
 * Leverage & Estimated APR Calculator
 * Calculates concentration leverage for CLMM positions based on price range
 */

/**
 * Calculate leverage factor from price range
 * Narrower range = higher leverage = higher estimated APR
 * 
 * Formula: L = 1 / (sqrt(Pl/Pc) - sqrt(Ph/Pc) + 1)
 * Where Pl = low price, Ph = high price, Pc = current price
 * 
 * @param {number} currentPrice - Current pool price
 * @param {number} priceLow - Lower bound of price range
 * @param {number} priceHigh - Upper bound of price range
 * @returns {number} - Leverage factor (1x = full range, higher = more concentrated)
 */
export function calculateLeverage(currentPrice, priceLow, priceHigh) {
    if (!currentPrice || currentPrice <= 0) return 1;
    if (!priceLow || !priceHigh) return 1;
    if (priceLow <= 0 || priceHigh <= 0) return 1;
    if (priceLow >= priceHigh) return 1;

    // If current price is outside the range, leverage calculation differs
    if (currentPrice <= priceLow || currentPrice >= priceHigh) {
        // Position is out of range - calculate based on full range width
        const rangeRatio = priceHigh / priceLow;
        return 1 / (Math.sqrt(rangeRatio) - 1);
    }

    // Standard concentrated liquidity leverage formula
    const sqrtLow = Math.sqrt(priceLow / currentPrice);
    const sqrtHigh = Math.sqrt(priceHigh / currentPrice);

    // Leverage = 1 / (sqrtHigh - sqrtLow)
    // This gives higher leverage for tighter ranges
    const leverage = 1 / (sqrtHigh - sqrtLow);

    return Math.max(1, leverage);
}

/**
 * Calculate estimated APR based on concentration leverage
 * EstimatedAPR = BaseAPR × Leverage
 * 
 * @param {number} baseAPR - Pool's base full-range APR (as percentage, e.g. 5.2)
 * @param {number} leverage - Leverage factor from calculateLeverage()
 * @returns {number} - Estimated APR as percentage
 */
export function calculateEstimatedAPR(baseAPR, leverage) {
    if (!baseAPR || baseAPR <= 0) return 0;
    if (!leverage || leverage <= 0) return baseAPR;

    return baseAPR * leverage;
}

/**
 * Full Sail assumes pool.full_apr is reported at ±10% concentration (~20x leverage).
 * This constant represents that baseline leverage.
 */
const BASELINE_LEVERAGE = 20; // ±10% range gives ~20x leverage

/**
 * Derive the true Base APR (full-range, 1x leverage) from the pool's reported full_apr.
 * Full Sail's full_apr appears to be calculated assuming ±10% concentration.
 * 
 * BaseAPR = PoolAPR / BaselineLeverage
 * 
 * @param {number} poolAPR - Pool's reported full_apr (percentage)
 * @returns {number} - Base APR at 1x leverage (full range)
 */
export function deriveBaseAPR(poolAPR) {
    if (!poolAPR || poolAPR <= 0) return 0;
    return poolAPR / BASELINE_LEVERAGE;
}

/**
 * Calculate leverage and estimated APR from pool's reported APR and price range.
 * This derives the base APR from pool.full_apr (assuming ±10% baseline),
 * then applies the user's chosen concentration leverage.
 * 
 * @param {number} poolAPR - Pool's reported full_apr (percentage, e.g., 52%)
 * @param {number} currentPrice - Current pool price
 * @param {number} priceLow - Lower price bound
 * @param {number} priceHigh - Upper price bound
 * @returns {object} - { leverage, estimatedAPR, baseAPR }
 */
export function calculateRangeAPR(poolAPR, currentPrice, priceLow, priceHigh) {
    // Derive base APR (1x leverage) from the pool's reported APR
    const baseAPR = deriveBaseAPR(poolAPR);

    // Calculate leverage for user's chosen range
    const leverage = calculateLeverage(currentPrice, priceLow, priceHigh);

    // Estimated APR = Base APR × User's Leverage
    const estimatedAPR = calculateEstimatedAPR(baseAPR, leverage);

    return {
        leverage,
        estimatedAPR,
        baseAPR,
        isConcentrated: leverage > 1,
    };
}

/**
 * Get price range from percentage deviation around current price
 * Useful for preset buttons like "±10%", "±1%"
 * 
 * @param {number} currentPrice - Current pool price
 * @param {number} lowerPct - Lower bound deviation (e.g., -10 for -10%)
 * @param {number} upperPct - Upper bound deviation (e.g., 10 for +10%)
 * @returns {object} - { priceLow, priceHigh }
 */
export function getPriceRangeFromPercent(currentPrice, lowerPct, upperPct) {
    if (!currentPrice || currentPrice <= 0) return { priceLow: 0, priceHigh: 0 };

    const priceLow = currentPrice * (1 + lowerPct / 100);
    const priceHigh = currentPrice * (1 + upperPct / 100);

    return {
        priceLow: Math.max(0, priceLow),
        priceHigh,
    };
}

/**
 * Preset range configurations - Meteora-style labels with percentages
 * Ordered from widest (lowest risk) to narrowest (highest risk)
 */
export const RANGE_PRESETS = [
    { label: 'Full', sublabel: '(0, ∞)', lowerPct: -99, upperPct: 10000, description: 'Full range, 1x leverage' },
    { label: 'Wide', sublabel: '(-50%, +100%)', lowerPct: -50, upperPct: 100, description: 'Low risk, ~1.5x leverage' },
    { label: 'Balanced', sublabel: '(-25%, +33%)', lowerPct: -25, upperPct: 33, description: 'Medium risk, ~4x leverage' },
    { label: 'Narrow', sublabel: '(±10%)', lowerPct: -10, upperPct: 10, description: 'Higher risk, ~10x leverage' },
    { label: 'Spot', sublabel: '(±2%)', lowerPct: -2, upperPct: 2, description: 'Highest risk, ~50x leverage' },
];

/**
 * Preset range configurations for stablecoin pools
 * Much tighter ranges since stable pairs have minimal price deviation
 */
export const STABLE_RANGE_PRESETS = [
    { label: 'Wide', sublabel: '(±2%)', lowerPct: -2, upperPct: 2, description: 'Safe stable range, ~50x leverage' },
    { label: 'Balanced', sublabel: '(±1%)', lowerPct: -1, upperPct: 1, description: 'Standard stable, ~100x leverage' },
    { label: 'Narrow', sublabel: '(±0.5%)', lowerPct: -0.5, upperPct: 0.5, description: 'Tight stable, ~200x leverage' },
    { label: 'Spot', sublabel: '(±0.1%)', lowerPct: -0.1, upperPct: 0.1, description: 'Very tight, ~1000x leverage' },
];

/**
 * Detect if a pool is a stablecoin pool based on token names
 * @param {object} pool - Pool object with token0_symbol and token1_symbol
 * @returns {boolean} - True if pool contains stablecoins on both sides
 */
export function isStablePool(pool) {
    if (!pool) return false;

    const stableTokens = ['USDC', 'USDT', 'DAI', 'USDY', 'AUSD', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'SUSD'];
    const token0 = (pool.token0_symbol || '').toUpperCase();
    const token1 = (pool.token1_symbol || '').toUpperCase();

    // Check if both tokens are stablecoins
    const token0IsStable = stableTokens.some(s => token0.includes(s));
    const token1IsStable = stableTokens.some(s => token1.includes(s));

    return token0IsStable && token1IsStable;
}
