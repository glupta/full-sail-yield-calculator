import { NextResponse } from 'next/server';
import { fetchPersistedTrades, isSupabaseConfigured, VeSailTradeRow } from '@/lib/supabase';

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
function tradeRowToSale(row: VeSailTradeRow, sailSpotPrice: number): VeSailSale | null {
    const priceSui = row.price_mist / MIST_PER_SUI;
    const lockedSail = row.locked_sail;

    // Skip trades with 0 SAIL (shouldn't happen with DB, but safety check)
    if (lockedSail <= 0) return null;

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
                    if (sale) {
                        recentSales.push(sale);
                        totalVolumeSui += sale.priceSui;
                    }
                }
            }
        }

        // Fetch LIVE listings from Tradeport (always fresh - these change frequently)
        const listingsResult = await graphqlQuery<{ listings: Array<{ id: string; price: number | null; nft_id: string }> }>(
            `{ sui { listings(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" } }, limit: 100) { id price nft_id } } }`
        );

        const activeListings = listingsResult.listings.filter(l => l.price && l.price > 0);

        // Get NFT token IDs for listings
        const nftIds = [...new Set(activeListings.map(l => l.nft_id))];
        let nftMap = new Map<string, string>();

        if (nftIds.length > 0) {
            const nftsResult = await graphqlQuery<{ nfts: Array<{ id: string; token_id: string }> }>(
                `{ sui { nfts(where: { id: { _in: ${JSON.stringify(nftIds)} } }) { id token_id } } }`
            );
            nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));
        }

        // Fetch on-chain data for listings
        const tokenIds = [...new Set([...nftMap.values()])];
        const onChainMap = await fetchObjects(tokenIds);

        // Process listings
        const listings: VeSailListing[] = [];

        for (const listing of activeListings) {
            const tokenId = nftMap.get(listing.nft_id);
            const priceSui = listing.price! / MIST_PER_SUI;

            if (!tokenId) continue;
            const fields = onChainMap.get(tokenId);
            if (!fields) continue;

            const lockedSail = Number(fields.amount) / Math.pow(10, SAIL_DECIMALS);
            if (lockedSail <= 0) continue;

            const isPermanent = fields.permanent === true;
            const endTimestamp = parseInt(fields.end || '0');
            const pricePerSail = priceSui / lockedSail;
            const discountPct = ((sailSpotPrice - pricePerSail) / sailSpotPrice) * 100;

            let lockType: string = 'PERM';
            if (!isPermanent && endTimestamp > 0) {
                const yearsRemaining = (new Date(endTimestamp * 1000).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
                lockType = yearsRemaining > 0 ? `${yearsRemaining.toFixed(1)}yr` : 'EXPIRED';
            }

            listings.push({
                tokenId,
                priceSui,
                lockedSail,
                pricePerSail,
                discountPct,
                lockType,
                tradeportUrl: `https://www.tradeport.xyz/sui/collection/${encodeURIComponent(VESAIL_COLLECTION_SLUG)}?tokenId=${tokenId}`,
            });
        }

        // Sort listings by best deal (highest discount / lowest premium)
        listings.sort((a, b) => b.discountPct - a.discountPct);

        // Find best listing (highest discount = best deal)
        const bestListing = listings.length > 0 ? listings[0] : null;

        // Calculate average discount from valid sales
        const avgDiscountPct = recentSales.length > 0
            ? recentSales.reduce((sum, s) => sum + s.discountPct, 0) / recentSales.length
            : 0;

        // Calculate weighted average discount (weighted by SAIL amount)
        const totalSailWeight = recentSales.reduce((sum, s) => sum + s.lockedSail, 0);
        const weightedAvgDiscountPct = totalSailWeight > 0
            ? recentSales.reduce((sum, s) => sum + s.discountPct * s.lockedSail, 0) / totalSailWeight
            : 0;

        // Best discount from historical trades
        const bestHistoricalDiscount = recentSales.length > 0
            ? Math.max(...recentSales.map(s => s.discountPct))
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
