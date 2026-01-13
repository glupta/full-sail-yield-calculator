import { NextResponse } from 'next/server';
import { fetchPoolById } from '@/lib/sdk-server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const pool = await fetchPoolById(id);

        if (!pool) {
            return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
        }

        return NextResponse.json(pool);
    } catch (error) {
        console.error('Error fetching pool:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pool', details: String(error) },
            { status: 500 }
        );
    }
}
