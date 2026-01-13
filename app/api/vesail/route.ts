import { NextResponse } from 'next/server';

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
        bestDiscountPct: number;
        sailSpotPriceSui: number;
    };
    recentSales: VeSailSale[];
    listings: VeSailListing[];
    lastUpdated: string;
}

export async function GET() {
    try {
        const sailSpotPrice = await fetchSailSpotPrice();

        // Fetch trades and listings from Tradeport
        const [tradesResult, listingsResult] = await Promise.all([
            graphqlQuery<{ actions: Array<{ id: string; price: number; nft_id: string; block_time: string }> }>(
                `{ sui { actions(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" }, type: { _eq: "buy" } }, limit: 100) { id price nft_id block_time } } }`
            ),
            graphqlQuery<{ listings: Array<{ id: string; price: number | null; nft_id: string }> }>(
                `{ sui { listings(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" } }, limit: 100) { id price nft_id } } }`
            ),
        ]);

        const trades = tradesResult.actions.sort((a, b) =>
            new Date(b.block_time).getTime() - new Date(a.block_time).getTime()
        );
        const activeListings = listingsResult.listings.filter(l => l.price && l.price > 0);

        // Get all NFT token IDs
        const allNftIds = [...new Set([...trades.map(t => t.nft_id), ...activeListings.map(l => l.nft_id)])];
        const nftsResult = await graphqlQuery<{ nfts: Array<{ id: string; token_id: string }> }>(
            `{ sui { nfts(where: { id: { _in: ${JSON.stringify(allNftIds)} } }) { id token_id } } }`
        );
        const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

        // Batch fetch on-chain data
        const allTokenIds = [...new Set(nftsResult.nfts.map(n => n.token_id))];
        const onChainMap = await fetchObjects(allTokenIds);

        // Process sales
        const recentSales: VeSailSale[] = [];
        let totalVolumeSui = 0;
        let totalSailTraded = 0;
        let bestDiscountPct = -Infinity;

        for (const trade of trades) {
            const tokenId = nftMap.get(trade.nft_id);
            const priceSui = trade.price / MIST_PER_SUI;
            totalVolumeSui += priceSui;

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

            totalSailTraded += lockedSail;
            if (discountPct > bestDiscountPct) bestDiscountPct = discountPct;

            recentSales.push({
                date: trade.block_time,
                priceSui,
                lockedSail,
                pricePerSail,
                discountPct,
                lockType,
            });
        }

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

        // Calculate average discount from valid sales
        const avgDiscountPct = recentSales.length > 0
            ? recentSales.reduce((sum, s) => sum + s.discountPct, 0) / recentSales.length
            : 0;

        const response: VeSailMarketData = {
            stats: {
                totalSales: trades.length,
                totalVolumeSui,
                avgDiscountPct,
                bestDiscountPct: bestDiscountPct === -Infinity ? 0 : bestDiscountPct,
                sailSpotPriceSui: sailSpotPrice,
            },
            recentSales: recentSales.slice(0, 20),
            listings,
            lastUpdated: new Date().toISOString(),
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
