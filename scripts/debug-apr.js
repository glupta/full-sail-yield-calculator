const { initFullSailSDK, PositionUtils } = require('@fullsailfinance/sdk');
const sdk = initFullSailSDK({ network: 'mainnet-production' });

async function debugPool(name) {
    const result = await sdk.Pool.getList({
        filter: [{ filter_parameter: 'with_gauge', filter_type: 'accept', value_group: 'none' }],
        pagination: { page: 0, page_size: 100 },
    });

    const pool = result.pools.find(p => p.name === name);
    if (!pool) { console.log('Pool not found:', name); return; }

    console.log('=== ' + name + ' ===');

    const decimalsA = pool.token_a?.decimals || 9;
    const decimalsB = pool.token_b?.decimals || 6;
    console.log('decimals:', decimalsA, decimalsB);

    const sqrtPrice = BigInt(pool.current_sqrt_price);
    const rawPrice = Number(sqrtPrice * sqrtPrice) / (2 ** 128);
    const sdkPrice = rawPrice * Math.pow(10, decimalsA - decimalsB);
    console.log('sdkPrice:', sdkPrice);
    console.log('full_apr:', pool.full_apr);
    console.log('liquidity:', pool.liquidity);

    // Our logic
    const uiPrice = 1 / sdkPrice;
    console.log('uiPrice:', uiPrice);

    const priceLow = uiPrice * 0.75;
    const priceHigh = uiPrice * 1.25;
    console.log('UI range:', priceLow, '-', priceHigh);

    const effectivePriceLow = 1 / priceHigh;
    const effectivePriceHigh = 1 / priceLow;
    console.log('SDK range:', effectivePriceLow, '-', effectivePriceHigh);

    const depositAmount = 10000;
    const sqrtPriceLow = Math.sqrt(effectivePriceLow);
    const sqrtPriceHigh = Math.sqrt(effectivePriceHigh);
    const sqrtPriceCurrent = Math.sqrt(sdkPrice);

    const usdPricePerToken = 1 / sdkPrice;
    const amountInToken0 = depositAmount / 2;
    const amountInToken1 = (depositAmount / 2) / usdPricePerToken;

    console.log('amountInToken0 (USDC raw):', amountInToken0);
    console.log('amountInToken1 (token raw):', amountInToken1);

    const liquidityFromToken0 = amountInToken0 * sqrtPriceCurrent * sqrtPriceHigh / (sqrtPriceHigh - sqrtPriceCurrent);
    const liquidityFromToken1 = amountInToken1 / (sqrtPriceCurrent - sqrtPriceLow);
    console.log('liquidityFromToken0:', liquidityFromToken0);
    console.log('liquidityFromToken1:', liquidityFromToken1);

    const liquidity = Math.min(liquidityFromToken0, liquidityFromToken1);
    const liquidityBigInt = BigInt(Math.floor(liquidity * 1e9));
    console.log('liquidity:', liquidity, '-> BigInt:', liquidityBigInt.toString());
    console.log('pool liquidity:', pool.liquidity);
    console.log('ratio:', liquidity / Number(pool.liquidity));

    const amountA = BigInt(Math.floor(amountInToken0 * Math.pow(10, decimalsA)));
    const amountB = BigInt(Math.floor(amountInToken1 * Math.pow(10, decimalsB)));
    console.log('amountA:', amountA.toString(), 'amountB:', amountB.toString());

    const apr = PositionUtils.estimateAprByLiquidity({
        pool,
        positionActiveLiquidity: liquidityBigInt,
        positionAmountA: amountA,
        positionAmountB: amountB,
        sailPrice: 0.003,
        oSailDecimals: 9,
        rewardChoice: 'vesail',
        isNewPosition: true,
    });

    console.log('SDK APR:', apr);
}

async function main() {
    await debugPool('SUI/USDC');
    console.log();
    await debugPool('SAIL/USDC');
}

main().catch(console.error);
