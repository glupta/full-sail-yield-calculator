# Full Sail Yield Calculator - Specification

> A comprehensive yield projection tool for Full Sail Finance LPs and SAIL token buyers on Sui.

## Overview

This tool enables users to model and project yields for two personas:
1. **Liquidity Providers (LPs)**: Concentrated liquidity positions with oSAIL emission strategies
2. **SAIL Token Buyers**: veSAIL locking for voting rewards and governance

The calculator uses the `@fullsailfinance/sdk` to fetch real-time pool data, positions, and lock information.

---

## Functional Requirements

### 1. LP Yield Calculator

#### 1.1 Inputs
| Field | Type | Description |
|-------|------|-------------|
| Wallet Address | `string` | Optional. Fetches existing positions if provided |
| Pool Selection | `dropdown` | Pools fetched from SDK (gauge-enabled only) |
| Deposit Amount | `number` | USD value of LP deposit |
| Price Range | `string` | e.g., "±10% around current price" |
| Timeline | `number` | Projection horizon (default: 1 month) |
| Volatility Override | `number` | Optional annualized σ (default: derived from historical on-chain data) |
| Historical Range | `date-range` | Optional. For deriving volatility from specific period |
| oSAIL Strategy | `slider` | % to Lock vs. % to Redeem (hybrid support) |

#### 1.2 Outputs
| Metric | Description |
|--------|-------------|
| **Fee APR** | `dinamic_stats.apr` from pool |
| **SAIL Emission APR** | From `distributed_osail_24h` + rewards |
| **Total APR** | `full_apr` = fee APR + emission APRs |
| **Projected Fee Yield** | Fees earned over timeline |
| **Projected oSAIL Emissions** | oSAIL tokens earned |
| **Impermanent Loss Estimate** | Using Uniswap v3 IL formula |
| **Net Yield** | Fee yield + oSAIL value - IL |
| **oSAIL Strategy Value** | Lock portion (2x) + Redeem portion (50%) |

#### 1.3 IL Modeling
- **Formula**: Uniswap v3 concentrated liquidity IL
  ```
  IL = 2 * sqrt(P1/P0) / (1 + P1/P0) - 1
  ```
- **Volatility Source**: Historical on-chain price data (default) or user input
- **Rebalancing**: Passive (no active rebalancing assumed)
- **In-Range Time**: Assume 100% in-range for simplicity
- **Out-of-Range Warning**: Display warning if concentration is tight

#### 1.4 oSAIL Strategy Modeling
- **Lock Path**: oSAIL → veSAIL at 1:1 SAIL value (2x effective vs. redeem)
- **Redeem Path**: oSAIL → USDC at 50% spot price
- **Hybrid Slider**: User selects % lock vs. % redeem
- **Voting Yield**: Fixed global average APR assumption (no recursive modeling)

---

### 2. SAIL Token Buyer Calculator

#### 2.1 Inputs
| Field | Type | Description |
|-------|------|-------------|
| Wallet Address | `string` | Optional. Fetches existing locks if provided |
| SAIL Amount | `number` | Amount to lock |
| Lock Duration | `preset` | Assume 4 years max (permanent lock) |
| Timeline | `number` | Projection horizon (default: 1 month) |

#### 2.2 Outputs
| Metric | Description |
|--------|-------------|
| **veSAIL Amount** | Voting power received |
| **Voting Reward APR** | Global average from protocol |
| **Projected Voting Rewards** | Over timeline |
| **oSAIL Rebase Yield** | From oSAIL redemptions |
| **Total Projected Yield** | Trading fees + rebase |

#### 2.3 Voting Assumptions
- **Pool Allocation**: Global average APR (no per-pool selection)
- **Prediction Accuracy**: Ignored (assume average)
- **veSAIL Decay**: Single average APR over lock period (non-permanent locks)

---

### 3. veSAIL Secondary Market Valuation

#### 3.1 Valuation Model
- **Discounted Cash Flow (DCF)**: PV of expected voting rewards over remaining lock duration
- **Voting Power Ratio**: veSAIL/SAIL ratio
- **Output both** as separate metrics

#### 3.2 Inputs
| Field | Type | Description |
|-------|------|-------------|
| Lock ID | `string` | From user's wallet or manual input |
| Remaining Duration | `days` | Auto-fetched or input |
| Discount Rate | `number` | User-configurable (default TBD) |

#### 3.3 Data Source
- SDK `Lock` module for lock details
- Tradeport API for floor prices (future integration)

---

### 4. UI/UX Requirements

#### 4.1 Architecture
- **Unified Page**: Single page with persona toggle (LP ↔ Token Buyer)
- **Scenario Comparison**: Side-by-side comparison of up to 3 scenarios
- **Multi-Position Support**: Aggregate yields across multiple pools/positions

#### 4.2 Persistence
- **localStorage**: Save inputs for return visits

#### 4.3 Pool Selection
- **Dropdown**: Fetched from SDK (`Pool.getById`, gauge-enabled only)
- **Filter**: By TVL, APR, token pair

#### 4.4 Wallet Integration
- **Optional Address Input**: Fetch existing positions/locks
- **No Transaction Signing**: Read-only (no wallet connection required)

---

## Technical Architecture

### SDK Integration

```typescript
import { initFullSailSDK } from '@fullsailfinance/sdk';

const sdk = initFullSailSDK({ network: 'mainnet-production' });

// Pool data
const pool = await sdk.Pool.getById(poolId);        // Backend (full_apr, gauge_id)
const chainPool = await sdk.Pool.getByIdFromChain(poolId); // On-chain (currentSqrtPrice)

// Position data (if wallet provided)
const positions = await sdk.Position.getByOwner(walletAddress);

// Lock data (if wallet provided)
const locks = await sdk.Lock.getByOwner(walletAddress);

// Epoch data
const epoch = await sdk.Coin.getCurrentEpochOSail();
```

### Data Flow
```
User Input → SDK Fetch → Calculation Engine → Projected Yields → UI Render
                ↓
        Historical Data
        (for volatility)
```

### Calculation Modules
1. **IL Calculator**: Uniswap v3 formula with concentration
2. **Fee Projector**: Based on `fees_usd_24h` and TVL
3. **Emission Projector**: `distributed_osail_24h` extrapolated
4. **Lock Valuation**: DCF + voting power ratio

---

## Edge Cases

| Case | Handling |
|------|----------|
| Pool without gauge | Excluded from dropdown (gauge-only support) |
| Out-of-range position | Display warning based on volatility estimate |
| Epoch boundary | Not explicitly modeled (voting rewards aggregate) |
| Zero liquidity pool | Display warning, allow calculation |
| Expired oSAIL | Model as lock-only (cannot redeem) |

---

## Non-Goals (V1)

- ❌ Gas cost modeling
- ❌ Time-value/discount rate for oSAIL lock vs. redeem
- ❌ Per-pool voting allocation
- ❌ Prediction accuracy bonuses
- ❌ Active rebalancing strategies
- ❌ Time-series veSAIL decay projections
- ❌ Wallet connection for signing transactions

---

## Data Sources

| Data | Source | API |
|------|--------|-----|
| Pool data (TVL, APR, fees) | Full Sail Backend | `sdk.Pool.getById()` |
| Current price | On-chain | `sdk.Pool.getByIdFromChain()` |
| Positions | Backend | `sdk.Position.getByOwner()` |
| Locks | Backend | `sdk.Lock.getByOwner()` |
| Historical prices | On-chain / Indexer | TBD |
| veSAIL floor price | Tradeport API | Future integration |

---

## Success Metrics

1. **Accuracy**: Projected yields within 10% of actual over 30-day periods
2. **Usability**: User can complete projection in < 60 seconds
3. **Adoption**: 100+ unique users in first month

---

## Open Questions

1. What discount rate to use for DCF valuation of veSAIL?
2. Tradeport API access for veSAIL floor prices?
3. Historical price data source for volatility derivation?
