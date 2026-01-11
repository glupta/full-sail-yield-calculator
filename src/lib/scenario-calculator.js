/**
 * Scenario Result Calculator
 * Centralized calculation logic for scenario yields
 */

import { calculateIL, estimateILFromVolatility, calculateILDollarValue } from './calculators/il-calculator';
import { projectEmissions, getEmissionValue } from './calculators/emission-projector';

// Default parameters (TODO: make configurable)
const SAIL_PRICE = 0.5;
const DEFAULT_VOLATILITY = 0.8;

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

    // Calculate IL - use exit price if provided, otherwise estimate from volatility
    let ilPercent;
    const currentPrice = pool.currentPrice;
    const exitPrice = scenario.exitPrice;

    if (currentPrice && exitPrice && exitPrice > 0) {
        // Use actual price change for IL calculation
        ilPercent = calculateIL(currentPrice, exitPrice);
    } else {
        // Fall back to volatility-based estimation
        const ilEstimate = estimateILFromVolatility(DEFAULT_VOLATILITY, scenario.timeline);
        ilPercent = ilEstimate.expected;
    }

    const ilDollar = calculateILDollarValue(scenario.depositAmount, ilPercent);

    // Net yield
    const netYield = strategyValue.totalValue - ilDollar;

    return {
        projectedOsail,
        osailValue: strategyValue.totalValue,
        lockValue: strategyValue.lockValue,
        redeemValue: strategyValue.redeemValue,
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
            totalIL: 0,
            totalNetYield: 0,
            scenarioCount: 0,
        };
    }

    return {
        totalDeposit: results.reduce((sum, r) => sum + r.depositAmount, 0),
        totalOsail: results.reduce((sum, r) => sum + r.projectedOsail, 0),
        totalOsailValue: results.reduce((sum, r) => sum + r.osailValue, 0),
        totalIL: results.reduce((sum, r) => sum + r.ilDollar, 0),
        totalNetYield: results.reduce((sum, r) => sum + r.netYield, 0),
        scenarioCount: results.length,
    };
}
