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

// Full Sail gauge-enabled pool IDs (from app.fullsail.finance)
const FULLSAIL_POOL_IDS = [
    { id: '0x038eca6cc3ba17b84829ea28abac7238238364e0787ad714ac35c1140561a6b9', name: 'SAIL/USDC' },
    { id: '0x7fc2f2f3807c6e19f0d418d1aaad89e6f0e866b5e4ea10b295ca0b686b6c4980', name: 'SUI/USDC' },
    { id: '0xa7aa7807a87a771206571d3dd40e53ccbc395d7024def57b49ed9200b5b7e4e5', name: 'IKA/SUI' },
    { id: '0xf4c75d0609a2a53df0c896cfee52a33e6f11d1a70ab113ad83d89b1bfdfe002d', name: 'WBTC/USDC' },
    { id: '0x90ad474a2b0e4512e953dbe9805eb233ffe5659b93b4bb71ce56bd4110b38c91', name: 'ETH/USDC' },
    { id: '0xd1fd1d6fd6bed8c901ca483e2739ff3aa2e3cb3ef67cb2a7414b147a32adbdb0', name: 'stSUI/WAL' },
    { id: '0x6659a37fcd210fab78d1efd890fd4ca790bb260136f7934193e4607d82598b4d', name: 'stSUI/DEEP' },
    { id: '0x20e2f4d32c633be7eac9cba3b2d18b8ae188c0b639f3028915afe2af7ed7c89f', name: 'WAL/SUI' },
    { id: '0xd0dd3d7ae05c22c80e1e16639fb0d4334372a8a45a8f01c85dac662cc8850b60', name: 'DEEP/SUI' },
    { id: '0xdd212407908182e6c2c908e2749b49550f853bc52306d6849059dd3f72d0a7e3', name: 'UP/SUI' },
];

/**
 * Fetch all gauge-enabled pools
 * @returns {Promise<object[]>}
 */
export async function fetchGaugePools() {
    const sdk = await getSDK();
    if (!sdk) return [];

    try {
        // Fetch all pools in parallel
        const poolPromises = FULLSAIL_POOL_IDS.map(async ({ id, name }) => {
            try {
                // Fetch backend data (APR, TVL, etc.)
                const pool = await sdk.Pool.getById(id);

                // Also fetch chain data for current price
                let currentPrice = null;
                try {
                    const chainPool = await sdk.Pool.getByIdFromChain(id);
                    if (chainPool?.currentSqrtPrice) {
                        // Convert sqrtPrice to actual price
                        // sqrtPrice is in Q64.64 format, need to square and adjust decimals
                        const sqrtPrice = Number(chainPool.currentSqrtPrice) / (2 ** 64);
                        currentPrice = sqrtPrice * sqrtPrice;
                    }
                } catch (e) {
                    console.warn(`Failed to fetch chain price for ${name}`);
                }

                if (pool) {
                    return {
                        ...pool,
                        id,
                        name: pool.name || name,
                        token0_symbol: name.split('/')[0],
                        token1_symbol: name.split('/')[1],
                        gauge_id: pool.gauge_id || true,
                        currentPrice,
                    };
                }
                return null;
            } catch (e) {
                console.warn(`Failed to fetch pool ${name}:`, e.message);
                return null;
            }
        });

        const pools = await Promise.all(poolPromises);
        return pools.filter(Boolean);
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
