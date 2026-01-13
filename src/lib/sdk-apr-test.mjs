/**
 * SDK APR Test - Uses native SDK PositionUtils.estimateAprByLiquidity
 * 
 * Run with: node --experimental-vm-modules src/lib/sdk-apr-test.mjs
 */

import {
    initFullSailSDK,
    ClmmPoolUtil,
    TickMath,
    Decimal,
    PositionUtils
} from '@fullsailfinance/sdk';

// Price range presets
const PRESETS = {
    tight: { low: 0.95, high: 1.05, label: 'Tight (±5%)' },
    balanced: { low: 0.75, high: 1.33, label: 'Balanced (-25%, +33%)' },
    wide: { low: 0.50, high: 2.00, label: 'Wide (-50%, +100%)' },
    full: { low: 0.001, high: 1000, label: 'Full Range' },
};

const DEPOSIT_AMOUNT = 10000; // $10k deposit

/**
 * Get current price from pool's sqrt_price
 */
function getCurrentPrice(pool) {
    try {
        const sqrtPrice = BigInt(pool.current_sqrt_price);
        const Q64 = BigInt(2 ** 64);
        const priceRatio = Number(sqrtPrice) / Number(Q64);
        const rawPrice = priceRatio * priceRatio;

        const decimals0 = pool.token_a?.decimals ?? 9;
        const decimals1 = pool.token_b?.decimals ?? 9;
        const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
        const adjustedPrice = rawPrice * decimalAdjustment;

        const token0 = pool.token_a?.address?.split('::').pop() || '';
        const isToken0Stable = token0 === 'USDC' || token0 === 'USDT';
        return isToken0Stable ? (1 / adjustedPrice) : adjustedPrice;
    } catch (e) {
        return null;
    }
}

/**
 * Calculate estimated APR using SDK's native PositionUtils.estimateAprByLiquidity
 */
async function calculateSDKApr(pool, priceLow, priceHigh, depositAmount, sailCoin) {
    try {
        const decimalsA = pool.token_a?.decimals ?? 9;
        const decimalsB = pool.token_b?.decimals ?? 9;
        const tickSpacing = pool.tick_spacing || 60;

        const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
        if (currentSqrtPrice === 0n) {
            return { apr: 0, error: 'No sqrtPrice' };
        }

        // Determine if token A is stable (needs price inversion for ticks)
        const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
        const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

        const effectivePriceLow = isToken0Stable ? (1 / priceHigh) : priceLow;
        const effectivePriceHigh = isToken0Stable ? (1 / priceLow) : priceHigh;

        // Convert prices to ticks
        const lowerTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing
        );
        const upperTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing
        );

        // Check if current price is within range
        const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);
        const inRange = currentTick >= lowerTick && currentTick <= upperTick;

        if (!inRange) {
            return { apr: 0, inRange: false };
        }

        // Estimate deposit amount in token A
        const tokenAPrice = pool.token_a?.current_price || 1;
        const coinAmountA = BigInt(Math.floor((depositAmount / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

        // Estimate liquidity using SDK
        const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
            lowerTick,
            upperTick,
            coinAmountA,
            true, // isCoinA
            false, // roundUp
            0, // slippage
            currentSqrtPrice
        );

        // Use SDK's native estimateAprByLiquidity
        const estimatedApr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityAmount,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: sailCoin.current_price,
            oSailDecimals: sailCoin.decimals,
            rewardChoice: 'liquid', // or 'vesail' for lock
            isNewPosition: true,
        });

        return {
            apr: estimatedApr,
            inRange,
            lowerTick,
            upperTick,
            currentTick,
        };
    } catch (e) {
        return { apr: 0, error: e.message };
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║      SDK APR TEST - Native PositionUtils.estimateAprByLiquidity            ║');
    console.log('║                      $10k deposit × 4 presets × 3 pools                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    const sdk = initFullSailSDK({ network: 'mainnet-production' });
    const result = await sdk.Pool.getList({ pagination: { page: 0, page_size: 100 } });

    if (!result?.pools?.length) {
        console.error('❌ No pools returned');
        return;
    }

    // Get SAIL coin for pricing
    const sailPool = result.pools.find(p => p.name === 'SAIL/USDC');
    const sailCoin = sailPool?.token_b; // SAIL is token_b in SAIL/USDC

    if (!sailCoin) {
        console.error('❌ Could not find SAIL token');
        return;
    }

    console.log(`SAIL Price: $${sailCoin.current_price?.toFixed(4)} (from SDK, decimals: ${sailCoin.decimals})\n`);

    // Select 3 pools with highest TVL
    const sortedPools = result.pools
        .filter(p => p.dinamic_stats?.tvl > 0 && p.current_sqrt_price)
        .sort((a, b) => (b.dinamic_stats?.tvl || 0) - (a.dinamic_stats?.tvl || 0))
        .slice(0, 3);

    for (const pool of sortedPools) {
        const currentPrice = getCurrentPrice(pool);

        console.log('═'.repeat(85));
        console.log(`📈 ${pool.name}`);
        console.log(`   TVL: $${(pool.dinamic_stats?.tvl || 0).toLocaleString()} | Price: $${currentPrice?.toFixed(4)}`);
        console.log(`   Backend full_apr: ${pool.full_apr?.toFixed(1)}%`);
        console.log('═'.repeat(85));
        console.log('   Preset              | Est. APR (SDK) | In Range | Ticks');
        console.log('   ' + '─'.repeat(75));

        for (const [key, preset] of Object.entries(PRESETS)) {
            const priceLow = currentPrice * preset.low;
            const priceHigh = currentPrice * preset.high;

            const result = await calculateSDKApr(pool, priceLow, priceHigh, DEPOSIT_AMOUNT, sailCoin);

            const aprStr = result.error
                ? `ERR: ${result.error.slice(0, 15)}`
                : `${result.apr.toFixed(2)}%`;
            const inRangeStr = result.inRange ? '✓' : '✗';
            const ticksStr = result.lowerTick !== undefined
                ? `[${result.lowerTick}, ${result.upperTick}] cur:${result.currentTick}`
                : '-';

            console.log(`   ${preset.label.padEnd(18)} | ${aprStr.padStart(14)} | ${inRangeStr.padStart(8)} | ${ticksStr}`);
        }
        console.log('');
    }

    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                              TEST COMPLETE                                   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
