/**
 * Server-side SDK wrapper for Full Sail SDK
 * This runs in Node.js (API routes) where SDK works correctly
 */

import { initFullSailSDK, PositionUtils } from '@fullsailfinance/sdk';

let sdkInstance: ReturnType<typeof initFullSailSDK> | null = null;

export function getSDK() {
    if (!sdkInstance) {
        sdkInstance = initFullSailSDK({ network: 'mainnet-production' });
    }
    return sdkInstance;
}

/**
 * Fetch all gauge-enabled pools with normalized field names
 */
export async function fetchGaugePools() {
    const sdk = getSDK();

    const result = await sdk.Pool.getList({
        filter: [{
            filter_parameter: 'with_gauge',
            filter_type: 'accept',
            value_group: 'none'
        }],
        pagination: { page: 0, page_size: 100 },
    });

    // Normalize and enrich pool data
    const pools = (result.pools || []).map((pool: any) => {
        const name = pool.name || '';
        const token0_symbol = pool.token_a?.address?.split('::').pop() || name.split('/')[0] || 'Unknown';
        const token1_symbol = pool.token_b?.address?.split('::').pop() || name.split('/')[1] || 'Unknown';

        // Calculate current price from sqrt_price
        let currentPrice = null;
        try {
            if (pool.current_sqrt_price) {
                const sqrtPrice = BigInt(pool.current_sqrt_price);
                const Q64 = BigInt(2 ** 64);
                const priceRatio = Number(sqrtPrice) / Number(Q64);
                const rawPrice = priceRatio * priceRatio;

                const decimals0 = pool.token_a?.decimals ?? 9;
                const decimals1 = pool.token_b?.decimals ?? 9;
                const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
                const adjustedPrice = rawPrice * decimalAdjustment;

                // Invert if token0 is the stable
                const isToken0Stable = token0_symbol === 'USDC' || token0_symbol === 'USDT';
                currentPrice = isToken0Stable ? (1 / adjustedPrice) : adjustedPrice;
            }
        } catch (e) {
            console.warn(`Failed to calculate price for ${name}:`, e);
        }

        return {
            ...pool,
            id: pool.address,
            name,
            token0_symbol,
            token1_symbol,
            currentPrice,
            gauge_id: pool.gauge_id || null,
        };
    });

    // Sort by name for consistent ordering
    pools.sort((a: any, b: any) => {
        const nameA = `${a.token0_symbol}/${a.token1_symbol}`;
        const nameB = `${b.token0_symbol}/${b.token1_symbol}`;
        return nameA.localeCompare(nameB);
    });

    return pools;
}

/**
 * Fetch a single pool by ID (raw SDK format, needed for APR calculation)
 */
export async function fetchPoolById(poolId: string) {
    const sdk = getSDK();

    // First, try getById
    try {
        const pool = await sdk.Pool.getById(poolId);
        if (pool) return pool;
    } catch (error) {
        console.warn('getById failed:', error);
    }

    // Fallback: search in RAW pool list (not normalized) to preserve all SDK fields
    try {
        const result = await sdk.Pool.getList({
            filter: [{
                filter_parameter: 'with_gauge',
                filter_type: 'accept',
                value_group: 'none'
            }],
            pagination: { page: 0, page_size: 100 },
        });

        const pool = (result.pools || []).find((p: any) => p.address === poolId);
        if (pool) {
            console.log('Found pool in raw list:', pool.name);
            return pool;
        }
    } catch (error) {
        console.error('Raw pool list fallback also failed:', error);
    }

    return null;
}

/**
 * Fetch SAIL price from SAIL/USDC pool
 */
export async function fetchSailPrice(): Promise<number> {
    try {
        const SAIL_USDC_POOL = '0x5a5c13667690746ede9b697a51f5c7970e3d2b2eeaf25e0056ebe244fc52e029';
        const pool = await fetchPoolById(SAIL_USDC_POOL);
        if (pool?.token_a?.current_price) {
            return pool.token_a.current_price;
        }
        // Fallback: try to get from pool list
        const pools = await fetchGaugePools();
        const sailPool = pools.find((p: any) => p.name === 'SAIL/USDC');
        if (sailPool?.token_b?.current_price) {
            return sailPool.token_b.current_price;
        }
        return 0.0026; // Known fallback price
    } catch (error) {
        console.error('Error fetching SAIL price:', error);
        return 0.0026; // Fallback
    }
}

/**
 * Estimate APR for a position using SDK's native method
 */
export async function estimateAPR({
    pool,
    priceLow,
    priceHigh,
    depositAmount,
    rewardChoice = 'liquid' as any,
    sailPrice,
}: {
    pool: any;
    priceLow: number;
    priceHigh: number;
    depositAmount: number;
    rewardChoice?: 'liquid' | 'vesail';
    sailPrice: number;
}) {
    // Get current price from sqrt_price (SDK's native format)
    const token0 = pool.token_a;
    const token1 = pool.token_b;
    const decimalsA = token0?.decimals ?? 9;
    const decimalsB = token1?.decimals ?? 6;

    const sqrtPrice = BigInt(pool.current_sqrt_price || 0);
    const rawPrice = Number(sqrtPrice * sqrtPrice) / (2 ** 128);
    const sdkPrice = rawPrice * Math.pow(10, decimalsA - decimalsB);

    // Validate price
    if (!sdkPrice || sdkPrice <= 0 || !isFinite(sdkPrice)) {
        console.warn('[APR] Invalid SDK price:', sdkPrice, 'for pool:', pool.name);
        return { apr: 0, outOfRange: false, error: 'Invalid price data' };
    }

    // Check if token_a is a stable coin - if so, prices need to be inverted
    // UI shows price as "BTC in USDC" (e.g., 91000), but SDK has it as "USDC in BTC" (e.g., 0.0000109)
    const token0Symbol = pool.token_a?.address?.split('::').pop()?.toUpperCase() || '';
    const isTokenAStable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

    // Use SDK's native price for calculations
    let currentPrice = sdkPrice;
    let effectivePriceLow: number;
    let effectivePriceHigh: number;

    if (isTokenAStable) {
        // Convert user's price range to SDK format: invert and swap low/high
        // User thinks in "91000 BTC/USDC", SDK thinks in "0.0000109 USDC/BTC"
        effectivePriceLow = 1 / priceHigh;
        effectivePriceHigh = 1 / priceLow;
    } else {
        effectivePriceLow = priceLow;
        effectivePriceHigh = priceHigh;
    }

    // Validate price range
    if (effectivePriceLow <= 0 || effectivePriceHigh <= 0 || effectivePriceLow >= effectivePriceHigh) {
        console.warn('[APR] Invalid price range:', { effectivePriceLow, effectivePriceHigh, priceLow, priceHigh, isTokenAStable });
        return { apr: 0, outOfRange: false, error: 'Invalid price range' };
    }

    // Skip if current price is outside range
    if (currentPrice < effectivePriceLow || currentPrice > effectivePriceHigh) {
        console.log('[APR] Out of range:', currentPrice, 'not in', effectivePriceLow, '-', effectivePriceHigh);
        return { apr: 0, outOfRange: true };
    }

    // Calculate liquidity using CLMM formula
    const sqrtPriceLow = Math.sqrt(effectivePriceLow);
    const sqrtPriceHigh = Math.sqrt(effectivePriceHigh);
    const sqrtPriceCurrent = Math.sqrt(currentPrice);

    // Validate sqrt calculations
    if (sqrtPriceHigh - sqrtPriceCurrent <= 0 || sqrtPriceCurrent - sqrtPriceLow <= 0) {
        console.warn('[APR] Price too close to bounds, edge case');
        return { apr: 0, outOfRange: true, error: 'Price at range boundary' };
    }

    // Calculate token amounts based on token ordering
    let amountInToken0: number;
    let amountInToken1: number;

    if (isTokenAStable) {
        // For stable token_a (e.g., USDC/WBTC where USDC is token_a):
        // - token_a (USDC) gets half the deposit directly
        // - token_b (BTC) gets half the deposit divided by USD price
        const usdPrice = 1 / currentPrice;  // Convert SDK price to USD-per-token
        amountInToken0 = depositAmount / 2;  // USDC amount in raw units
        amountInToken1 = (depositAmount / 2) / usdPrice;  // BTC amount = USD / (USD per BTC)
    } else {
        // Normal ordering (e.g., SAIL/USDC where SAIL is token_a)
        amountInToken0 = (depositAmount / 2) / currentPrice;
        amountInToken1 = depositAmount / 2;
    }

    const liquidityFromToken0 = amountInToken0 * sqrtPriceCurrent * sqrtPriceHigh / (sqrtPriceHigh - sqrtPriceCurrent);
    const liquidityFromToken1 = amountInToken1 / (sqrtPriceCurrent - sqrtPriceLow);

    // Take the min liquidity, but ensure it's positive
    const liquidity = Math.min(Math.abs(liquidityFromToken0), Math.abs(liquidityFromToken1));

    if (liquidity <= 0 || !isFinite(liquidity)) {
        console.warn('[APR] Invalid liquidity calculation:', { liquidityFromToken0, liquidityFromToken1, liquidity });
        return { apr: 0, outOfRange: false, error: 'Liquidity calculation failed' };
    }

    const liquidityBigInt = BigInt(Math.floor(liquidity * 1e9));

    // Calculate token amounts for position
    const amountA = BigInt(Math.floor(Math.abs(amountInToken0) * Math.pow(10, decimalsA)));
    const amountB = BigInt(Math.floor(Math.abs(amountInToken1) * Math.pow(10, decimalsB)));

    console.log('[APR Debug]', pool.name, {
        sdkPrice,
        isTokenAStable,
        effectivePriceLow,
        effectivePriceHigh,
        liquidity: liquidity.toExponential(3),
        amountA: amountA.toString(),
        amountB: amountB.toString(),
    });

    try {
        const estimatedApr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityBigInt,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: sailPrice,
            oSailDecimals: 9,
            rewardChoice: rewardChoice as any,
            isNewPosition: true,
        });

        console.log('[APR Result]', pool.name, estimatedApr);
        return { apr: estimatedApr, outOfRange: false };
    } catch (error) {
        console.error('[APR Error]', pool.name, error);
        return { apr: 0, outOfRange: false, error: String(error) };
    }
}
