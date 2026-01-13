/**
 * Test APR calculation for ALL gauge-enabled pools
 * Compare SDK APR vs pool.full_apr
 */
const { initFullSailSDK, PositionUtils } = require('@fullsailfinance/sdk');

async function testAllPoolsAPR() {
    const sdk = initFullSailSDK({ network: 'mainnet-production' });

    const result = await sdk.Pool.getList({
        filter: [{ filter_parameter: 'with_gauge', filter_type: 'accept', value_group: 'none' }],
        pagination: { page: 0, page_size: 100 },
    });

    console.log(`\nTesting APR for ${result.pools.length} pools...\n`);
    console.log('Pool Name'.padEnd(25), 'full_apr'.padStart(10), 'SDK APR'.padStart(12), 'Status'.padStart(10));
    console.log('-'.repeat(60));

    const SAIL_PRICE = 0.003;
    const DEPOSIT = 10000;

    for (const pool of result.pools) {
        try {
            const decimalsA = pool.token_a?.decimals || 9;
            const decimalsB = pool.token_b?.decimals || 6;

            const sqrtPrice = BigInt(pool.current_sqrt_price || 0);
            const rawPrice = Number(sqrtPrice * sqrtPrice) / (2 ** 128);
            const sdkPrice = rawPrice * Math.pow(10, decimalsA - decimalsB);

            // Detect if token_a is stable
            const token0Symbol = pool.token_a?.address?.split('::').pop()?.toUpperCase() || '';
            const isTokenAStable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

            // Calculate current price and ±25% range
            let currentPrice = sdkPrice;
            let priceLow, priceHigh;

            if (isTokenAStable) {
                // UI price is 1/sdkPrice, range needs to be inverted
                const uiPrice = 1 / sdkPrice;
                priceLow = 1 / (uiPrice * 1.25);  // Invert and swap
                priceHigh = 1 / (uiPrice * 0.75);
            } else {
                priceLow = sdkPrice * 0.75;
                priceHigh = sdkPrice * 1.25;
            }

            // Skip if price is 0 or invalid
            if (sdkPrice <= 0 || !isFinite(sdkPrice)) {
                console.log(pool.name.padEnd(25), (pool.full_apr || 0).toFixed(2).padStart(10), 'N/A'.padStart(12), 'SKIP'.padStart(10));
                continue;
            }

            // Calculate liquidity
            const sqrtPriceLow = Math.sqrt(priceLow);
            const sqrtPriceHigh = Math.sqrt(priceHigh);
            const sqrtPriceCurrent = Math.sqrt(currentPrice);

            let amountInToken0, amountInToken1;
            if (isTokenAStable) {
                const usdPrice = 1 / currentPrice;
                amountInToken0 = DEPOSIT / 2;
                amountInToken1 = (DEPOSIT / 2) / usdPrice;
            } else {
                amountInToken0 = (DEPOSIT / 2) / currentPrice;
                amountInToken1 = DEPOSIT / 2;
            }

            const liquidityFromToken0 = amountInToken0 * sqrtPriceCurrent * sqrtPriceHigh / (sqrtPriceHigh - sqrtPriceCurrent);
            const liquidityFromToken1 = amountInToken1 / (sqrtPriceCurrent - sqrtPriceLow);

            const liquidity = Math.min(liquidityFromToken0, liquidityFromToken1);
            const liquidityBigInt = BigInt(Math.floor(Math.abs(liquidity) * 1e9));

            const amountA = BigInt(Math.floor(Math.abs(amountInToken0) * Math.pow(10, decimalsA)));
            const amountB = BigInt(Math.floor(Math.abs(amountInToken1) * Math.pow(10, decimalsB)));

            const apr = PositionUtils.estimateAprByLiquidity({
                pool,
                positionActiveLiquidity: liquidityBigInt,
                positionAmountA: amountA,
                positionAmountB: amountB,
                sailPrice: SAIL_PRICE,
                oSailDecimals: 9,
                rewardChoice: 'liquid',
                isNewPosition: true,
            });

            const fullApr = pool.full_apr || 0;
            const status = apr > 0 ? 'OK' : 'FAIL';

            console.log(
                pool.name.padEnd(25),
                fullApr.toFixed(2).padStart(10),
                apr.toFixed(2).padStart(12),
                status.padStart(10)
            );
        } catch (err) {
            console.log(pool.name.padEnd(25), (pool.full_apr || 0).toFixed(2).padStart(10), 'ERR'.padStart(12), err.message.slice(0, 20).padStart(10));
        }
    }
}

testAllPoolsAPR().catch(console.error);
