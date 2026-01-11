# Full Sail Yield Calculator - Product Requirements Document

## Executive Summary

The Full Sail Yield Calculator is a web-based tool that enables users to project and compare yields for liquidity provision and token locking strategies on Full Sail Finance, a ve(4,4) DEX on Sui.

---

## Problem Statement

Full Sail's ve(4,4) mechanism offers complex yield opportunities:
- LPs earn trading fees + oSAIL emissions
- oSAIL can be locked (2x value) or redeemed (50%)
- veSAIL holders earn voting rewards + rebase

Users currently lack tools to model these tradeoffs and project returns.

---

## Target Users

| Persona | Needs |
|---------|-------|
| **LP** | Understand net yield after IL, compare oSAIL strategies |
| **Token Buyer** | Project locking rewards, value veSAIL position |
| **Trader** | Evaluate veSAIL on secondary market |

---

## User Stories

### LP Calculator
1. As an LP, I want to **select a pool** and see projected yields based on my deposit
2. As an LP, I want to **compare lock vs. redeem** strategies for oSAIL
3. As an LP, I want to **estimate impermanent loss** based on my concentration
4. As an LP, I want to **aggregate yields** across multiple positions

### Token Buyer Calculator
1. As a buyer, I want to **project voting rewards** for locking SAIL
2. As a buyer, I want to **value my veSAIL** position for secondary sale
3. As a buyer, I want to **see the effective APR** for different lock durations

---

## Feature Specifications

### F1: Pool Selection
- **Dropdown** populated from SDK (gauge-enabled pools only)
- **Filters**: TVL, APR, token pair
- **Pool Card**: Shows TVL, `full_apr`, fee tier

### F2: LP Yield Projection
- **Inputs**: Deposit amount, price range (±%), timeline, volatility override
- **Outputs**: Fee yield, oSAIL emissions, IL estimate, net yield
- **Visualization**: Stacked bar chart of yield components

### F3: oSAIL Strategy Slider
- **Slider**: 0-100% lock vs. redeem
- **Preset buttons**: "100% Lock", "100% Redeem", "50/50"
- **Impact display**: Shows value difference in real-time

### F4: Scenario Comparison
- **Add Scenario**: Button to create alternate configuration
- **Side-by-side**: Up to 3 scenarios displayed
- **Highlight**: Best scenario indicated

### F5: Token Buyer Projection
- **Inputs**: SAIL amount, lock duration (default 4 years)
- **Outputs**: veSAIL amount, voting APR, projected rewards

### F6: veSAIL Valuation
- **DCF Model**: PV of voting rewards over remaining lock
- **Voting Power Ratio**: veSAIL/SAIL
- **Inputs**: Discount rate (user-configurable)

### F7: Multi-Position Aggregation
- **Wallet input**: Fetches all positions/locks
- **Aggregate view**: Total yields across positions
- **Per-position breakdown**: Expandable rows

### F8: Data Persistence
- **localStorage**: Save inputs on change
- **Restore**: Pre-fill on return visit
- **Clear**: Button to reset all inputs

---

## UI/UX Wireframe Spec

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [LP Yields]  [Token Buyer]              [Address: 0x...]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Pool Selection  │  │ Scenario 1     │ Scenario 2     │  │
│  │ [Dropdown ▼]    │  │                │                │  │
│  │                 │  │ Deposit: $X    │ Deposit: $Y    │  │
│  │ Pool Stats:     │  │ Range: ±10%    │ Range: ±5%     │  │
│  │ TVL: $X         │  │ Timeline: 30d  │ Timeline: 30d  │  │
│  │ APR: X%         │  │                │                │  │
│  │ Fee: X%         │  │ oSAIL Strategy │ oSAIL Strategy │  │
│  │                 │  │ [█████░░░] 70% │ [███░░░░░] 40% │  │
│  └─────────────────┘  │                │                │  │
│                       ├────────────────┼────────────────┤  │
│  ┌─────────────────┐  │ RESULTS        │ RESULTS        │  │
│  │ Your Positions  │  │                │                │  │
│  │ ┌─────────────┐ │  │ Fee Yield: $X  │ Fee Yield: $X  │  │
│  │ │ SUI/USDC   │ │  │ oSAIL: X       │ oSAIL: X       │  │
│  │ │ $1,234 TVL │ │  │ IL Est: -$X    │ IL Est: -$X    │  │
│  │ └─────────────┘ │  │ Net: $X ✓     │ Net: $X        │  │
│  │ [+ Add Position]│  │                │                │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Requirements

### Frontend
- **Framework**: Next.js or Vite (TBD)
- **Styling**: CSS with Full Sail brand tokens
- **State**: React Query for SDK data, Zustand for UI state

### SDK Integration
- **Package**: `@fullsailfinance/sdk`
- **Network**: `mainnet-production`
- **No wallet signing**: Read-only operations

### API Dependencies
| API | Purpose |
|-----|---------|
| Full Sail Backend | Pool, Position, Lock data |
| Full Sail Chain | Current prices, real-time state |
| Tradeport (future) | veSAIL floor prices |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Yield projection accuracy | ±10% over 30 days |
| Time to complete projection | < 60 seconds |
| MAU (first month) | 100+ users |
| Scenario comparisons per session | 1.5 avg |

---

## Milestones

| Phase | Deliverable | Timeline |
|-------|-------------|----------|
| P0 | Spec + State Diagram + PRD | ✅ Complete |
| P1 | LP Calculator MVP | TBD |
| P2 | Token Buyer Calculator | TBD |
| P3 | veSAIL Valuation | TBD |
| P4 | Multi-position + Comparison | TBD |

---

## Open Questions

1. **Discount rate for DCF**: What's the default risk-free rate?
2. **Historical price API**: On-chain indexer or third-party?
3. **Tradeport integration**: API access for veSAIL floor prices?

---

## Appendix: Full Sail SDK Reference

Key modules used:
- `Pool.getById()` / `Pool.getByIdFromChain()`
- `Position.getByOwner()`
- `Lock.getByOwner()`
- `Coin.getCurrentEpochOSail()`

Key fields:
- `pool.full_apr` = `dinamic_stats.apr` + Σ `rewards[].apr`
- `pool.distributed_osail_24h` = daily oSAIL emissions
- `lock.voting_power` = current voting power
