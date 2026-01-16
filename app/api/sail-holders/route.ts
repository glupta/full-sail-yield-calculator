import { NextResponse } from 'next/server';
import { fetchSailHolders, formatSailQuantity, formatPercentage, SAIL_COIN_TYPE } from '../../../lib/blockvision-client';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export interface SailHolderFormatted {
    address: string;
    shortAddress: string;
    amount: number;
    percentage: string;
    percentageRaw: number;
}

export interface SailHoldersApiResponse {
    holders: SailHolderFormatted[];
    total: number;
    coinType: string;
    hasMore: boolean;
    nextCursor?: string;
    error?: string;
}

/**
 * GET /api/sail-holders
 * 
 * Query params:
 * - limit: number (default 20, max 50)
 * - cursor: string (for pagination)
 * 
 * Returns list of SAIL token holders with amounts and percentages
 */
export async function GET(request: Request): Promise<NextResponse<SailHoldersApiResponse>> {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
        const cursor = searchParams.get('cursor') || undefined;

        const response = await fetchSailHolders(limit, cursor);

        const formattedHolders: SailHolderFormatted[] = response.holders.map(h => ({
            address: h.address,
            shortAddress: `${h.address.slice(0, 6)}...${h.address.slice(-4)}`,
            amount: formatSailQuantity(h.quantity),
            percentage: formatPercentage(h.percentage),
            percentageRaw: h.percentage,
        }));

        return NextResponse.json({
            holders: formattedHolders,
            total: response.total,
            coinType: SAIL_COIN_TYPE,
            hasMore: !!response.nextCursor,
            nextCursor: response.nextCursor,
        });
    } catch (error) {
        console.error('[sail-holders] Error fetching holders:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Return empty array with error message for graceful degradation
        return NextResponse.json({
            holders: [],
            total: 0,
            coinType: SAIL_COIN_TYPE,
            hasMore: false,
            error: errorMessage,
        }, { status: errorMessage.includes('API_KEY') ? 500 : 502 });
    }
}
