/**
 * veSAIL Trade Indexer
 * Fetches trades from Tradeport and persists them with on-chain data snapshot
 * Designed to be called by a cron job or manually
 */

import { NextResponse } from 'next/server';
import {
    supabase,
    isSupabaseConfigured,
    upsertVeSailTrades,
    getExistingTradeIds,
    VeSailTradeRow
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for indexing

const TRADEPORT_ENDPOINT = 'https://api.indexer.xyz/graphql';
const API_USER = 'fullsail';
const API_KEY = 'EU0mqGq.94d60015f593fc219088316f5cd917af';
const VESAIL_COLLECTION_ID = '77489a01-e433-46e1-a7f7-b29a7a85eaa1';
const SUI_RPC = 'https://fullnode.mainnet.sui.io:443';
const SAIL_DECIMALS = 6;
const MIST_PER_SUI = 1_000_000_000;

interface TradeportTrade {
    id: string;
    price: number;
    nft_id: string;
    block_time: string;
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

function calculateLockType(fields: any): { lockType: string; lockEndTs: number | null } {
    const isPermanent = fields.permanent === true;
    const endTimestamp = parseInt(fields.end || '0');

    if (isPermanent || endTimestamp === 0) {
        return { lockType: 'PERM', lockEndTs: null };
    }

    const yearsRemaining = (endTimestamp * 1000 - Date.now()) / (365 * 24 * 60 * 60 * 1000);

    if (yearsRemaining <= 0) {
        return { lockType: 'EXPIRED', lockEndTs: endTimestamp };
    }

    return { lockType: `${yearsRemaining.toFixed(1)}yr`, lockEndTs: endTimestamp };
}

export async function GET() {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
        return NextResponse.json(
            {
                error: 'Supabase not configured',
                message: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables'
            },
            { status: 503 }
        );
    }

    try {
        // Step 1: Fetch recent trades from Tradeport
        const tradesResult = await graphqlQuery<{ actions: TradeportTrade[] }>(
            `{ sui { actions(where: { collection_id: { _eq: "${VESAIL_COLLECTION_ID}" }, type: { _eq: "buy" } }, limit: 100) { id price nft_id block_time } } }`
        );

        const trades = tradesResult.actions;
        if (trades.length === 0) {
            return NextResponse.json({ indexed: 0, total: 0, message: 'No trades found' });
        }

        // Step 2: Check which trades are already indexed
        const tradeIds = trades.map(t => t.id);
        const existingIds = await getExistingTradeIds(tradeIds);
        const newTrades = trades.filter(t => !existingIds.has(t.id));

        if (newTrades.length === 0) {
            return NextResponse.json({ indexed: 0, total: trades.length, message: 'All trades already indexed' });
        }

        // Step 3: Get NFT token IDs for new trades
        const nftIds = [...new Set(newTrades.map(t => t.nft_id))];
        const nftsResult = await graphqlQuery<{ nfts: Array<{ id: string; token_id: string }> }>(
            `{ sui { nfts(where: { id: { _in: ${JSON.stringify(nftIds)} } }) { id token_id } } }`
        );
        const nftMap = new Map(nftsResult.nfts.map(n => [n.id, n.token_id]));

        // Step 4: Fetch on-chain data for all token IDs
        const tokenIds = [...new Set(nftsResult.nfts.map(n => n.token_id))];
        const onChainMap = await fetchObjects(tokenIds);

        // Step 5: Build trade records with snapshotted data
        const tradeRecords: Omit<VeSailTradeRow, 'created_at'>[] = [];

        for (const trade of newTrades) {
            const tokenId = nftMap.get(trade.nft_id);
            if (!tokenId) continue;

            const fields = onChainMap.get(tokenId);
            if (!fields) continue;

            const lockedSail = Number(fields.amount) / Math.pow(10, SAIL_DECIMALS);

            // Even if lockedSail is 0, we still record the trade
            // This captures trades where SAIL was later withdrawn
            const { lockType, lockEndTs } = calculateLockType(fields);

            tradeRecords.push({
                id: trade.id,
                tx_hash: null, // Could be extracted from Tradeport if available
                block_time: trade.block_time,
                price_mist: trade.price,
                token_id: tokenId,
                locked_sail: lockedSail,
                lock_type: lockType,
                lock_end_ts: lockEndTs,
            });
        }

        // Step 6: Upsert to database
        const { count, error } = await upsertVeSailTrades(tradeRecords);

        if (error) {
            return NextResponse.json(
                { error: 'Failed to persist trades', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            indexed: count,
            total: trades.length,
            skipped: newTrades.length - count,
            message: `Indexed ${count} new trades`,
        });

    } catch (error) {
        console.error('Error indexing veSAIL trades:', error);
        return NextResponse.json(
            { error: 'Indexing failed', details: String(error) },
            { status: 500 }
        );
    }
}
