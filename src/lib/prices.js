/**
 * Token price fetcher using CoinGecko API
 * Free tier: 10-30 calls/minute, no API key required
 */

// CoinGecko IDs for common Sui tokens
const COINGECKO_IDS = {
    'SUI': 'sui',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'ETH': 'ethereum',
    'WETH': 'ethereum',
    'BTC': 'bitcoin',
    'WBTC': 'wrapped-bitcoin',
    'SAIL': null, // Not on CoinGecko yet - use fallback
    'WAL': null,
    'DEEP': null,
    'IKA': null,
    'UP': null,
    'ALKIMI': null,
    'MMT': null,
    'stSUI': 'sui', // Use SUI price as approximation
};

// Cache prices for 60 seconds
let priceCache = {};
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch token prices from CoinGecko
 * @returns {Promise<object>} Map of symbol -> USD price
 */
export async function fetchTokenPrices() {
    const now = Date.now();

    // Return cached prices if still valid
    if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
        return priceCache;
    }

    try {
        // Get unique CoinGecko IDs
        const ids = [...new Set(Object.values(COINGECKO_IDS).filter(Boolean))];
        const idsParam = ids.join(',');

        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`
        );

        if (!response.ok) {
            console.warn('CoinGecko API error:', response.status);
            return priceCache; // Return stale cache on error
        }

        const data = await response.json();

        // Map CoinGecko response to token symbols
        const prices = {};
        for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
            if (geckoId && data[geckoId]) {
                prices[symbol] = data[geckoId].usd;
            }
        }

        // Add fallback prices for tokens not on CoinGecko
        prices['USDC'] = prices['USDC'] || 1;
        prices['USDT'] = prices['USDT'] || 1;

        priceCache = prices;
        lastFetch = now;

        console.log('[Prices] Fetched from CoinGecko:', prices);
        return prices;

    } catch (e) {
        console.error('Failed to fetch prices:', e);
        return priceCache; // Return stale cache on error
    }
}

/**
 * Calculate pool pair price from token prices
 * @param {string} token0 - Base token symbol
 * @param {string} token1 - Quote token symbol  
 * @param {object} prices - Token price map
 * @returns {number|null} - Price of token0 in terms of token1
 */
export function calculatePairPrice(token0, token1, prices) {
    const price0 = prices[token0];
    const price1 = prices[token1];

    if (!price0 || !price1) return null;

    // Price = how many token1 for 1 token0
    return price0 / price1;
}

/**
 * Get USD price for a token
 * @param {string} symbol - Token symbol
 * @param {object} prices - Token price map
 * @returns {number} - USD price or 0 if unknown
 */
export function getTokenUsdPrice(symbol, prices) {
    return prices[symbol] || 0;
}
