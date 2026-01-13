/**
 * Server-side SDK wrapper for Full Sail SDK
 * This runs in Node.js (API routes) where SDK works correctly
 */

import { initFullSailSDK, PositionUtils, ClmmPoolUtil, TickMath, Decimal } from '@fullsailfinance/sdk';

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
        const result = await getSDK().Pool.getList({
            pagination: { page: 0, page_size: 100 },
        });
        const sailPool = (result.pools || []).find((p: any) => p.name === 'SAIL/USDC');
        // In SAIL/USDC, SAIL is token_b
        if (sailPool?.token_b?.current_price) {
            return sailPool.token_b.current_price;
        }
        return 0.0026; // Fallback
    } catch (error) {
        console.error('Error fetching SAIL price:', error);
        return 0.0026; // Fallback
    }
}

/**
 * Estimate APR for a position using SDK's native methods
 * This matches the working Node.js test approach exactly
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
    try {
        if (!pool || !priceLow || !priceHigh || !depositAmount) {
            return { apr: 0, outOfRange: false, error: 'Missing parameters' };
        }

        const decimalsA = pool.token_a?.decimals ?? 9;
        const decimalsB = pool.token_b?.decimals ?? 9;
        const tickSpacing = pool.tick_spacing || 60;

        const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
        if (currentSqrtPrice === 0n) {
            return { apr: 0, outOfRange: false, error: 'Invalid sqrt price' };
        }

        // Determine if token A is the stable (quote) token
        const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
        const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

        // For stablecoin-quote pools, invert prices before tick conversion
        const effectivePriceLow = isToken0Stable ? (1 / priceHigh) : priceLow;
        const effectivePriceHigh = isToken0Stable ? (1 / priceLow) : priceHigh;

        // Convert prices to ticks using SDK methods
        const lowerTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceLow), decimalsA, decimalsB, tickSpacing
        );
        const upperTick = TickMath.priceToInitializableTickIndex(
            Decimal(effectivePriceHigh), decimalsA, decimalsB, tickSpacing
        );

        // Check if current price is within range
        const currentTick = TickMath.sqrtPriceX64ToTickIndex(currentSqrtPrice);
        const inRange = currentTick >= lowerTick && currentTick <= upperTick;

        console.log('[APR Debug]', pool.name, {
            priceLow,
            priceHigh,
            isToken0Stable,
            effectivePriceLow,
            effectivePriceHigh,
            lowerTick,
            upperTick,
            currentTick,
            inRange,
        });

        if (!inRange) {
            return { apr: 0, outOfRange: true };
        }

        // Estimate token A amount from USD deposit (half goes to each token)
        const tokenAPrice = pool.token_a?.current_price || 1;
        const coinAmountA = BigInt(Math.floor((depositAmount / 2 / tokenAPrice) * Math.pow(10, decimalsA)));

        // Estimate liquidity using SDK's native method
        const { amountA, amountB, liquidityAmount } = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
            lowerTick,
            upperTick,
            coinAmountA,
            true, // isCoinA
            false, // roundUp
            0, // slippage
            currentSqrtPrice
        );

        console.log('[APR Liquidity]', pool.name, {
            tokenAPrice,
            coinAmountA: coinAmountA.toString(),
            liquidityAmount: liquidityAmount.toString(),
            amountA: amountA.toString(),
            amountB: amountB.toString(),
        });

        // Use SDK's native estimateAprByLiquidity
        const estimatedApr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityAmount,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: sailPrice,
            oSailDecimals: 6,
            rewardChoice: rewardChoice as any,
            isNewPosition: true,
        });

        console.log('[APR Result]', pool.name, estimatedApr, '%');
        return { apr: estimatedApr, outOfRange: false };
    } catch (error) {
        console.error('[APR Error]', pool?.name, error);
        return { apr: 0, outOfRange: false, error: String(error) };
    }
}
