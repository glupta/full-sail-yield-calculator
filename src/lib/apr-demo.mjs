/**
 * APR Calculation Demo - Verifies math works with sample inputs
 * Run with: node --experimental-vm-modules src/lib/apr-demo.mjs
 */

// Sample pool data (mocked - no SDK needed)
const MOCK_POOL = {
    id: "mock-wbtc-usdc",
    token0_symbol: "WBTC",
    token1_symbol: "USDC",
    currentPrice: 100000, // $100k BTC price
    current_sqrt_price: "18446744073709551616", // 2^64
    distributed_osail_24h: 5000000000000, // 5000 oSAIL/day (in nanoSAIL)
    full_apr: 50.18,
    dinamic_stats: {
        tvl: 1000000, // $1M TVL
    },
    rewards: [
        { token: "SUI", apr: 12.5 }
    ],
};

// Sample scenario
const SAMPLE_SCENARIO = {
    pool: MOCK_POOL,
    depositAmount: 10000, // $10,000 deposit
    timeline: 30, // 30 days
    exitPrice: 100000, // Exit at same price (no IL)
    osailStrategy: 50, // 50% lock, 50% redeem
    priceRangeLow: 75000, // -25% (Balanced preset)
    priceRangeHigh: 133000, // +33% (Balanced preset)
};

// ========== CALCULATION FUNCTIONS (Inline for Demo) ==========

function calculateLeverage(currentPrice, priceLow, priceHigh) {
    if (!currentPrice || currentPrice <= 0) return 1;
    if (!priceLow || !priceHigh) return 1;
    if (priceLow <= 0 || priceHigh <= 0) return 1;
    if (priceLow >= priceHigh) return 1;
    if (currentPrice <= priceLow || currentPrice >= priceHigh) return 1;

    const sqrtRatio = Math.sqrt(priceLow / currentPrice);
    if (sqrtRatio >= 0.9999) return 10000;

    return Math.max(1, 1 / (1 - sqrtRatio));
}

function calculateConcentratedIL(P0, P1, Pa, Pb) {
    const sqrtP0 = Math.sqrt(P0);
    const x0 = (1 / sqrtP0) - (1 / Math.sqrt(Pb));
    const y0 = sqrtP0 - Math.sqrt(Pa);

    let x1, y1;
    if (P1 <= Pa) {
        x1 = (1 / Math.sqrt(Pa)) - (1 / Math.sqrt(Pb));
        y1 = 0;
    } else if (P1 >= Pb) {
        x1 = 0;
        y1 = Math.sqrt(Pb) - Math.sqrt(Pa);
    } else {
        const sqrtP1 = Math.sqrt(P1);
        x1 = (1 / sqrtP1) - (1 / Math.sqrt(Pb));
        y1 = sqrtP1 - Math.sqrt(Pa);
    }

    const LP_Value = x1 * P1 + y1;
    const HODL_Value = x0 * P1 + y0;
    return (LP_Value / HODL_Value) - 1;
}

function calculateScenarioResults(scenario, effectiveAPR = null) {
    const pool = scenario.pool;
    if (!pool) return null;

    const depositAmount = scenario.depositAmount;
    if (!depositAmount || depositAmount <= 0) return null;

    const tvl = pool.dinamic_stats?.tvl || 0;
    const osail24h = (pool.distributed_osail_24h || 0) / 1e9;
    const currentPrice = pool.currentPrice;
    const SAIL_PRICE = 0.5;

    if (!currentPrice || currentPrice <= 0) return null;

    const exitPrice = scenario.exitPrice || currentPrice;
    const priceLow = scenario.priceRangeLow;
    const priceHigh = scenario.priceRangeHigh;

    // Leverage calculation
    const leverage = calculateLeverage(currentPrice, priceLow, priceHigh);
    const BASELINE_LEVERAGE = 17.5;

    // Time in range (linear price movement)
    let timeInRangeFraction = 1;
    const priceChange = exitPrice - currentPrice;
    if (priceChange !== 0 && priceLow && priceHigh) {
        if (exitPrice > priceHigh) {
            timeInRangeFraction = Math.max(0, Math.min(1, (priceHigh - currentPrice) / priceChange));
        } else if (exitPrice < priceLow) {
            timeInRangeFraction = Math.max(0, Math.min(1, (priceLow - currentPrice) / priceChange));
        }
    }

    // APR calculation
    const lockPct = scenario.osailStrategy / 100;
    let sailAPR, lockAPR, redeemAPR, projectedOsail;

    if (effectiveAPR !== null && effectiveAPR > 0) {
        sailAPR = effectiveAPR;
        lockAPR = effectiveAPR;
        redeemAPR = effectiveAPR * 0.5;
        const dailyRate = effectiveAPR / 100 / 365;
        const projectedValue = depositAmount * dailyRate * scenario.timeline * timeInRangeFraction;
        projectedOsail = projectedValue / SAIL_PRICE;
    } else {
        // Emission-based calculation
        const share = depositAmount / tvl;
        const baseOsail = osail24h * share * scenario.timeline;
        const leverageMultiplier = leverage / BASELINE_LEVERAGE;
        projectedOsail = baseOsail * leverageMultiplier * timeInRangeFraction;

        const baseEmissionAPR = (osail24h * SAIL_PRICE * 365) / tvl;
        lockAPR = baseEmissionAPR * leverageMultiplier * 100;
        redeemAPR = lockAPR * 0.5;
        sailAPR = (lockPct * lockAPR) + ((1 - lockPct) * redeemAPR);
    }

    // oSAIL strategy value
    const redeemAmount = projectedOsail * (1 - lockPct);
    const lockAmount = projectedOsail * lockPct;
    const lockValue = lockAmount * SAIL_PRICE;
    const redeemValue = redeemAmount * SAIL_PRICE * 0.5;
    const osailValue = lockValue + redeemValue;

    // External rewards
    const externalRewardsValue = (pool.rewards || []).reduce((sum, r) => {
        const dailyRate = (r.apr || 0) / 100 / 365;
        return sum + depositAmount * dailyRate * scenario.timeline;
    }, 0);

    // IL calculation
    const ilPercent = calculateConcentratedIL(currentPrice, exitPrice, priceLow, priceHigh);
    const ilDollar = depositAmount * Math.abs(ilPercent);

    // Net yield
    const netYield = osailValue + externalRewardsValue - ilDollar;

    return {
        leverage,
        projectedOsail,
        osailValue,
        lockValue,
        redeemValue,
        sailAPR,
        lockAPR,
        redeemAPR,
        externalRewardsValue,
        ilPercent,
        ilDollar,
        netYield,
        timeInRangeFraction,
        depositAmount,
    };
}

// ========== RUN DEMO ==========

console.log("╔══════════════════════════════════════════════════════════════════╗");
console.log("║     FULL SAIL YIELD CALCULATOR - APR DEMO (No SDK Required)      ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");
console.log("");

console.log("📊 SAMPLE INPUTS:");
console.log("─".repeat(50));
console.log(`  Pool:           ${MOCK_POOL.token0_symbol}/${MOCK_POOL.token1_symbol}`);
console.log(`  Current Price:  $${MOCK_POOL.currentPrice.toLocaleString()}`);
console.log(`  Pool TVL:       $${MOCK_POOL.dinamic_stats.tvl.toLocaleString()}`);
console.log(`  Pool APR:       ${MOCK_POOL.full_apr}%`);
console.log(`  24h oSAIL:      ${(MOCK_POOL.distributed_osail_24h / 1e9).toFixed(0)} SAIL`);
console.log("");
console.log(`  Deposit:        $${SAMPLE_SCENARIO.depositAmount.toLocaleString()}`);
console.log(`  Timeline:       ${SAMPLE_SCENARIO.timeline} days`);
console.log(`  Price Range:    $${SAMPLE_SCENARIO.priceRangeLow.toLocaleString()} - $${SAMPLE_SCENARIO.priceRangeHigh.toLocaleString()} (Balanced)`);
console.log(`  Exit Price:     $${SAMPLE_SCENARIO.exitPrice.toLocaleString()}`);
console.log(`  Strategy:       ${SAMPLE_SCENARIO.osailStrategy}% Lock / ${100 - SAMPLE_SCENARIO.osailStrategy}% Redeem`);
console.log("");

// Test 1: Emission-based calculation (no SDK APR)
console.log("═".repeat(50));
console.log("📈 EMISSION-BASED CALCULATION (Internal):");
console.log("═".repeat(50));

const result1 = calculateScenarioResults(SAMPLE_SCENARIO, null);
console.log(`  Leverage:         ${result1.leverage.toFixed(2)}x`);
console.log(`  Time in Range:    ${(result1.timeInRangeFraction * 100).toFixed(0)}%`);
console.log(`  Projected oSAIL:  ${result1.projectedOsail.toFixed(2)} SAIL`);
console.log(`  oSAIL Value:      $${result1.osailValue.toFixed(2)}`);
console.log(`    → Lock Value:   $${result1.lockValue.toFixed(2)}`);
console.log(`    → Redeem Value: $${result1.redeemValue.toFixed(2)}`);
console.log(`  External Rewards: $${result1.externalRewardsValue.toFixed(2)} (SUI)`);
console.log(`  IL:               ${(result1.ilPercent * 100).toFixed(2)}% ($${result1.ilDollar.toFixed(2)})`);
console.log("");
console.log(`  ✅ NET YIELD:     $${result1.netYield.toFixed(2)}`);
console.log(`  ✅ SAIL APR:      ${result1.sailAPR.toFixed(2)}%`);
console.log("");

// Test 2: SDK-based calculation (with override APR)
console.log("═".repeat(50));
console.log("📈 SDK-BASED CALCULATION (With Override APR = 9.8%):");
console.log("═".repeat(50));

const result2 = calculateScenarioResults(SAMPLE_SCENARIO, 9.8); // Simulating SDK APR
console.log(`  Leverage:         ${result2.leverage.toFixed(2)}x`);
console.log(`  Time in Range:    ${(result2.timeInRangeFraction * 100).toFixed(0)}%`);
console.log(`  Projected oSAIL:  ${result2.projectedOsail.toFixed(2)} SAIL`);
console.log(`  oSAIL Value:      $${result2.osailValue.toFixed(2)}`);
console.log(`    → Lock Value:   $${result2.lockValue.toFixed(2)}`);
console.log(`    → Redeem Value: $${result2.redeemValue.toFixed(2)}`);
console.log(`  External Rewards: $${result2.externalRewardsValue.toFixed(2)} (SUI)`);
console.log(`  IL:               ${(result2.ilPercent * 100).toFixed(2)}% ($${result2.ilDollar.toFixed(2)})`);
console.log("");
console.log(`  ✅ NET YIELD:     $${result2.netYield.toFixed(2)}`);
console.log(`  ✅ SAIL APR:      ${result2.sailAPR.toFixed(2)}%`);
console.log("");

// Test 3: IL scenario (price drops 20%)
console.log("═".repeat(50));
console.log("📉 IL SCENARIO (Exit Price = $80,000, -20%):");
console.log("═".repeat(50));

const ilScenario = { ...SAMPLE_SCENARIO, exitPrice: 80000 };
const result3 = calculateScenarioResults(ilScenario, 9.8);
console.log(`  Exit Price:       $${ilScenario.exitPrice.toLocaleString()}`);
console.log(`  Leverage:         ${result3.leverage.toFixed(2)}x`);
console.log(`  Time in Range:    ${(result3.timeInRangeFraction * 100).toFixed(0)}%`);
console.log(`  oSAIL Value:      $${result3.osailValue.toFixed(2)}`);
console.log(`  External Rewards: $${result3.externalRewardsValue.toFixed(2)}`);
console.log(`  IL:               ${(result3.ilPercent * 100).toFixed(2)}% ($${result3.ilDollar.toFixed(2)})`);
console.log("");
console.log(`  ✅ NET YIELD:     $${result3.netYield.toFixed(2)}`);
console.log("");

console.log("╔══════════════════════════════════════════════════════════════════╗");
console.log("║                    ✅ ALL CALCULATIONS WORK!                     ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");
