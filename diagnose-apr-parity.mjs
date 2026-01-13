/**
 * APR Parity Diagnostic Script
 * Compares Yield Calculator APR calculation vs Official Frontend approach
 * 
 * Run: node diagnose-apr-parity.mjs
 */

import {
    initFullSailSDK,
    ClmmPoolUtil,
    TickMath,
    Decimal,
    PositionUtils
} from '@fullsailfinance/sdk';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

// Pools will be found dynamically by name
const TEST_POOL_NAMES = ['SAIL/USDC', 'SUI/USDC'];

const DEPOSIT_USD = 10000;

const PRICE_RANGE_PRESETS = {
    'Tight': { low: 0.90, high: 1.10 },     // ±10%
    'Balanced': { low: 0.75, high: 1.33 },  // -25% to +33%
    'Wide': { low: 0.50, high: 2.00 },      // ±50-100%
};

// ═══════════════════════════════════════════════════════════════════════════
// SDK Initialization
// ═══════════════════════════════════════════════════════════════════════════

const sdk = initFullSailSDK({ network: 'mainnet-production' });

// Cache for pools list
let poolsCache = null;

async function getAllPools() {
    if (poolsCache) return poolsCache;

    const result = await sdk.Pool.getList({
        pagination: { page: 0, page_size: 100 }
    });
    poolsCache = result.pools || [];
    return poolsCache;
}

async function getPoolByAddress(address) {
    const pools = await getAllPools();
    return pools.find(p => p.address === address);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function getCurrentPriceFromPool(pool) {
    const sqrtPrice = BigInt(pool.current_sqrt_price || 0);
    const Q64 = BigInt(2 ** 64);
    const priceRatio = Number(sqrtPrice) / Number(Q64);
    const rawPrice = priceRatio * priceRatio;

    const decimalsA = pool.token_a?.decimals ?? 9;
    const decimalsB = pool.token_b?.decimals ?? 6;
    const decimalAdjustment = Math.pow(10, decimalsA - decimalsB);
    const adjustedPrice = rawPrice * decimalAdjustment;

    // Invert if token_a is stable
    const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
    const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

    return {
        sdkPrice: adjustedPrice,
        userFacingPrice: isToken0Stable ? (1 / adjustedPrice) : adjustedPrice,
        isToken0Stable
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic Functions
// ═══════════════════════════════════════════════════════════════════════════

async function diagnosePoolData(pool) {
    console.log('\n' + '═'.repeat(80));
    console.log(`DIAGNOSING POOL: ${pool.name}`);
    console.log('═'.repeat(80));

    console.log(`\n📊 POOL: ${pool.name} (${pool.address?.slice(0, 20)}...)`);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Pool Data Completeness Check
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n┌─ POOL DATA COMPLETENESS ─────────────────────────────────────────────┐');

    const requiredFields = {
        'rewards': pool.rewards,
        'distributed_osail_24h': pool.distributed_osail_24h,
        'dinamic_stats': pool.dinamic_stats,
        'dinamic_stats.active_liquidity': pool.dinamic_stats?.active_liquidity,
        'dinamic_stats.fees_usd_24h': pool.dinamic_stats?.fees_usd_24h,
        'token_a.decimals': pool.token_a?.decimals,
        'token_a.current_price': pool.token_a?.current_price,
        'token_b.decimals': pool.token_b?.decimals,
        'token_b.current_price': pool.token_b?.current_price,
        'gauge_id': pool.gauge_id,
        'current_sqrt_price': pool.current_sqrt_price,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
        const status = value !== undefined && value !== null ? '✅' : '❌';
        const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : value;
        console.log(`│ ${status} ${field.padEnd(35)} = ${displayValue}`);
    }
    console.log('└───────────────────────────────────────────────────────────────────────┘');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Price Calculation Check
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n┌─ PRICE CALCULATIONS ─────────────────────────────────────────────────┐');

    const priceInfo = getCurrentPriceFromPool(pool);
    const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
    const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);

    console.log(`│ current_sqrt_price:    ${pool.current_sqrt_price}`);
    console.log(`│ currentTick:           ${currentTick}`);
    console.log(`│ SDK price (raw):       ${priceInfo.sdkPrice}`);
    console.log(`│ User-facing price:     ${priceInfo.userFacingPrice}`);
    console.log(`│ isToken0Stable:        ${priceInfo.isToken0Stable}`);
    console.log(`│ token_a.current_price: ${pool.token_a?.current_price}`);
    console.log(`│ token_b.current_price: ${pool.token_b?.current_price}`);
    console.log('└───────────────────────────────────────────────────────────────────────┘');

    // ─────────────────────────────────────────────────────────────────────────
    // 3. SAIL Token Check
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n┌─ SAIL TOKEN INFO ────────────────────────────────────────────────────┐');

    // Get SAIL from pool if this is a SAIL pool, or find it
    let sailCoin = null;
    if (pool.name?.includes('SAIL')) {
        sailCoin = pool.token_a?.address?.includes('sail') ? pool.token_a : pool.token_b;
    } else {
        // Fetch SAIL/USDC pool
        try {
            const sailPool = await getPoolByAddress('0x5a5c13667690746ede9b697a51f5c7970e3d2b2eeaf25e0056ebe244fc52e029');
            sailCoin = sailPool?.token_a;
        } catch (e) {
            console.log('│ ⚠️ Could not fetch SAIL token info');
        }
    }

    if (sailCoin) {
        console.log(`│ SAIL price:    ${sailCoin.current_price}`);
        console.log(`│ SAIL decimals: ${sailCoin.decimals}`);
    } else {
        console.log(`│ ❌ SAIL coin not found, using fallbacks`);
    }
    console.log('└───────────────────────────────────────────────────────────────────────┘');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. APR Calculation for Each Preset
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n┌─ APR CALCULATIONS BY PRESET ─────────────────────────────────────────┐');

    const sailPrice = sailCoin?.current_price || 0.0026;
    const oSailDecimals = sailCoin?.decimals || 6;
    const decimalsA = pool.token_a?.decimals ?? 9;
    const decimalsB = pool.token_b?.decimals ?? 6;
    const tickSpacing = pool.tick_spacing || 60;

    for (const [presetName, preset] of Object.entries(PRICE_RANGE_PRESETS)) {
        console.log(`│`);
        console.log(`│ 📐 ${presetName} Preset (${preset.low}x - ${preset.high}x)`);

        // Calculate price range
        const basePrice = priceInfo.userFacingPrice;
        const priceLow = basePrice * preset.low;
        const priceHigh = basePrice * preset.high;

        console.log(`│    Base price:   ${basePrice.toFixed(6)}`);
        console.log(`│    Price range:  ${priceLow.toFixed(6)} - ${priceHigh.toFixed(6)}`);

        // Convert to effective prices for tick calculation
        const effectivePriceLow = priceInfo.isToken0Stable ? (1 / priceHigh) : priceLow;
        const effectivePriceHigh = priceInfo.isToken0Stable ? (1 / priceLow) : priceHigh;

        // Calculate ticks
        const lowerTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing
        );
        const upperTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing
        );

        console.log(`│    Effective prices: ${effectivePriceLow.toFixed(8)} - ${effectivePriceHigh.toFixed(8)}`);
        console.log(`│    Ticks: ${lowerTick} - ${upperTick}`);

        // Check if in range
        const inRangeStrict = currentTick > lowerTick && currentTick < upperTick; // Official
        const inRangeInclusive = currentTick >= lowerTick && currentTick <= upperTick; // Your calc

        console.log(`│    Current tick: ${currentTick}`);
        console.log(`│    In range (strict </>):    ${inRangeStrict}`);
        console.log(`│    In range (inclusive ≤/≥): ${inRangeInclusive}`);

        if (!inRangeStrict) {
            console.log(`│    ⚠️ Position would be OUT OF RANGE`);
            continue;
        }

        // Calculate liquidity (Your Calculator approach)
        const tokenAPrice = pool.token_a?.current_price || 1;
        const coinAmountA = BigInt(Math.floor((DEPOSIT_USD / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

        console.log(`│    coinAmountA (from USD): ${coinAmountA.toString()}`);

        try {
            const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
                lowerTick,
                upperTick,
                coinAmountA,
                true, // isCoinA
                false, // roundUp
                0, // slippage
                currentSqrtPrice
            );

            console.log(`│    Liquidity:  ${liquidityAmount.toString()}`);
            console.log(`│    amountA:    ${amountA.toString()}`);
            console.log(`│    amountB:    ${amountB.toString()}`);

            // Calculate APR
            const apr = PositionUtils.estimateAprByLiquidity({
                pool,
                positionActiveLiquidity: liquidityAmount,
                positionAmountA: amountA,
                positionAmountB: amountB,
                sailPrice: sailPrice,
                oSailDecimals: oSailDecimals,
                rewardChoice: 'liquid',
                isNewPosition: true,
            });

            console.log(`│    ✅ Estimated APR: ${apr.toFixed(2)}%`);

            // Breakdown of what goes into APR
            console.log(`│    ─── APR Breakdown ───`);

            // Pool rewards
            const poolRewardsUsd = (pool.rewards ?? []).reduce((total, reward) => {
                if (!reward.token.current_price) return total;
                const rewardUsd = Number(reward.emissions_per_day) / Math.pow(10, reward.token.decimals) * reward.token.current_price;
                return total + rewardUsd;
            }, 0);
            console.log(`│    Pool rewards/day (USD): $${poolRewardsUsd.toFixed(2)}`);

            // oSAIL emissions
            const emissionsUsd = pool.distributed_osail_24h
                ? Number(pool.distributed_osail_24h) / Math.pow(10, oSailDecimals) * sailPrice / 2
                : 0;
            console.log(`│    oSAIL emissions/day (USD): $${emissionsUsd.toFixed(2)}`);

            // Fees (only if no gauge)
            const feesUsd = pool.gauge_id ? 0 : (pool.dinamic_stats?.fees_usd_24h || 0);
            console.log(`│    Fees/day (USD): $${feesUsd.toFixed(2)} ${pool.gauge_id ? '(has gauge, excluded)' : ''}`);

            // Pool liquidity
            console.log(`│    Pool active liquidity: ${pool.dinamic_stats?.active_liquidity}`);

        } catch (e) {
            console.log(`│    ❌ Error: ${e.message}`);
        }
    }

    console.log('└───────────────────────────────────────────────────────────────────────┘');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           APR PARITY DIAGNOSTIC - Yield Calculator vs Official           ║');
    console.log('║                                                                           ║');
    console.log('║  This script compares APR calculations between your implementation       ║');
    console.log('║  and the official Full Sail frontend approach.                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log(`\nDeposit Amount: $${DEPOSIT_USD.toLocaleString()}`);
    console.log(`Reward Choice: liquid (oSAIL valued at 50% of SAIL)`);

    // Fetch all pools first
    console.log('\n📡 Fetching pools...');
    const allPools = await getAllPools();
    console.log(`Found ${allPools.length} pools`);

    // List first 10 pool names for debugging
    console.log('\nAvailable pools (first 10):');
    allPools.slice(0, 10).forEach(p => console.log(`  - ${p.name} (${p.address?.slice(0, 20)}...)`));

    // Find test pools by name
    for (const poolName of TEST_POOL_NAMES) {
        const pool = allPools.find(p => p.name === poolName);
        if (pool) {
            await diagnosePoolData(pool);
        } else {
            console.log(`\n❌ Pool "${poolName}" not found`);
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('═'.repeat(80));

    console.log(`
📋 SUMMARY OF KEY CHECKS:

1. POOL DATA COMPLETENESS
   - All fields marked with ✅ are present
   - Fields marked with ❌ are MISSING and may cause APR issues

2. PRICE CALCULATIONS  
   - Compare 'token_a.current_price' with calculated prices
   - If they differ significantly, there may be stale data

3. SAIL TOKEN
   - oSailDecimals should be 6
   - sailPrice should be current market price

4. APR BREAKDOWN
   - Check which components contribute to APR
   - If gauge_id exists, fees are NOT included (handled by gauge)
   - If distributed_osail_24h is 0, no emission rewards

5. IN-RANGE CHECK
   - Official uses strict inequalities (< and >)
   - Your calc uses inclusive (>= and <=)
   - This matters at exact tick boundaries
`);
}

main().catch(console.error);
