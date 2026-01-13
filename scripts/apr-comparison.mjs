/**
 * APR Comparison Table - All Pools
 * Shows: Yield APR (dinamic_stats.apr), full_apr, SDK Estimated APR
 */

import {
    initFullSailSDK,
    ClmmPoolUtil,
    TickMath,
    Decimal,
    PositionUtils
} from '@fullsailfinance/sdk';

const DEPOSIT_USD = 10000;
const sdk = initFullSailSDK({ network: 'mainnet-production' });

async function main() {
    console.log('Fetching pools...\n');

    const result = await sdk.Pool.getList({ pagination: { page: 0, page_size: 100 } });
    const pools = result.pools || [];

    // Get SAIL token info
    const sailPool = pools.find(p => p.name === 'SAIL/USDC');
    const sailCoin = sailPool?.token_b;
    const sailPrice = sailCoin?.current_price || 0.002;
    const oSailDecimals = sailCoin?.decimals || 6;

    console.log('| Pool | Yield APR | full_apr | SDK APR (Wide) |');
    console.log('|------|-----------|----------|----------------|');

    // Sort by TVL descending
    const sorted = [...pools].sort((a, b) => (b.dinamic_stats?.tvl || 0) - (a.dinamic_stats?.tvl || 0));

    for (const pool of sorted.slice(0, 25)) {
        try {
            const yieldApr = pool.dinamic_stats?.apr;
            const fullApr = pool.full_apr;
            const sdkApr = await calculateSDKApr(pool, sailPrice, oSailDecimals);

            const yieldStr = typeof yieldApr === 'number' ? yieldApr.toFixed(2) + '%' : 'N/A';
            const fullStr = typeof fullApr === 'number' ? fullApr.toFixed(2) + '%' : 'N/A';
            const sdkStr = sdkApr !== null ? sdkApr.toFixed(2) + '%' : 'N/A';

            console.log('| ' + (pool.name || 'Unknown') + ' | ' + yieldStr + ' | ' + fullStr + ' | ' + sdkStr + ' |');
        } catch (e) {
            console.log('| ' + (pool.name || 'Unknown') + ' | Error | Error | Error |');
        }
    }
}

async function calculateSDKApr(pool, sailPrice, oSailDecimals) {
    const decimalsA = pool.token_a?.decimals ?? 9;
    const decimalsB = pool.token_b?.decimals ?? 6;
    const tickSpacing = pool.tick_spacing || 60;

    const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
    if (currentSqrtPrice === 0n) return null;

    const Q64 = BigInt(2 ** 64);
    const priceRatio = Number(currentSqrtPrice) / Number(Q64);
    const rawPrice = priceRatio * priceRatio;
    const decimalAdjustment = Math.pow(10, decimalsA - decimalsB);
    const sdkPrice = rawPrice * decimalAdjustment;

    const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
    const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';
    const userPrice = isToken0Stable ? (1 / sdkPrice) : sdkPrice;

    // Wide range: -50% / +100%
    const priceLow = userPrice * 0.5;
    const priceHigh = userPrice * 2.0;

    const effectivePriceLow = isToken0Stable ? (1 / priceHigh) : priceLow;
    const effectivePriceHigh = isToken0Stable ? (1 / priceLow) : priceHigh;

    const lowerTick = TickMath.priceToInitializableTickIndex(
        Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing
    );
    const upperTick = TickMath.priceToInitializableTickIndex(
        Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing
    );

    const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);
    if (currentTick < lowerTick || currentTick > upperTick) return null;

    const tokenAPrice = pool.token_a?.current_price || 1;
    const coinAmountA = BigInt(Math.floor((DEPOSIT_USD / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

    const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
        lowerTick, upperTick, coinAmountA, true, false, 0, currentSqrtPrice
    );

    const apr = PositionUtils.estimateAprByLiquidity({
        pool,
        positionActiveLiquidity: liquidityAmount,
        positionAmountA: amountA,
        positionAmountB: amountB,
        sailPrice,
        oSailDecimals,
        rewardChoice: 'liquid',
        isNewPosition: true,
    });

    return apr;
}

main().catch(console.error);
