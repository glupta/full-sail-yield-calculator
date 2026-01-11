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
 * Fetch SAIL token price from the SAIL/USDC pool
 * @returns {Promise<number>} SAIL price in USD
 */
export async function fetchSailPrice() {
    try {
        const pools = await fetchGaugePools();
        const sailPool = pools.find(p => p.name === 'SAIL/USDC');
        // token_b is SAIL in this pool
        return sailPool?.token_b?.current_price || 0;
    } catch (e) {
        console.error('Failed to fetch SAIL price:', e);
        return 0;
    }
}
