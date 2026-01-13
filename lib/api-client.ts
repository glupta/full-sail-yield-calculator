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
