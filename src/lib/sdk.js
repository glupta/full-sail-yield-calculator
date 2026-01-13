/**
 * Full Sail SDK wrapper with singleton pattern and graceful loading
 */

let sdkInstance = null;
let sdkError = null;

/**
 * Initialize and return the SDK instance
 * Uses dynamic import for graceful error handling
 * @returns {Promise<object|null>} SDK instance or null on failure
 */
export async function getSDK() {
    if (sdkInstance) return sdkInstance;
    if (sdkError) return null;

    try {
        const { initFullSailSDK } = await import('@fullsailfinance/sdk');
        sdkInstance = initFullSailSDK({ network: 'mainnet-production' });
        return sdkInstance;
    } catch (e) {
        console.error('Failed to initialize Full Sail SDK:', e);
        sdkError = e;
        return null;
    }
}

/**
 * Fetch pool by ID (from backend - includes APR data)
 * @param {string} poolId 
 * @returns {Promise<object|null>}
 */
export async function fetchPool(poolId) {
    const sdk = await getSDK();
    if (!sdk) return null;

    try {
        return await sdk.Pool.getById(poolId);
    } catch (e) {
        console.error('Failed to fetch pool:', e);
        return null;
    }
}

/**
 * Fetch pool from chain (real-time price data)
 * @param {string} poolId 
 * @returns {Promise<object|null>}
 */
export async function fetchPoolFromChain(poolId) {
    const sdk = await getSDK();
    if (!sdk) return null;

    try {
        return await sdk.Pool.getByIdFromChain(poolId);
    } catch (e) {
        console.error('Failed to fetch pool from chain:', e);
        return null;
    }
}

/**
 * Fetch all Full Sail pools using sdk.Pool.getList()
 * @returns {Promise<object[]>}
 */
export async function fetchGaugePools() {
    const sdk = await getSDK();
    if (!sdk) return [];

    try {
        // Fetch all pools from the Full Sail API (pagination is 0-indexed)
        const result = await sdk.Pool.getList({
            pagination: { page: 0, page_size: 100 }
        });

        if (!result?.pools?.length) {
            console.warn('No pools returned from sdk.Pool.getList()');
            return [];
        }

        // Fetch token prices from CoinGecko for fallback/validation
        const { fetchTokenPrices, calculatePairPrice } = await import('./prices.js');
        const tokenPrices = await fetchTokenPrices();

        // Process and enrich pool data
        const enrichedPools = await Promise.all(result.pools.map(async (pool) => {
            try {
                const id = pool.address;
                const name = pool.name;

                // Extract token symbols from token_a/token_b or parse from name
                const token0_symbol = pool.token_a?.address?.split('::').pop() || name.split('/')[0];
                const token1_symbol = pool.token_b?.address?.split('::').pop() || name.split('/')[1];

                // Calculate current price from current_sqrt_price (primary method)
                let currentPrice = null;
                try {
                    if (pool.current_sqrt_price) {
                        // Convert sqrtPrice to price: price = (sqrtPrice / 2^64)^2
                        const sqrtPrice = BigInt(pool.current_sqrt_price);
                        const Q64 = BigInt(2 ** 64);
                        const priceRatio = Number(sqrtPrice) / Number(Q64);
                        const rawPrice = priceRatio * priceRatio;

                        // Get decimals from token_a and token_b
                        const decimals0 = pool.token_a?.decimals ?? 9;
                        const decimals1 = pool.token_b?.decimals ?? 9;
                        const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
                        const adjustedPrice = rawPrice * decimalAdjustment;

                        // Determine price direction (we want USD price of non-stable)
                        const isToken0Stable = token0_symbol === 'USDC' || token0_symbol === 'USDT';
                        currentPrice = isToken0Stable ? (1 / adjustedPrice) : adjustedPrice;
                    }
                } catch (e) {
                    console.warn(`Failed to calculate price for ${name}:`, e.message);
                }

                // Fallback to CoinGecko if sqrtPrice calculation unavailable
                if (!currentPrice) {
                    currentPrice = calculatePairPrice(token0_symbol, token1_symbol, tokenPrices);
                }

                return {
                    ...pool,
                    id,
                    name,
                    token0_symbol,
                    token1_symbol,
                    gauge_id: pool.gauge_id || null,
                    currentPrice,
                };
            } catch (e) {
                console.warn(`Failed to process pool ${pool.name}:`, e.message);
                return null;
            }
        }));

        return enrichedPools.filter(Boolean);
    } catch (e) {
        console.error('Failed to fetch pools:', e);
        return [];
    }
}

/**
 * Fetch positions by wallet address
 * @param {string} address 
 * @returns {Promise<object[]>}
 */
export async function fetchPositions(address) {
    const sdk = await getSDK();
    if (!sdk) return [];

    try {
        return await sdk.Position.getByOwner(address);
    } catch (e) {
        console.error('Failed to fetch positions:', e);
        return [];
    }
}

/**
 * Fetch locks by wallet address
 * @param {string} address 
 * @returns {Promise<object[]>}
 */
export async function fetchLocks(address) {
    const sdk = await getSDK();
    if (!sdk) return [];

    try {
        return await sdk.Lock.getByOwner(address);
    } catch (e) {
        console.error('Failed to fetch locks:', e);
        return [];
    }
}

/**
 * Fetch Full Sail protocol config (voting fees, global voting power, etc.)
 * Uses the Full Sail backend API directly
 * @returns {Promise<object|null>}
 */
export async function fetchConfig() {
    try {
        const res = await fetch('https://app.fullsail.finance/api/config');
        if (!res.ok) {
            console.error('Failed to fetch config:', res.status);
            return null;
        }
        const data = await res.json();
        return data.config;
    } catch (e) {
        console.error('Failed to fetch config:', e);
        return null;
    }
}

/**
 * Cached SAIL coin object for APR calculations
 */
let cachedSailCoin = null;
let sailCoinFetchPromise = null;

/**
 * Fetch SAIL coin data (with caching)
 * @returns {Promise<object|null>} SAIL coin object with current_price and decimals
 */
export async function fetchSailCoin() {
    if (cachedSailCoin) return cachedSailCoin;

    // Prevent concurrent fetches
    if (sailCoinFetchPromise) return sailCoinFetchPromise;

    sailCoinFetchPromise = (async () => {
        try {
            const pools = await fetchGaugePools();
            const sailPool = pools.find(p => p.name === 'SAIL/USDC');
            // In SAIL/USDC pool, SAIL is token_b (USDC is token_a)
            cachedSailCoin = sailPool?.token_b || null;
            return cachedSailCoin;
        } catch (e) {
            console.error('Failed to fetch SAIL coin:', e);
            return null;
        } finally {
            sailCoinFetchPromise = null;
        }
    })();

    return sailCoinFetchPromise;
}

/**
 * Fetch SAIL token price from the SAIL/USDC pool
 * @returns {Promise<number>} SAIL price in USD
 */
export async function fetchSailPrice() {
    const sailCoin = await fetchSailCoin();
    return sailCoin?.current_price || 0;
}

/**
 * Calculate estimated APR using the SDK's native PositionUtils.estimateAprByLiquidity
 * This matches the calculation used by the Full Sail webapp exactly.
 * 
 * @param {object} params - Calculation parameters
 * @param {object} params.pool - Pool data from SDK (must include dinamic_stats, token_a, token_b, etc.)
 * @param {number} params.priceLow - Lower price bound (in user-facing format, e.g. SUI price in USD)
 * @param {number} params.priceHigh - Upper price bound
 * @param {number} params.depositAmount - Deposit amount in USD
 * @param {string} params.rewardChoice - 'vesail' or 'liquid' (default: 'liquid')
 * @param {object} params.sailCoin - SAIL token object with current_price and decimals
 * @returns {Promise<number>} Estimated APR as percentage (e.g., 14.65 means 14.65%)
 */
export async function calculateEstimatedAPRFromSDK({
    pool,
    priceLow,
    priceHigh,
    depositAmount,
    rewardChoice = 'liquid',
    sailCoin,
    sailPrice: legacySailPrice  // Backward compatibility with ScenarioPanel
}) {
    try {
        const { ClmmPoolUtil, TickMath, Decimal, PositionUtils } = await import('@fullsailfinance/sdk');

        if (!pool || !priceLow || !priceHigh || !depositAmount) {
            return 0;
        }

        // Auto-fetch SAIL coin if not provided
        const effectiveSailCoin = sailCoin || await fetchSailCoin();

        const decimalsA = pool.token_a?.decimals ?? 9;
        const decimalsB = pool.token_b?.decimals ?? 9;
        const tickSpacing = pool.tick_spacing || 60;

        const currentSqrtPrice = BigInt(pool.current_sqrt_price || 0);
        if (currentSqrtPrice === 0n) {
            return 0;
        }

        // Determine if token A is the stable (quote) token - requires price inversion for ticks
        const token0Symbol = pool.token_a?.address?.split('::').pop() || '';
        const isToken0Stable = token0Symbol === 'USDC' || token0Symbol === 'USDT';

        // For stablecoin-quote pools, invert prices before tick conversion
        const effectivePriceLow = isToken0Stable ? (1 / priceHigh) : priceLow;
        const effectivePriceHigh = isToken0Stable ? (1 / priceLow) : priceHigh;

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
            console.log('[APR Debug] Position out of range, returning 0');
            return 0; // Position is out of range
        }

        // Estimate token A amount from USD deposit (half goes to each token)
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
        const effectiveSailPrice = effectiveSailCoin?.current_price || legacySailPrice || 0.0026;

        console.log('[APR Debug]', {
            poolName: pool.name,
            priceLow,
            priceHigh,
            lowerTick,
            upperTick,
            currentTick,
            tokenAPrice,
            depositAmount,
            coinAmountA: coinAmountA.toString(),
            liquidityAmount: liquidityAmount.toString(),
            sailPrice: effectiveSailPrice,
        });

        const estimatedApr = PositionUtils.estimateAprByLiquidity({
            pool,
            positionActiveLiquidity: liquidityAmount,
            positionAmountA: amountA,
            positionAmountB: amountB,
            sailPrice: effectiveSailPrice,
            oSailDecimals: effectiveSailCoin?.decimals || 6,
            rewardChoice: rewardChoice === 'vesail' ? 'vesail' : 'liquid',
            isNewPosition: true,
        });

        console.log('[APR Debug] Result:', estimatedApr, '% for', pool.name);
        return estimatedApr;
    } catch (e) {
        console.error('Failed to calculate SDK-based APR:', e);
        return 0;
    }
}
