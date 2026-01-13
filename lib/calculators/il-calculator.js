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
 * Calculate IL for a concentrated liquidity position using actual position value math.
 * 
 * This uses the Uniswap v3 concentrated liquidity formulas to calculate:
 * 1. Initial token amounts at P0 within range [Pa, Pb]
 * 2. Final token amounts at P1
 * 3. LP value vs HODL value comparison
 * 
 * @param {number} P0 - Initial price (entry price)
 * @param {number} P1 - Final price (exit price)
 * @param {number} Pa - Lower bound of price range
 * @param {number} Pb - Upper bound of price range
 * @returns {number} - IL as a decimal (negative = loss, e.g., -0.05 = 5% loss)
 */
export function calculateConcentratedIL(P0, P1, Pa, Pb) {
    // Validate inputs
    if (P0 <= 0 || P1 <= 0 || Pa <= 0 || Pb <= 0) return 0;
    if (Pa >= Pb) return 0;

    // If P0 is outside range, position starts as 100% one token
    // This is an edge case - normally you enter at a price within range
    if (P0 <= Pa || P0 >= Pb) {
        // Fall back to standard IL formula
        return calculateIL(P0, P1);
    }

    // Calculate sqrt prices for easier math
    const sqrtP0 = Math.sqrt(P0);
    const sqrtP1 = Math.sqrt(P1);
    const sqrtPa = Math.sqrt(Pa);
    const sqrtPb = Math.sqrt(Pb);

    // For a concentrated position, we use virtual liquidity L
    // At P0, we have a 50/50 value split. We can normalize L = 1 and calculate relative values.
    // 
    // Token amounts in range [Pa, Pb] at price P:
    // x (token0) = L * (1/sqrt(P) - 1/sqrt(Pb))  when Pa < P < Pb
    // y (token1) = L * (sqrt(P) - sqrt(Pa))      when Pa < P < Pb
    //
    // When P >= Pb: x = 0, y = L * (sqrt(Pb) - sqrt(Pa))
    // When P <= Pa: x = L * (1/sqrt(Pa) - 1/sqrt(Pb)), y = 0

    // Calculate initial token amounts at P0 (assumed in range)
    const x0 = (1 / sqrtP0) - (1 / sqrtPb);
    const y0 = sqrtP0 - sqrtPa;

    // Calculate initial value (for normalization reference)
    const V0 = x0 * P0 + y0;

    if (V0 <= 0) return 0; // Edge case safety

    // Calculate final token amounts at P1
    let x1, y1;

    if (P1 <= Pa) {
        // Price below range: 100% token0
        x1 = (1 / sqrtPa) - (1 / sqrtPb);
        y1 = 0;
    } else if (P1 >= Pb) {
        // Price above range: 100% token1
        x1 = 0;
        y1 = sqrtPb - sqrtPa;
    } else {
        // Price in range: mixed position
        x1 = (1 / sqrtP1) - (1 / sqrtPb);
        y1 = sqrtP1 - sqrtPa;
    }

    // Calculate LP value at P1
    const LP_Value = x1 * P1 + y1;

    // Calculate HODL value at P1 (what initial assets would be worth)
    const HODL_Value = x0 * P1 + y0;

    if (HODL_Value <= 0) return 0; // Edge case safety

    // IL = (LP_Value / HODL_Value) - 1
    // Negative means LP value is less than HODL (impermanent loss)
    const il = (LP_Value / HODL_Value) - 1;

    return il;
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
