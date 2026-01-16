/**
 * Supabase Client
 * Used for persisting veSAIL trade data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Only create client if credentials are available
export const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
    return supabase !== null;
}

// Type definitions for veSAIL trades table
export interface VeSailTradeRow {
    id: string;                  // Tradeport action ID
    tx_hash: string | null;      // On-chain transaction hash
    block_time: string;          // ISO timestamp
    price_mist: number;          // Price in MIST (bigint in DB, number in JS)
    token_id: string;            // On-chain object ID
    locked_sail: number;         // SAIL amount at time of trade
    lock_type: string;           // 'PERM', '3.2yr', etc.
    lock_end_ts: number | null;  // Unix timestamp of lock end
    created_at?: string;         // ISO timestamp
}

/**
 * Insert or update veSAIL trades
 */
export async function upsertVeSailTrades(trades: Omit<VeSailTradeRow, 'created_at'>[]): Promise<{ count: number; error: Error | null }> {
    if (!supabase) {
        return { count: 0, error: new Error('Supabase not configured') };
    }

    const { data, error } = await supabase
        .from('vesail_trades')
        .upsert(trades, { onConflict: 'id' })
        .select();

    return {
        count: data?.length ?? 0,
        error: error ? new Error(error.message) : null,
    };
}

/**
 * Fetch recent veSAIL trades from database
 */
export async function fetchPersistedTrades(limit: number = 100): Promise<VeSailTradeRow[]> {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('vesail_trades')
        .select('*')
        .order('block_time', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching persisted trades:', error);
        return [];
    }

    return data ?? [];
}

/**
 * Get the most recent trade timestamp from database
 */
export async function getLatestTradeTime(): Promise<Date | null> {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('vesail_trades')
        .select('block_time')
        .order('block_time', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return null;
    }

    return new Date(data.block_time);
}

/**
 * Get existing trade IDs (for deduplication)
 */
export async function getExistingTradeIds(ids: string[]): Promise<Set<string>> {
    if (!supabase || ids.length === 0) {
        return new Set();
    }

    const { data, error } = await supabase
        .from('vesail_trades')
        .select('id')
        .in('id', ids);

    if (error || !data) {
        return new Set();
    }

    return new Set(data.map(row => row.id));
}
