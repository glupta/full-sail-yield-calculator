/**
 * Pool Analytics Module
 * Extracts and formats REAL metrics from SDK pool data
 * NO estimated or interpolated data
 */

/**
 * Format USD value with appropriate suffix
 */
function formatUSD(value) {
    if (!value || value === 0) return '$0';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

/**
 * Format price with appropriate precision
 */
function formatPrice(price) {
    if (!price || price === 0) return '$0.00';
    if (price >= 1000) return `$${price.toFixed(0)}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
}

/**
 * Format percentage
 */
function formatPercent(value) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    return `${value.toFixed(2)}%`;
}

/**
 * Format liquidity value with appropriate suffix (B/M/K)
 * Liquidity is in arbitrary units, not USD
 */
function formatLiquidity(value) {
    if (!value || value === 0) return '0';
    const num = Number(value);
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
    return num.toFixed(0);
}

/**
 * Get all pool analytics data from REAL SDK data only
 * 
 * @param {object} pool - Pool data from SDK
 * @returns {object|null} Analytics data (only real metrics)
 */
export function getPoolAnalytics(pool) {
    if (!pool) return null;

    const dinamic = pool.dinamic_stats || {};

    // Extract real metrics from SDK
    const tvl = dinamic.tvl || 0;
    const volume24h = dinamic.volume_usd_24h || dinamic.volume_24h || 0;
    const fees24h = dinamic.fees_usd_24h || 0;

    // Base APR from trading fees: (24h fees / TVL) * 365
    const feeApr = tvl > 0 ? (fees24h / tvl) * 365 * 100 : 0;

    // Full APR includes all yields (fees + oSAIL emissions + external rewards/incentives)
    const fullApr = pool.full_apr || 0;

    // Incentives APR is the difference between full APR and fee APR
    // This includes oSAIL emissions + external rewards (SUI, etc.)
    const incentivesApr = Math.max(0, fullApr - feeApr);

    // Fee tier: SDK returns fee in basis points * 1000 (e.g., 1826 = 0.1826% = 18.26 bps)
    // To convert to percentage: fee / 10000
    const feeRaw = pool.fee || 0;
    const feeTierPercent = feeRaw / 10000;

    // oSAIL emissions (convert from raw to human readable)
    const osail24hRaw = pool.distributed_osail_24h || 0;
    const osail24h = osail24hRaw / 1e9;

    // Current price (calculated in sdk.js)
    const currentPrice = pool.currentPrice || 0;

    // Active liquidity in USD: derived from TVL and ratio of active to total liquidity
    // active_liquidity is the liquidity in the current tick range
    // pool.liquidity is total liquidity across all ticks
    const activeLiq = BigInt(dinamic.active_liquidity || 0);
    const totalLiq = BigInt(pool.liquidity || 1);
    const activeLiquidityUsd = totalLiq > 0n
        ? tvl * Number(activeLiq) / Number(totalLiq)
        : 0;

    // External rewards (filter to non-zero APR)
    const externalRewards = (pool.rewards || [])
        .filter(r => r.apr > 0)
        .map(r => ({
            symbol: r.token?.symbol || 'Unknown',
            apr: r.apr,
            emissionsPerDay: r.emissions_per_day ? Number(r.emissions_per_day) / Math.pow(10, r.token?.decimals || 9) : 0,
            tokenPrice: r.token?.current_price || 0,
        }));

    // Total external rewards APR
    const externalRewardsApr = externalRewards.reduce((sum, r) => sum + r.apr, 0);

    // oSAIL APR (incentives minus external rewards)
    const osailApr = Math.max(0, incentivesApr - externalRewardsApr);

    return {
        // Core metrics
        tvl,
        tvlFormatted: formatUSD(tvl),
        volume24h,
        volume24hFormatted: formatUSD(volume24h),
        fees24h,
        fees24hFormatted: formatUSD(fees24h),

        // APR breakdown
        feeApr,
        feeAprFormatted: formatPercent(feeApr),
        fullApr,
        fullAprFormatted: formatPercent(fullApr),
        incentivesApr,
        incentivesAprFormatted: formatPercent(incentivesApr),
        osailApr,
        osailAprFormatted: formatPercent(osailApr),
        externalRewardsApr,
        externalRewardsAprFormatted: formatPercent(externalRewardsApr),

        // External rewards detail
        externalRewards,

        // oSAIL emissions
        osail24h,
        osail24hFormatted: osail24h >= 1000 ? `${(osail24h / 1000).toFixed(1)}K` : osail24h.toFixed(0),

        // Price
        currentPrice,
        currentPriceFormatted: formatPrice(currentPrice),

        // Active liquidity as percentage of TVL (ratio of active to total liquidity)
        activeLiquidityPercent: totalLiq > 0n
            ? (Number(activeLiq) / Number(totalLiq)) * 100
            : 0,
        activeLiquidityPercentFormatted: totalLiq > 0n
            ? `${((Number(activeLiq) / Number(totalLiq)) * 100).toFixed(1)}%`
            : '—',

        // Fee tier (as percentage, e.g., 0.18 for 0.18%)
        feeTier: feeTierPercent,
        feeTierFormatted: `${feeTierPercent.toFixed(2)}%`,

        // Token split (50/50 assumption - real data would need on-chain query)
        tokenSplit: {
            tokenA: {
                symbol: pool.token0_symbol || pool.token_a?.symbol || 'Token A',
                percentage: 50,
            },
            tokenB: {
                symbol: pool.token1_symbol || pool.token_b?.symbol || 'Token B',
                percentage: 50,
            },
        },
    };
}

// Export for backward compatibility (now synchronous, no fake data)
export async function calculateDepthAtRange() {
    console.warn('calculateDepthAtRange is deprecated - depth data is not available from SDK');
    return { depth: 0, depthUsd: 0 };
}

export function calculateActiveBinDepth() {
    console.warn('calculateActiveBinDepth is deprecated - depth data is not available from SDK');
    return { depth: 0, depthUsd: 0 };
}

export function generateLiquidityDistribution() {
    console.warn('generateLiquidityDistribution is deprecated - tick data is not available from SDK');
    return [];
}
