-- veSAIL Trades Table
-- Stores historical veSAIL NFT trades with snapshotted on-chain data
-- This avoids the issue where on-chain data changes after a trade (e.g., SAIL is withdrawn)

CREATE TABLE IF NOT EXISTS vesail_trades (
    id TEXT PRIMARY KEY,              -- Tradeport action ID (unique per trade)
    tx_hash TEXT,                     -- On-chain transaction hash (if available)
    block_time TIMESTAMPTZ NOT NULL,  -- When the trade occurred
    price_mist BIGINT NOT NULL,       -- Price in MIST (1 SUI = 1e9 MIST)
    token_id TEXT NOT NULL,           -- On-chain veSAIL object ID
    locked_sail NUMERIC NOT NULL,     -- SAIL amount at time of trade (6 decimals)
    lock_type TEXT NOT NULL,          -- 'PERM', '3.2yr', 'EXPIRED', etc.
    lock_end_ts BIGINT,               -- Unix timestamp of lock end (null if permanent)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient time-based queries (recent trades)
CREATE INDEX IF NOT EXISTS idx_vesail_trades_block_time ON vesail_trades(block_time DESC);

-- Index for looking up trades by token
CREATE INDEX IF NOT EXISTS idx_vesail_trades_token_id ON vesail_trades(token_id);

-- Add comment for documentation
COMMENT ON TABLE vesail_trades IS 'Historical veSAIL NFT trades with snapshotted on-chain data at time of trade';
COMMENT ON COLUMN vesail_trades.locked_sail IS 'Amount of SAIL locked at time of trade - captured immediately to avoid post-trade changes';
COMMENT ON COLUMN vesail_trades.lock_type IS 'PERM for permanent locks, or remaining duration like 3.2yr, EXPIRED for past locks';
