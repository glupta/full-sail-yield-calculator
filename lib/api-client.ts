/**
 * Client-side API helper for fetching data from our API routes
 * Replaces direct SDK calls for browser compatibility
 */

export interface Pool {
    address: string;
    token_a: {
        symbol: string;
        decimals: number;
        current_price: number;
    };
    token_b: {
        symbol: string;
        decimals: number;
        current_price: number;
    };
    dinamic_stats: {
        tvl: number;
        volume_usd_24h: number;
        fees_usd_24h: number;
        apr: number;
    };
    gauge_id?: string;
    distributed_osail_24h?: string;
    rewards?: Array<{
        apr: number;
        emissions_per_day: number;
        token: {
            symbol: string;
            current_price: number;
            decimals: number;
        };
    }>;
    current_sqrt_price: string;
    fee_data: {
        fee_rate: number;
    };
}

export interface EstimateAPRParams {
    poolId: string;
    priceLow: number;
    priceHigh: number;
    depositAmount: number;
    rewardChoice?: 'liquid' | 'vesail';
}

export interface EstimateAPRResult {
    apr: number;
    outOfRange: boolean;
    error?: string;
}

/**
 * Fetch all gauge-enabled pools
 */
export async function fetchPools(): Promise<Pool[]> {
    const res = await fetch('/api/pools');
    if (!res.ok) {
        throw new Error(`Failed to fetch pools: ${res.status}`);
    }
    return res.json();
}

/**
 * Fetch a single pool by ID
 */
export async function fetchPool(poolId: string): Promise<Pool> {
    const res = await fetch(`/api/pools/${encodeURIComponent(poolId)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch pool: ${res.status}`);
    }
    return res.json();
}

/**
 * Fetch SAIL token price
 */
export async function fetchSailPrice(): Promise<number> {
    const res = await fetch('/api/sail-price');
    if (!res.ok) {
        throw new Error(`Failed to fetch SAIL price: ${res.status}`);
    }
    const data = await res.json();
    return data.price;
}

/**
 * Estimate APR for a position
 */
export async function estimateAPR(params: EstimateAPRParams): Promise<EstimateAPRResult> {
    const res = await fetch('/api/estimate-apr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        throw new Error(`Failed to estimate APR: ${res.status}`);
    }
    return res.json();
}

export interface ProtocolConfig {
    voting_fees_usd?: number;
    exercise_fees_usd?: number;
    global_voting_power?: number;
}

/**
 * Fetch Full Sail protocol config (voting fees, global voting power, etc.)
 */
export async function fetchConfig(): Promise<ProtocolConfig | null> {
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

export interface SailInvestorMetrics {
    sailPrice: number;
    circulatingSupply: number;
    totalLockedSail: number;
    lockedValueUsd: number;
    lockRate: number;
    avgLockDurationDays: number;
    lastWeekFeesUsd: number;
    votingApr: number;
    avgVotingApr: number;
    totalTvl: number;
    totalVolume24h: number;
    totalFees24h: number;
    totalOsailEmissions24h: number;
    poolCount: number;
    feeEmissionRatio: number;
    feeYield: number;
    weeklyEmissionsUsd: number;
    cumulativeEmissionsUsd: number;
    marketCap: number;
    fdv: number | null;
    lastUpdated: string;
}

/**
 * Fetch aggregated SAIL investor metrics
 */
export async function fetchSailMetrics(): Promise<SailInvestorMetrics> {
    const res = await fetch('/api/sail-metrics');
    if (!res.ok) {
        throw new Error(`Failed to fetch SAIL metrics: ${res.status}`);
    }
    return res.json();
}
