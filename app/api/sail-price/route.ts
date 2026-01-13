import { NextResponse } from 'next/server';
import { fetchSailPrice } from '@/lib/sdk-server';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
    try {
        const price = await fetchSailPrice();

        return NextResponse.json({ price }, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Error fetching SAIL price:', error);
        return NextResponse.json(
            { error: 'Failed to fetch SAIL price', details: String(error) },
            { status: 500 }
        );
    }
}
