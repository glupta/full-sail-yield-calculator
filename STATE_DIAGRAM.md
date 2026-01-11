# Full Sail Yield Calculator - State Diagram

## Application State Machine

```mermaid
stateDiagram-v2
    [*] --> Landing
    
    Landing --> LP_Calculator: Select "LP Yields"
    Landing --> TokenBuyer_Calculator: Select "Token Buyer"
    
    state LP_Calculator {
        [*] --> LP_Input
        LP_Input --> LP_PoolSelect: Enter wallet (optional)
        LP_PoolSelect --> LP_Configure: Select pool
        LP_Configure --> LP_Calculating: Set parameters
        LP_Calculating --> LP_Results: Compute yields
        LP_Results --> LP_Compare: Add scenario
        LP_Compare --> LP_Results: View comparison
        LP_Results --> LP_Configure: Adjust parameters
    }
    
    state TokenBuyer_Calculator {
        [*] --> TB_Input
        TB_Input --> TB_LockConfig: Enter wallet (optional)
        TB_LockConfig --> TB_Calculating: Set lock params
        TB_Calculating --> TB_Results: Compute yields
        TB_Results --> TB_Valuation: View veSAIL value
        TB_Valuation --> TB_Results: Back
        TB_Results --> TB_LockConfig: Adjust parameters
    }
    
    LP_Calculator --> TokenBuyer_Calculator: Toggle persona
    TokenBuyer_Calculator --> LP_Calculator: Toggle persona
```

---

## LP Calculator Data Flow

```mermaid
flowchart TD
    subgraph Inputs
        A[Wallet Address] --> B{Has Positions?}
        B -->|Yes| C[Fetch Positions via SDK]
        B -->|No| D[Manual Pool Selection]
        C --> E[Pool Dropdown]
        D --> E
        E --> F[Configure Parameters]
    end
    
    subgraph Parameters
        F --> G[Deposit Amount]
        F --> H["Price Range (±%)"]
        F --> I[Timeline]
        F --> J[Volatility Override]
        F --> K["oSAIL Strategy (%)"]
    end
    
    subgraph SDK_Fetch
        E --> L["Pool.getById()"]
        L --> M["dinamic_stats.apr"]
        L --> N["full_apr"]
        L --> O["distributed_osail_24h"]
        E --> P["Pool.getByIdFromChain()"]
        P --> Q["currentSqrtPrice"]
    end
    
    subgraph Calculations
        M --> R[Fee Projector]
        O --> S[Emission Projector]
        Q --> T[IL Calculator]
        K --> U[oSAIL Strategy Engine]
    end
    
    subgraph Outputs
        R --> V[Projected Fee Yield]
        S --> W[Projected oSAIL]
        T --> X[IL Estimate]
        U --> Y[Lock vs Redeem Value]
        V --> Z[Net Yield]
        W --> Z
        X --> Z
        Y --> Z
    end
```

---

## Token Buyer Calculator Data Flow

```mermaid
flowchart TD
    subgraph Inputs
        A[Wallet Address] --> B{Has Locks?}
        B -->|Yes| C[Fetch Locks via SDK]
        B -->|No| D[Manual Input]
        C --> E[Lock Selection]
        D --> F[SAIL Amount]
    end
    
    subgraph Parameters
        F --> G[Lock Duration]
        G --> H[Timeline]
    end
    
    subgraph SDK_Fetch
        E --> I["Lock.getByOwner()"]
        I --> J[voting_power]
        I --> K[remaining_duration]
    end
    
    subgraph Calculations
        J --> L[Voting Reward APR]
        K --> M[DCF Valuation]
        L --> N[oSAIL Rebase Yield]
    end
    
    subgraph Outputs
        L --> O[Projected Voting Rewards]
        N --> O
        M --> P[veSAIL Fair Value]
        J --> Q[Voting Power Ratio]
    end
```

---

## oSAIL Strategy Decision Tree

```mermaid
flowchart TD
    A[oSAIL Earned] --> B{User Strategy}
    B -->|100% Lock| C["Lock to veSAIL<br/>Value: 1x SAIL"]
    B -->|100% Redeem| D["Redeem for USDC<br/>Value: 0.5x SAIL"]
    B -->|Hybrid| E["Split by %"]
    E --> F["Lock Portion → veSAIL"]
    E --> G["Redeem Portion → USDC"]
    
    C --> H[Voting Power]
    H --> I[Voting Rewards]
    I --> J[Trading Fees Share]
    I --> K[oSAIL Rebase]
    
    D --> L[Immediate USDC]
    
    F --> H
    G --> L
```

---

## Epoch Timeline

```mermaid
gantt
    title Full Sail Epoch Cycle
    dateFormat  YYYY-MM-DD
    section Epoch N
    Voting Period       :active, epoch_n, 2026-01-06, 7d
    oSAIL Distribution  :milestone, m1, 2026-01-13, 0d
    section Epoch N+1
    Voting Period       :epoch_n1, 2026-01-13, 7d
    oSAIL Distribution  :milestone, m2, 2026-01-20, 0d
    section oSAIL Expiry
    Epoch N oSAIL Expires :crit, expire, 2026-02-10, 0d
```
