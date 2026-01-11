/**
 * Scenario Result Calculator
 * Centralized calculation logic for scenario yields
 */

import { calculateIL, estimateILFromVolatility, calculateILDollarValue } from './calculators/il-calculator';
import { projectEmissions, getEmissionValue, calculateEmissionAPR } from './calculators/emission-projector';

// Default parameters (TODO: make configurable)
const SAIL_PRICE = 0.5;
const DEFAULT_VOLATILITY = 0.8;

/**
 * Calculate external rewards (SUI incentives, etc.) from pool.rewards array
 * @param {object[]} rewards - Array of reward objects with { token, apr, ... }
 * @param {number} depositAmount - User's deposit in USD
 * @param {number} timeline - Timeline in days
 * @returns {object} - External rewards breakdown
 */
function calculateExternalRewards(rewards, depositAmount, timeline) {
    if (!rewards || !Array.isArray(rewards) || rewards.length === 0) {
        return { externalRewards: [], externalRewardsValue: 0 };
    }

    const externalRewards = rewards
        .filter(r => r.token && r.apr) // Filter valid rewards
        .map(reward => {
            // APR is in percentage (e.g., 50 = 50%)
            const apr = reward.apr || 0;
            const dailyRate = apr / 100 / 365;
            const projectedValue = depositAmount * dailyRate * timeline;

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
                apr: apr,
                projectedValue,
            };
        });

    const externalRewardsValue = externalRewards.reduce((sum, r) => sum + r.projectedValue, 0);

    return { externalRewards, externalRewardsValue };
}

/**
 * Calculate results for a single scenario
 * @param {object} scenario - Scenario with pool, depositAmount, timeline, osailStrategy, exitPrice
 * @returns {object|null} - Calculated results or null if no pool
 */
export function calculateScenarioResults(scenario) {
    const pool = scenario.pool;
    if (!pool) return null;

    const tvl = pool.dinamic_stats?.tvl || 0;
    const osail24hRaw = pool.distributed_osail_24h || 0;
    const osail24h = osail24hRaw / 1e9; // Convert to human-readable

    // Project oSAIL emissions
    const projectedOsail = projectEmissions(
        scenario.depositAmount,
        tvl,
        osail24h,
        scenario.timeline
    );

    // Calculate strategy value
    const lockPct = scenario.osailStrategy / 100;
    const strategyValue = getEmissionValue(projectedOsail, SAIL_PRICE, lockPct);

    // Calculate APRs for SAIL emissions
    // Base SAIL emission APR (at 100% lock value)
    const baseEmissionAPR = calculateEmissionAPR(osail24h, SAIL_PRICE, tvl);
    // Lock APR = base APR (1:1 SAIL value)
    const lockAPR = baseEmissionAPR * 100; // Convert to percentage
    // Redeem APR = 50% of base (redeem at 50% SAIL price)
    const redeemAPR = baseEmissionAPR * 50; // 50% of the value
    // Blended APR based on strategy
    const sailAPR = (lockPct * lockAPR) + ((1 - lockPct) * redeemAPR);

    // Calculate external rewards (SUI incentives, etc.)
    const { externalRewards, externalRewardsValue } = calculateExternalRewards(
        pool.rewards,
        scenario.depositAmount,
        scenario.timeline
    );

    // Calculate IL - use exit price if provided, otherwise default to current price (0 IL)
    let ilPercent;
    const currentPrice = pool.currentPrice;
    // If no exit price set, default to current price (0 IL) for explicit calculation
    const exitPrice = scenario.exitPrice ?? currentPrice;

    if (currentPrice && exitPrice && exitPrice > 0) {
        // Use actual price change for IL calculation
        ilPercent = calculateIL(currentPrice, exitPrice);
    } else {
        // Fall back to volatility-based estimation only if no price data
        const ilEstimate = estimateILFromVolatility(DEFAULT_VOLATILITY, scenario.timeline);
        ilPercent = ilEstimate.expected;
    }

    const ilDollar = calculateILDollarValue(scenario.depositAmount, ilPercent);

    // Net yield = SAIL value + external rewards - IL
    const netYield = strategyValue.totalValue + externalRewardsValue - ilDollar;

    return {
        projectedOsail,
        osailValue: strategyValue.totalValue,
        lockValue: strategyValue.lockValue,
        redeemValue: strategyValue.redeemValue,
        lockAPR,
        redeemAPR,
        sailAPR,
        externalRewards,
        externalRewardsValue,
        ilPercent,
        ilDollar,
        netYield,
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
    };
}
