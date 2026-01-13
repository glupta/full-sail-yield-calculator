/**
 * Scenario Result Calculator
 * Centralized calculation logic for scenario yields
 */

import { calculateIL, calculateConcentratedIL, estimateILFromVolatility, calculateILDollarValue } from './calculators/il-calculator';
import { projectEmissions, getEmissionValue, calculateEmissionAPR } from './calculators/emission-projector';
import { calculateLeverage } from './calculators/leverage-calculator';

// Default parameters (TODO: make configurable)
const SAIL_PRICE = 0.5;
const DEFAULT_VOLATILITY = 0.8;

/**
 * Calculate external rewards (SUI incentives, etc.) from pool.rewards array
 * Rewards scale with leverage - concentrated positions capture a larger share of incentives
 * @param {object[]} rewards - Array of reward objects with { token, apr, ... }
 * @param {number} depositAmount - User's deposit in USD
 * @param {number} timeline - Timeline in days
 * @param {number} leverageMultiplier - Multiplier based on price range concentration (default: 1)
 * @param {number} timeInRangeFraction - Fraction of time position is in range (default: 1)
 * @returns {object} - External rewards breakdown
 */
function calculateExternalRewards(rewards, depositAmount, timeline, leverageMultiplier = 1, timeInRangeFraction = 1) {
    if (!rewards || !Array.isArray(rewards) || rewards.length === 0) {
        return { externalRewards: [], externalRewardsValue: 0 };
    }

    const externalRewards = rewards
        .filter(r => r.token && r.apr) // Filter valid rewards
        .map(reward => {
            // APR is in percentage (e.g., 50 = 50%)
            // Apply leverage multiplier - concentrated positions earn proportionally more rewards
            const baseApr = reward.apr || 0;
            const leveragedApr = baseApr * leverageMultiplier;
            const dailyRate = leveragedApr / 100 / 365;
            const projectedValue = depositAmount * dailyRate * timeline * timeInRangeFraction;

            // Handle both string tokens (e.g., "0x...::module::TOKEN") and object tokens (e.g., { symbol: "SUI" })
            let tokenName = 'Unknown';
            if (typeof reward.token === 'string') {
                tokenName = reward.token.split('::').pop() || 'Unknown';
            } else if (reward.token?.symbol) {
                tokenName = reward.token.symbol;
            } else if (reward.token?.name) {
                tokenName = reward.token.name;
            }

            return {
                token: tokenName,
                apr: leveragedApr, // Return leveraged APR for display
                projectedValue,
            };
        });

    const externalRewardsValue = externalRewards.reduce((sum, r) => sum + r.projectedValue, 0);

    return { externalRewards, externalRewardsValue };
}

/**
 * Calculate results for a single scenario
 * @param {object} scenario - Scenario with pool, depositAmount, timeline, osailStrategy, exitPrice, aprOverride
 * @param {number|null} effectiveAPR - Optional: Pre-calculated APR from SDK (PositionUtils.estimateAprByLiquidity).
 *                                      If null, falls back to emission-based calculation.
 * @returns {object|null} - Calculated results or null if no pool
 */
export function calculateScenarioResults(scenario, effectiveAPR = null) {
    const pool = scenario.pool;
    if (!pool) return null;

    // Validate deposit amount
    const depositAmount = scenario.depositAmount;
    if (!depositAmount || depositAmount <= 0 || !isFinite(depositAmount)) {
        return null;
    }

    const tvl = pool.dinamic_stats?.tvl || 0;
    const osail24hRaw = pool.distributed_osail_24h || 0;
    const osail24h = osail24hRaw / 1e9; // Convert to human-readable
    const currentPrice = pool.currentPrice;

    // Validate current price
    if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) {
        return null;
    }

    // Use current price as default exit price if not set
    const exitPrice = (scenario.exitPrice !== null && scenario.exitPrice !== undefined && scenario.exitPrice > 0)
        ? scenario.exitPrice
        : currentPrice;

    const priceLow = scenario.priceRangeLow;
    const priceHigh = scenario.priceRangeHigh;

    // Calculate leverage from price range concentration
    // Pool's base APR assumes a ±10% range (~2.6x leverage), so we normalize against that
    const BASELINE_LEVERAGE = 2.6; // ±10% range gives ~2.6x leverage
    const userLeverage = calculateLeverage(
        currentPrice,
        priceLow,
        priceHigh
    );
    // Leverage multiplier: how much more/less concentrated than baseline
    const leverageMultiplier = userLeverage / BASELINE_LEVERAGE;

    // Calculate time in range (assuming linear price change from current to exit)
    // Once price exits range, position stops earning
    let timeInRangeFraction = 1; // Default: always in range
    if (priceLow && priceHigh && priceLow < priceHigh && currentPrice && exitPrice) {
        const priceChange = exitPrice - currentPrice;

        if (priceChange !== 0) {
            // Determine when price exits range (as fraction of timeline)
            // Linear interpolation: price(t) = currentPrice + (exitPrice - currentPrice) * (t / timeline)
            if (exitPrice > priceHigh) {
                // Price moves up and exits at priceHigh
                const exitFraction = (priceHigh - currentPrice) / priceChange;
                timeInRangeFraction = Math.max(0, Math.min(1, exitFraction));
            } else if (exitPrice < priceLow) {
                // Price moves down and exits at priceLow
                const exitFraction = (priceLow - currentPrice) / priceChange;
                timeInRangeFraction = Math.max(0, Math.min(1, exitFraction));
            }
            // If exitPrice is within range, timeInRangeFraction stays 1
        }
    }

    // Calculate SAIL yield
    // If effectiveAPR is provided (from SDK's estimateAprByLiquidity), use it directly
    // Otherwise, fall back to emission-based calculation
    let projectedOsail, sailAPR, lockAPR, redeemAPR;
    let strategyValue;
    const lockPct = scenario.osailStrategy / 100;

    if (effectiveAPR !== null && effectiveAPR > 0) {
        // effectiveAPR represents the base APR (what you get at 0% lock / 100% redeem)
        // At 100% lock, APR doubles because veSAIL = 2x value of redeemed SAIL
        redeemAPR = effectiveAPR;           // 0% lock = base APR
        lockAPR = effectiveAPR * 2;          // 100% lock = 2x base APR

        // Blend based on lock percentage for display
        sailAPR = (lockPct * lockAPR) + ((1 - lockPct) * redeemAPR);

        console.log('[Scenario APR Debug]', {
            effectiveAPR,
            lockPct,
            redeemAPR,
            lockAPR,
            sailAPR,
            poolName: pool.name
        });

        // Calculate SAIL values directly from APR (not through getEmissionValue)
        // This ensures the yield breakdown matches the input APR
        const annualRedeemValue = scenario.depositAmount * (redeemAPR / 100);
        const annualLockValue = scenario.depositAmount * (lockAPR / 100);

        // Pro-rate by timeline and time in range
        const timeMultiplier = (scenario.timeline / 365) * timeInRangeFraction;

        const redeemValue = annualRedeemValue * (1 - lockPct) * timeMultiplier;
        const lockValue = annualLockValue * lockPct * timeMultiplier;

        strategyValue = {
            lockValue,
            redeemValue,
            totalValue: lockValue + redeemValue,
            lockPortion: lockValue / SAIL_PRICE,
            redeemPortion: redeemValue / SAIL_PRICE,
        };

        projectedOsail = strategyValue.lockPortion + strategyValue.redeemPortion;
    } else {
        // Fall back to emission-based calculation
        const baseProjectedOsail = projectEmissions(
            scenario.depositAmount,
            tvl,
            osail24h,
            scenario.timeline
        );

        // Apply leverage AND time-in-range to emissions
        projectedOsail = baseProjectedOsail * leverageMultiplier * timeInRangeFraction;

        // Calculate APRs for SAIL emissions (with leverage applied)
        const baseEmissionAPR = calculateEmissionAPR(osail24h, SAIL_PRICE, tvl);
        const leveragedEmissionAPR = baseEmissionAPR * leverageMultiplier;
        lockAPR = leveragedEmissionAPR * 100;
        redeemAPR = leveragedEmissionAPR * 50;
        sailAPR = (lockPct * lockAPR) + ((1 - lockPct) * redeemAPR);

        // Use getEmissionValue for fallback calculation
        strategyValue = getEmissionValue(projectedOsail, SAIL_PRICE, lockPct);
    }

    // Calculate external rewards (SUI incentives, etc.)
    // When SDK APR is used (effectiveAPR is set), it ALREADY includes all rewards with proper concentration adjustment
    // So we only add external rewards when using the fallback emission-based calculation
    let externalRewards = [];
    let externalRewardsValue = 0;

    if (effectiveAPR === null || effectiveAPR <= 0) {
        // Fallback mode: calculate external rewards separately with leverage adjustment
        const externalRewardsResult = calculateExternalRewards(
            pool.rewards,
            scenario.depositAmount,
            scenario.timeline,
            leverageMultiplier,
            timeInRangeFraction
        );
        externalRewards = externalRewardsResult.externalRewards;
        externalRewardsValue = externalRewardsResult.externalRewardsValue;
    }
    // When using SDK APR, external rewards are already included in the effectiveAPR

    // Calculate IL using concentrated liquidity math
    // For concentrated positions, IL is calculated using actual position value formulas
    let ilPercent;

    if (currentPrice && exitPrice && exitPrice > 0) {
        if (priceLow && priceHigh && priceLow < priceHigh) {
            // Use accurate concentrated liquidity IL formula
            // This calculates actual LP value vs HODL value based on Uniswap v3 math
            ilPercent = calculateConcentratedIL(currentPrice, exitPrice, priceLow, priceHigh);
        } else {
            // No range set, use standard full-range IL formula
            ilPercent = calculateIL(currentPrice, exitPrice);
        }
    } else {
        // Fall back to volatility-based estimation only if no price data
        const ilEstimate = estimateILFromVolatility(DEFAULT_VOLATILITY, scenario.timeline);
        ilPercent = ilEstimate.expected;
    }

    const ilDollar = calculateILDollarValue(scenario.depositAmount, ilPercent);

    // Ensure all calculated values are valid numbers
    const safeIlPercent = isFinite(ilPercent) && !isNaN(ilPercent) ? ilPercent : 0;
    const safeIlDollar = isFinite(ilDollar) && !isNaN(ilDollar) ? ilDollar : 0;
    const safeOsailValue = isFinite(strategyValue.totalValue) && !isNaN(strategyValue.totalValue) ? strategyValue.totalValue : 0;
    const safeExternalRewards = isFinite(externalRewardsValue) && !isNaN(externalRewardsValue) ? externalRewardsValue : 0;

    // Net yield = SAIL value + external rewards - IL
    const netYield = safeOsailValue + safeExternalRewards - safeIlDollar;

    return {
        projectedOsail: isFinite(projectedOsail) ? projectedOsail : 0,
        osailValue: safeOsailValue,
        lockValue: isFinite(strategyValue.lockValue) ? strategyValue.lockValue : 0,
        redeemValue: isFinite(strategyValue.redeemValue) ? strategyValue.redeemValue : 0,
        lockAPR: isFinite(lockAPR) ? lockAPR : 0,
        redeemAPR: isFinite(redeemAPR) ? redeemAPR : 0,
        sailAPR: isFinite(sailAPR) ? sailAPR : 0,
        externalRewards,
        externalRewardsValue: safeExternalRewards,
        ilPercent: safeIlPercent,
        ilDollar: safeIlDollar,
        netYield: isFinite(netYield) ? netYield : 0,
        depositAmount: scenario.depositAmount,
    };
}

/**
 * Calculate aggregate totals across all scenarios
 * @param {object[]} scenarios - Array of scenarios
 * @returns {object} - Aggregated totals
 */
export function calculateTotalResults(scenarios) {
    const results = scenarios
        .map(s => calculateScenarioResults(s))
        .filter(Boolean);

    if (results.length === 0) {
        return {
            totalDeposit: 0,
            totalOsail: 0,
            totalOsailValue: 0,
            totalExternalRewards: 0,
            totalIL: 0,
            totalNetYield: 0,
            scenarioCount: 0,
        };
    }

    return {
        totalDeposit: results.reduce((sum, r) => sum + r.depositAmount, 0),
        totalOsail: results.reduce((sum, r) => sum + r.projectedOsail, 0),
        totalOsailValue: results.reduce((sum, r) => sum + r.osailValue, 0),
        totalExternalRewards: results.reduce((sum, r) => sum + (r.externalRewardsValue || 0), 0),
        totalIL: results.reduce((sum, r) => sum + r.ilDollar, 0),
        totalNetYield: results.reduce((sum, r) => sum + r.netYield, 0),
        scenarioCount: results.length,
        // Weighted average APRs (weighted by deposit amount)
        avgSailAPR: results.reduce((sum, r) => sum + (r.sailAPR || 0) * r.depositAmount, 0) / results.reduce((sum, r) => sum + r.depositAmount, 0) || 0,
        avgExternalAPR: results.reduce((sum, r) => {
            const extAPR = r.externalRewards?.reduce((s, er) => s + er.apr, 0) || 0;
            return sum + extAPR * r.depositAmount;
        }, 0) / results.reduce((sum, r) => sum + r.depositAmount, 0) || 0,
        avgILAPR: results.reduce((sum, r, _, arr) => {
            // Calculate IL as annualized APR (need scenario timeline)
            const scenario = scenarios[results.indexOf(r)];
            const timeline = scenario?.timeline || 30;
            const ilAPR = (r.ilDollar / r.depositAmount) * (365 / timeline) * 100;
            return sum + (isFinite(ilAPR) ? ilAPR : 0) * r.depositAmount;
        }, 0) / results.reduce((sum, r) => sum + r.depositAmount, 0) || 0,
        avgNetAPR: results.reduce((sum, r, _, arr) => {
            const scenario = scenarios[results.indexOf(r)];
            const timeline = scenario?.timeline || 30;
            const netAPR = (r.netYield / r.depositAmount) * (365 / timeline) * 100;
            return sum + (isFinite(netAPR) ? netAPR : 0) * r.depositAmount;
        }, 0) / results.reduce((sum, r) => sum + r.depositAmount, 0) || 0,
    };
}
