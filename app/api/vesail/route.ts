import { NextResponse } from 'next/server';
import { fetchPersistedTrades, isSupabaseConfigured, VeSailTradeRow, fetchPersistedListings, VeSailListingRow } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';

const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const VESAIL_COLLECTION_SLUG = '0xe616397e503278d406e184d2258bcbe7a263d0192cc0848de2b54b518165f832::voting_escrow::Lock';
const SAIL_DECIMALS = 6; // SAIL uses 6 decimals, not 9
const MIST_PER_SUI = 1_000_000_000;

// Fetch SAIL spot price from Full Sail pool
async function fetchSailSpotPrice(): Promise<number> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sail-price`);
        if (response.ok) {
            const data = await response.json();
            // Convert USD price to SUI price (approximate)
            const suiPriceUsd = 1.82; // TODO: fetch dynamically
            return data.price / suiPriceUsd;
        }
    } catch (e) {
        console.warn('Failed to fetch SAIL price:', e);
    }
    return 0.00112; // Fallback: ~$0.00204 at $1.82/SUI
}

async function graphqlQuery<T>(query: string): Promise<T> {
    const response = await fetch(TRADEPORT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-user': API_USER,
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`Tradeport API error: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    return result.data.sui;
}

async function fetchObjects(objectIds: string[]): Promise<Map<string, any>> {
    if (objectIds.length === 0) return new Map();

    const response = await fetch(SUI_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_multiGetObjects',
            params: [objectIds, { showContent: true }],
        }),
    });

    const result = await response.json();
    const map = new Map<string, any>();

    for (const obj of result.result || []) {
        if (obj?.data?.objectId && obj?.data?.content?.fields) {
            map.set(obj.data.objectId, obj.data.content.fields);
        }
    }

    return map;
}

export interface VeSailSale {
    date: string;
    priceSui: number;
    lockedSail: number;
    pricePerSail: number;
    discountPct: number;
    lockType: 'PERM' | string;
}

export interface VeSailListing {
    tokenId: string;
    priceSui: number;
    lockedSail: number;
    pricePerSail: number;
    discountPct: number;
    lockType: 'PERM' | string;
    tradeportUrl: string;
}

export interface VeSailMarketData {
    stats: {
        totalSales: number;
        totalVolumeSui: number;
        avgDiscountPct: number;
        weightedAvgDiscountPct: number;
        veSailPriceInSail: number; // veSAIL price in SAIL terms (weighted avg from trades)
        bestDiscountPct: number;
        sailSpotPriceSui: number;
        // New: Best listing stats
        bestListingPricePerSail: number | null;
        bestListingDiscountPct: number | null;
        bestListingPriceSui: number | null;
    };
    recentSales: VeSailSale[];
    listings: VeSailListing[];
    lastUpdated: string;
    dataSource: 'database' | 'live' | 'fallback';
}

/**
 * Convert persisted trade row to VeSailSale format
 */
function tradeRowToSale(row: VeSailTradeRow, sailSpotPrice: number): VeSailSale {
    const priceSui = row.price_mist / MIST_PER_SUI;
    const lockedSail = row.locked_sail;

    // Handle UNAVAILABLE trades (data was not captured in time)
    if (lockedSail <= 0) {
        return {
            date: row.block_time,
            priceSui,
            lockedSail: 0,
            pricePerSail: 0,
            discountPct: 0,
            lockType: 'UNAVAILABLE',
        };
    }

    const pricePerSail = priceSui / lockedSail;
    const discountPct = ((sailSpotPrice - pricePerSail) / sailSpotPrice) * 100;

    return {
        date: row.block_time,
        priceSui,
        lockedSail,
        pricePerSail,
        discountPct,
        lockType: row.lock_type,
    };
}

export async function GET() {
    try {
        const sailSpotPrice = await fetchSailSpotPrice();
        let dataSource: 'database' | 'live' | 'fallback' = 'live';

        // Try to fetch persisted trades from database first
        let recentSales: VeSailSale[] = [];
        let totalVolumeSui = 0;

        if (isSupabaseConfigured()) {
            const dbTrades = await fetchPersistedTrades(100);

            if (dbTrades.length > 0) {
                dataSource = 'database';

                for (const row of dbTrades) {
                    const sale = tradeRowToSale(row, sailSpotPrice);
                    recentSales.push(sale);
                    // Only count volume for available trades
                    if (sale.lockType !== 'UNAVAILABLE') {
                        totalVolumeSui += sale.priceSui;
                    }
                }
            }
        }

        // Fetch LISTINGS from database (persisted by indexer)
        const listings: VeSailListing[] = [];

        if (isSupabaseConfigured()) {
            const { listings: dbListings } = await fetchPersistedListings();

            for (const row of dbListings) {
                const priceSui = row.price_mist / MIST_PER_SUI;
                const lockedSail = row.locked_sail;

                if (lockedSail <= 0) continue;

                const pricePerSail = priceSui / lockedSail;
                const discountPct = ((sailSpotPrice - pricePerSail) / sailSpotPrice) * 100;

                listings.push({
                    tokenId: row.token_id,
                    priceSui,
                    lockedSail,
                    pricePerSail,
                    discountPct,
                    lockType: row.lock_type,
                    tradeportUrl: `https://www.tradeport.xyz/sui/collection/${encodeURIComponent(VESAIL_COLLECTION_SLUG)}?tokenId=${row.token_id}`,
                });
            }
        }

        // Sort listings by best deal (highest discount / lowest premium)
        listings.sort((a, b) => b.discountPct - a.discountPct);

        // Find best listing (highest discount = best deal)
        const bestListing = listings.length > 0 ? listings[0] : null;

        // Only include available trades in stats calculations
        const availableSales = recentSales.filter(s => s.lockType !== 'UNAVAILABLE');

        // Calculate average discount from valid sales
        const avgDiscountPct = availableSales.length > 0
            ? availableSales.reduce((sum, s) => sum + s.discountPct, 0) / availableSales.length
            : 0;

        // Calculate weighted average discount (weighted by SAIL amount)
        const totalSailWeight = availableSales.reduce((sum, s) => sum + s.lockedSail, 0);
        const weightedAvgDiscountPct = totalSailWeight > 0
            ? availableSales.reduce((sum, s) => sum + s.discountPct * s.lockedSail, 0) / totalSailWeight
            : 0;

        // Best discount from historical trades
        const bestHistoricalDiscount = availableSales.length > 0
            ? Math.max(...availableSales.map(s => s.discountPct))
            : 0;

        // veSAIL price in SAIL terms: if discount is 20%, veSAIL = 0.8 SAIL
        const veSailPriceInSail = 1 - (weightedAvgDiscountPct / 100);

        const response: VeSailMarketData = {
            stats: {
                totalSales: recentSales.length,
                totalVolumeSui,
                avgDiscountPct,
                weightedAvgDiscountPct,
                veSailPriceInSail,
                bestDiscountPct: bestHistoricalDiscount,
                sailSpotPriceSui: sailSpotPrice,
                // Best current listing
                bestListingPricePerSail: bestListing?.pricePerSail ?? null,
                bestListingDiscountPct: bestListing?.discountPct ?? null,
                bestListingPriceSui: bestListing?.priceSui ?? null,
            },
            recentSales: recentSales.slice(0, 20),
            listings,
            lastUpdated: new Date().toISOString(),
            dataSource,
        };

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Error fetching veSAIL market data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch veSAIL market data', details: String(error) },
            { status: 500 }
        );
    }
}
