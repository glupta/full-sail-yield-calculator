-- veSAIL Listings Table
-- Stores current veSAIL NFT listings with snapshotted on-chain data
-- Updated periodically by the indexer

CREATE TABLE IF NOT EXISTS vesail_listings (
    token_id TEXT PRIMARY KEY,           -- On-chain veSAIL object ID (unique per listing)
    listing_id TEXT NOT NULL,             -- Tradeport listing ID
    price_mist BIGINT NOT NULL,           -- Price in MIST (1 SUI = 1e9 MIST)
    locked_sail NUMERIC NOT NULL,         -- SAIL amount locked
    lock_type TEXT NOT NULL,              -- 'PERM', '3.2yr', 'EXPIRED', etc.
    lock_end_ts BIGINT,                   -- Unix timestamp of lock end (null if permanent)
    updated_at TIMESTAMPTZ DEFAULT NOW()  -- When this listing was last refreshed
);

-- Index for efficient price-based queries
CREATE INDEX IF NOT EXISTS idx_vesail_listings_price ON vesail_listings(price_mist ASC);

-- Index for staleness check
CREATE INDEX IF NOT EXISTS idx_vesail_listings_updated ON vesail_listings(updated_at DESC);

-- Add comment for documentation
COMMENT ON TABLE vesail_listings IS 'Current veSAIL NFT listings with on-chain data snapshot';
COMMENT ON COLUMN vesail_listings.updated_at IS 'Last time this listing was refreshed from Tradeport';
