/**
 * Test APR parity between SDK and Full Sail App
 * Run: node test-apr-parity.mjs
 */

import { initFullSailSDK, ClmmPoolUtil, TickMath, Decimal, PositionUtils } from '@fullsailfinance/sdk';

const sdk = initFullSailSDK({ network: 'mainnet-production' });

// Presets matching Full Sail app observations
const APP_PRESETS = {
    full: { name: 'Full Range', low: 0.001, high: 1000 },
    wide: { name: 'Wide (-50%, +100%)', low: 0.50, high: 2.00 },
    balanced: { name: 'Recommended', low: 0.75, high: 1.33 },
    custom10: { name: 'Custom (±10%)', low: 0.90, high: 1.10 },
    narrow: { name: 'Narrow (±1%)', low: 0.99, high: 1.01 },
};

// Expected values from Full Sail app for SUI/USDC
const EXPECTED_SUI_USDC = {
    full: 14.12,
    wide: 47,
    balanced: 411,
    custom10: 282,
    narrow: 2814,
};

async function testPool(poolName, expected) {
    const result = await sdk.Pool.getList({ pagination: { page: 0, page_size: 100 } });
    const pool = result.pools.find(p => p.name === poolName);
    const sailPool = result.pools.find(p => p.name === 'SAIL/USDC');
    const sailCoin = sailPool?.token_b;

    if (!pool) { console.log('Pool not found:', poolName); return; }

    const decimalsA = pool.token_a?.decimals ?? 9;
    const decimalsB = pool.token_b?.decimals ?? 9;
    const tickSpacing = pool.tick_spacing || 60;
    const currentSqrtPrice = BigInt(pool.current_sqrt_price);

    // Get current price
    const sqrtPrice = BigInt(pool.current_sqrt_price);
    const Q64 = BigInt(2n ** 64n);
    const rawPrice = Math.pow(Number(sqrtPrice) / Number(Q64), 2);
    const adjustedPrice = rawPrice * Math.pow(10, decimalsA - decimalsB);

    const token0 = pool.token_a?.address?.split('::').pop();
    const isToken0Stable = token0 === 'USDC' || token0 === 'USDT';
    const currentPrice = isToken0Stable ? 1 / adjustedPrice : adjustedPrice;

    console.log('=== ' + poolName + ' ===');
    console.log('Current price: $' + currentPrice.toFixed(4));
    console.log('pool.full_apr:', pool.full_apr?.toFixed(1) + '%');
    console.log('');
    console.log('Preset'.padEnd(25), 'SDK APR'.padStart(10), 'Expected'.padStart(10), 'Ratio'.padStart(8));
    console.log('-'.repeat(55));

    for (const [key, preset] of Object.entries(APP_PRESETS)) {
        const priceLow = currentPrice * preset.low;
        const priceHigh = currentPrice * preset.high;

        const effectivePriceLow = isToken0Stable ? 1 / priceHigh : priceLow;
        const effectivePriceHigh = isToken0Stable ? 1 / priceLow : priceHigh;

        const lowerTick = TickMath.priceToInitializableTickIndex(Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing);
        const upperTick = TickMath.priceToInitializableTickIndex(Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing);
        const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);

        if (currentTick < lowerTick || currentTick > upperTick) {
            console.log(preset.name.padEnd(25), 'OUT OF RANGE'.padStart(10));
            continue;
        }

        const tokenAPrice = pool.token_a?.current_price || 1;
        const coinAmountA = BigInt(Math.floor((10000 / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

        const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
            lowerTick, upperTick, coinAmountA, true, false, 0, currentSqrtPrice
        );

        const apr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityAmount,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: sailCoin?.current_price || 0.002,
            oSailDecimals: sailCoin?.decimals || 6,
            rewardChoice: 'liquid',
            isNewPosition: true,
        });

        const expectedVal = expected?.[key];
        const ratio = expectedVal ? (apr / expectedVal).toFixed(2) + 'x' : 'N/A';
        console.log(preset.name.padEnd(25), (apr.toFixed(1) + '%').padStart(10), (expectedVal ? expectedVal + '%' : 'N/A').padStart(10), ratio.padStart(8));
    }
}

async function main() {
    console.log('Testing SDK APR vs Full Sail App Expected Values\n');
    await testPool('SUI/USDC', EXPECTED_SUI_USDC);
}

main().catch(console.error);
