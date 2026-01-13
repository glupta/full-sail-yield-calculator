import { NextResponse } from 'next/server';
import { fetchGaugePools, fetchSailPrice, getSDK } from '@/lib/sdk-server';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

const SAIL_DECIMALS = 6;
const EPOCH_DAYS = 7;

export interface SailInvestorMetrics {
    // Price & Market
    sailPrice: number;

    // veSAIL Lock Stats
    totalLockedSail: number;
    lockedValueUsd: number;
    lockRate: number | null; // Requires circulating supply

    // Yield Metrics  
    lastWeekFeesUsd: number;
    votingApr: number;

    // Protocol Aggregates
    totalTvl: number;
    totalVolume24h: number;
    totalFees24h: number;
    totalOsailEmissions24h: number;
    poolCount: number;

    // Derived Metrics
    feeEmissionRatio: number;
    capitalEfficiency: number; // Fees / TVL (annualized)

    // Emission Analysis
    weeklyEmissionsUsd: number;
    annualizedEmissionRate: number | null; // Requires supply

    lastUpdated: string;
}

/**
 * Fetch Full Sail protocol config from their API
 */
async function fetchProtocolConfig() {
    try {
        const res = await fetch('https://app.fullsail.finance/api/config', {
            next: { revalidate: 300 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.config;
    } catch (e) {
        console.error('Failed to fetch protocol config:', e);
        return null;
    }
}

export async function GET() {
    try {
        // Fetch all data in parallel
        const [pools, sailPrice, config] = await Promise.all([
            fetchGaugePools(),
            fetchSailPrice(),
            fetchProtocolConfig(),
        ]);

        // Aggregate pool metrics
        let totalTvl = 0;
        let totalVolume24h = 0;
        let totalFees24h = 0;
        let totalOsailEmissions24h = 0;

        for (const pool of pools) {
            const stats = pool.dinamic_stats || {};
            totalTvl += stats.tvl || 0;
            totalVolume24h += stats.volume_usd_24h || 0;
            totalFees24h += stats.fees_usd_24h || 0;

            // oSAIL emissions (stored as raw value with 6 decimals - same as SAIL)
            if (pool.distributed_osail_24h) {
                const osailAmount = Number(pool.distributed_osail_24h) / 1e6;
                totalOsailEmissions24h += osailAmount;
            }
        }

        // veSAIL metrics from config
        const votingFeesUsd = config?.voting_fees_usd || 0;
        const exerciseFeesUsd = config?.exercise_fees_usd || 0;
        const globalVotingPower = config?.global_voting_power || 0;

        const lastWeekFeesUsd = votingFeesUsd + exerciseFeesUsd;
        const totalLockedSail = globalVotingPower / Math.pow(10, SAIL_DECIMALS);
        const lockedValueUsd = totalLockedSail * sailPrice;

        // Calculate voting APR
        const votingApr = lockedValueUsd > 0
            ? (lastWeekFeesUsd / lockedValueUsd) * (365 / EPOCH_DAYS)
            : 0;

        // Emission value
        const weeklyEmissionsUsd = totalOsailEmissions24h * 7 * sailPrice;

        // Fee/Emission ratio (sustainability indicator)
        const feeEmissionRatio = weeklyEmissionsUsd > 0
            ? lastWeekFeesUsd / weeklyEmissionsUsd
            : 0;

        // Capital efficiency (annualized fee yield on TVL)
        const capitalEfficiency = totalTvl > 0
            ? (totalFees24h * 365) / totalTvl
            : 0;

        const metrics: SailInvestorMetrics = {
            sailPrice,

            totalLockedSail,
            lockedValueUsd,
            lockRate: null, // Would need circulating supply

            lastWeekFeesUsd,
            votingApr,

            totalTvl,
            totalVolume24h,
            totalFees24h,
            totalOsailEmissions24h,
            poolCount: pools.length,

            feeEmissionRatio,
            capitalEfficiency,

            weeklyEmissionsUsd,
            annualizedEmissionRate: null, // Would need total supply

            lastUpdated: new Date().toISOString(),
        };

        return NextResponse.json(metrics, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Error fetching SAIL investor metrics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch SAIL investor metrics', details: String(error) },
            { status: 500 }
        );
    }
}
