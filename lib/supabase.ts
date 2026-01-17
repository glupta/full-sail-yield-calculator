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

// Type definitions for veSAIL listings table
export interface VeSailListingRow {
    token_id: string;           // On-chain object ID (PK)
    listing_id: string;         // Tradeport listing ID
    price_mist: number;         // Price in MIST
    locked_sail: number;        // SAIL amount locked
    lock_type: string;          // 'PERM', '3.2yr', etc.
    lock_end_ts: number | null; // Unix timestamp of lock end
    updated_at?: string;        // ISO timestamp
}

/**
 * Replace all veSAIL listings (atomic refresh)
 * Deletes all existing listings and inserts new ones
 */
export async function replaceVeSailListings(listings: Omit<VeSailListingRow, 'updated_at'>[]): Promise<{ count: number; error: Error | null }> {
    if (!supabase) {
        return { count: 0, error: new Error('Supabase not configured') };
    }

    // Delete all existing listings
    const { error: deleteError } = await supabase
        .from('vesail_listings')
        .delete()
        .neq('token_id', ''); // Delete all rows

    if (deleteError) {
        return { count: 0, error: new Error(deleteError.message) };
    }

    if (listings.length === 0) {
        return { count: 0, error: null };
    }

    // Insert new listings
    const { data, error } = await supabase
        .from('vesail_listings')
        .insert(listings.map(l => ({ ...l, updated_at: new Date().toISOString() })))
        .select();

    return {
        count: data?.length ?? 0,
        error: error ? new Error(error.message) : null,
    };
}

/**
 * Fetch persisted veSAIL listings from database
 */
export async function fetchPersistedListings(): Promise<{ listings: VeSailListingRow[]; lastUpdated: Date | null }> {
    if (!supabase) {
        return { listings: [], lastUpdated: null };
    }

    const { data, error } = await supabase
        .from('vesail_listings')
        .select('*')
        .order('price_mist', { ascending: true });

    if (error) {
        console.error('Error fetching persisted listings:', error);
        return { listings: [], lastUpdated: null };
    }

    // Get the most recent updated_at
    const lastUpdated = data && data.length > 0
        ? new Date(Math.max(...data.map(d => new Date(d.updated_at!).getTime())))
        : null;

    return { listings: data ?? [], lastUpdated };
}

/**
 * Check if listings are stale (older than threshold)
 */
export async function areListingsStale(maxAgeMinutes: number = 5): Promise<boolean> {
    const { lastUpdated } = await fetchPersistedListings();

    if (!lastUpdated) {
        return true; // No listings = stale
    }

    const ageMs = Date.now() - lastUpdated.getTime();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs > maxAgeMs;
}

