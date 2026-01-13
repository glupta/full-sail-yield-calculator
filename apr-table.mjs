/**
 * APR Table - All Pools, Wide & Full Range
 * Run: node apr-table.mjs
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
    const sailCoin = sailPool?.token_b; // SAIL is token_b in SAIL/USDC
    const sailPrice = sailCoin?.current_price || 0.002;
    const oSailDecimals = sailCoin?.decimals || 6;

    console.log(`SAIL Price: $${sailPrice}`);
    console.log(`Deposit: $${DEPOSIT_USD.toLocaleString()}`);
    console.log(`Reward Choice: liquid\n`);

    // Table header
    console.log('┌─────────────────────┬─────────────┬─────────────┐');
    console.log('│ Pool                │ Wide (±50%) │ Full Range  │');
    console.log('├─────────────────────┼─────────────┼─────────────┤');

    for (const pool of pools) {
        try {
            const wideApr = await calculateAPR(pool, 0.5, 2.0, sailPrice, oSailDecimals);
            const fullApr = await calculateAPR(pool, 0.01, 100, sailPrice, oSailDecimals); // ~Full range

            const poolName = pool.name?.padEnd(19) || 'Unknown'.padEnd(19);
            const wideStr = wideApr !== null ? `${wideApr.toFixed(2)}%`.padStart(11) : 'N/A'.padStart(11);
            const fullStr = fullApr !== null ? `${fullApr.toFixed(2)}%`.padStart(11) : 'N/A'.padStart(11);

            console.log(`│ ${poolName} │ ${wideStr} │ ${fullStr} │`);
        } catch (e) {
            console.log(`│ ${pool.name?.padEnd(19) || 'Unknown'.padEnd(19)} │ ${'Error'.padStart(11)} │ ${'Error'.padStart(11)} │`);
        }
    }

    console.log('└─────────────────────┴─────────────┴─────────────┘');
}

async function calculateAPR(pool, lowMult, highMult, sailPrice, oSailDecimals) {
    const decimalsA = pool.token_a?.decimals ?? 9;
    const decimalsB = pool.token_b?.decimals ?? 6;
    const tickSpacing = pool.tick_spacing || 60;

    const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
    if (currentSqrtPrice === 0n) return null;

    // Get current price
    const Q64 = BigInt(2 ** 64);
    const priceRatio = Number(currentSqrtPrice) / Number(Q64);
    const rawPrice = priceRatio * priceRatio;
    const decimalAdjustment = Math.pow(10, decimalsA - decimalsB);
    const sdkPrice = rawPrice * decimalAdjustment;

    // Check if token_a is stable
    const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
    const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';
    const userPrice = isToken0Stable ? (1 / sdkPrice) : sdkPrice;

    // Calculate price range
    const priceLow = userPrice * lowMult;
    const priceHigh = userPrice * highMult;

    // Convert to effective prices for ticks
    const effectivePriceLow = isToken0Stable ? (1 / priceHigh) : priceLow;
    const effectivePriceHigh = isToken0Stable ? (1 / priceLow) : priceHigh;

    // Calculate ticks
    const lowerTick = TickMath.priceToInitializableTickIndex(
        Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing
    );
    const upperTick = TickMath.priceToInitializableTickIndex(
        Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing
    );

    // Check if in range
    const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);
    if (currentTick < lowerTick || currentTick > upperTick) return null;

    // Calculate liquidity
    const tokenAPrice = pool.token_a?.current_price || 1;
    const coinAmountA = BigInt(Math.floor((DEPOSIT_USD / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

    const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
        lowerTick, upperTick, coinAmountA, true, false, 0, currentSqrtPrice
    );

    // Calculate APR
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
