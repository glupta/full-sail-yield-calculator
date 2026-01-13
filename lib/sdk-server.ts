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
 * Fetch a single pool by ID
 */
export async function fetchPoolById(poolId: string) {
    try {
        const sdk = getSDK();
        const pool = await sdk.Pool.getById(poolId);
        if (pool) return pool;
    } catch (error) {
        console.warn('getById failed, falling back to pool list:', error);
    }

    // Fallback: search in full pool list
    try {
        const pools = await fetchGaugePools();
        const pool = pools.find((p: any) => p.id === poolId || p.address === poolId);
        if (pool) return pool;
    } catch (error) {
        console.error('Pool list fallback also failed:', error);
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
    // Get current price
    const token0 = pool.token_a;
    const token1 = pool.token_b;
    const decimalsA = token0?.decimals || 9;
    const decimalsB = token1?.decimals || 6;

    const sqrtPrice = BigInt(pool.current_sqrt_price || 0);
    const rawPrice = Number(sqrtPrice * sqrtPrice) / (2 ** 128);
    const currentPrice = rawPrice * Math.pow(10, decimalsA - decimalsB);

    // Skip if current price is outside range
    if (currentPrice < priceLow || currentPrice > priceHigh) {
        return { apr: 0, outOfRange: true };
    }

    // Calculate liquidity using CLMM formula
    const sqrtPriceLow = Math.sqrt(priceLow);
    const sqrtPriceHigh = Math.sqrt(priceHigh);
    const sqrtPriceCurrent = Math.sqrt(currentPrice);

    const amountInToken0 = depositAmount / 2 / currentPrice;
    const amountInToken1 = depositAmount / 2;

    const liquidityFromToken0 = amountInToken0 * sqrtPriceCurrent * sqrtPriceHigh / (sqrtPriceHigh - sqrtPriceCurrent);
    const liquidityFromToken1 = amountInToken1 / (sqrtPriceCurrent - sqrtPriceLow);

    const liquidity = Math.min(liquidityFromToken0, liquidityFromToken1);
    const liquidityBigInt = BigInt(Math.floor(liquidity * 1e9));

    // Calculate token amounts for position
    const amountA = BigInt(Math.floor(amountInToken0 * Math.pow(10, decimalsA)));
    const amountB = BigInt(Math.floor(amountInToken1 * Math.pow(10, decimalsB)));

    // Create sail coin object
    const sailCoin = {
        current_price: sailPrice,
        decimals: 9,
    };

    try {
        const estimatedApr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityBigInt,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: sailCoin.current_price,
            oSailDecimals: sailCoin.decimals,
            rewardChoice: rewardChoice as any,
            isNewPosition: true,
        });

        return { apr: estimatedApr, outOfRange: false };
    } catch (error) {
        console.error('APR estimation error:', error);
        return { apr: 0, outOfRange: false, error: String(error) };
    }
}
