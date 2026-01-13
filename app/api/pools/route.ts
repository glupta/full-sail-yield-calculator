import { NextResponse } from 'next/server';
import { fetchGaugePools } from '@/lib/sdk-server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
    try {
        const pools = await fetchGaugePools();

        return NextResponse.json(pools, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('Error fetching pools:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pools', details: String(error) },
            { status: 500 }
        );
    }
}
