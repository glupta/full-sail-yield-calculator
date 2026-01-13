import { NextResponse } from 'next/server';
import { estimateAPR, fetchPoolById, fetchSailPrice } from '@/lib/sdk-server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { poolId, priceLow, priceHigh, depositAmount, rewardChoice = 'liquid' } = body;

        if (!poolId || !priceLow || !priceHigh || !depositAmount) {
            return NextResponse.json(
                { error: 'Missing required parameters: poolId, priceLow, priceHigh, depositAmount' },
                { status: 400 }
            );
        }

        // Fetch pool and SAIL price in parallel
        const [pool, sailPrice] = await Promise.all([
            fetchPoolById(poolId),
            fetchSailPrice(),
        ]);

        if (!pool) {
            return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
        }

        const result = await estimateAPR({
            pool,
            priceLow,
            priceHigh,
            depositAmount,
            rewardChoice,
            sailPrice,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error estimating APR:', error);
        return NextResponse.json(
            { error: 'Failed to estimate APR', details: String(error) },
            { status: 500 }
        );
    }
}
