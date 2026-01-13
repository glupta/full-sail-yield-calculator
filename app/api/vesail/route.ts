import { NextResponse } from 'next/server';
import {
    fetchVeSailTrades,
    fetchVeSailListings,
    fetchVeSailNfts,
    mistToSui,
    type VeSailTrade,
} from '@/lib/tradeport-client';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export interface VeSailTradeWithNft extends VeSailTrade {
    tokenId: string;
    priceInSui: number;
}

export interface VeSailMarketData {
    recentTrades: VeSailTradeWithNft[];
    activeListings: {
        count: number;
        lowestPriceSui: number | null;
        highestPriceSui: number | null;
    };
    stats: {
        totalTrades: number;
        averagePriceSui: number;
        volume24hSui: number;
        lastTradeTime: string | null;
    };
}

export async function GET() {
    try {
        // Fetch trades and listings in parallel
        const [trades, listings] = await Promise.all([
            fetchVeSailTrades(25),
            fetchVeSailListings(50),
        ]);

        // Get NFT details for all trades
        const nftIds = [...new Set(trades.map(t => t.nftId))];
        const nfts = await fetchVeSailNfts(nftIds);
        const nftMap = new Map(nfts.map(n => [n.id, n]));

        // Enrich trades with NFT data and convert prices
        const enrichedTrades: VeSailTradeWithNft[] = trades.map(trade => ({
            ...trade,
            tokenId: nftMap.get(trade.nftId)?.tokenId || '',
            priceInSui: mistToSui(trade.price),
        }));

        // Calculate listing stats (filter out null prices)
        const activeListingsWithPrice = listings.filter(l => l.price !== null && l.price > 0);
        const listingPricesSui = activeListingsWithPrice.map(l => mistToSui(l.price!));

        // Calculate trade stats
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const trades24h = enrichedTrades.filter(t => new Date(t.blockTime) > oneDayAgo);
        const volume24hSui = trades24h.reduce((sum, t) => sum + t.priceInSui, 0);
        const averagePriceSui = enrichedTrades.length > 0
            ? enrichedTrades.reduce((sum, t) => sum + t.priceInSui, 0) / enrichedTrades.length
            : 0;

        const response: VeSailMarketData = {
            recentTrades: enrichedTrades,
            activeListings: {
                count: activeListingsWithPrice.length,
                lowestPriceSui: listingPricesSui.length > 0 ? Math.min(...listingPricesSui) : null,
                highestPriceSui: listingPricesSui.length > 0 ? Math.max(...listingPricesSui) : null,
            },
            stats: {
                totalTrades: enrichedTrades.length,
                averagePriceSui,
                volume24hSui,
                lastTradeTime: enrichedTrades[0]?.blockTime || null,
            },
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
