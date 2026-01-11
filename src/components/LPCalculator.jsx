import { useState, useEffect, useMemo } from 'react';
import ScenarioPanel from './ScenarioPanel';
import { loadInputs, saveInputs } from '../lib/persistence';
import { fetchGaugePools } from '../lib/sdk';
import { calculateTotalResults } from '../lib/scenario-calculator';

const DEFAULT_SCENARIO = {
    pool: null,           // Each scenario has its own pool
    depositAmount: 5000,
    priceRangeLow: null,  // Will be set based on pool's current price
    priceRangeHigh: null, // Will be set based on pool's current price
    timeline: 30,
    osailStrategy: 70,
};

// Round to reasonable significant figures for clean display
function roundToSigFigs(num, sigFigs = 4) {
    if (num === 0) return 0;
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, sigFigs - 1 - magnitude);
    return Math.round(num * scale) / scale;
}

export default function LPCalculator() {
    const [pools, setPools] = useState([]);
    const [poolsLoading, setPoolsLoading] = useState(true);
    const [scenarios, setScenarios] = useState([{ ...DEFAULT_SCENARIO }]);

    // Load pools once on mount
    useEffect(() => {
        async function loadPools() {
            setPoolsLoading(true);
            const fetchedPools = await fetchGaugePools();
            setPools(fetchedPools);
            setPoolsLoading(false);

            // Auto-select first pool for first scenario if none selected
            if (fetchedPools.length > 0) {
                setScenarios(prev => {
                    if (!prev[0].pool) {
                        const pool = fetchedPools[0];
                        return [{
                            ...prev[0],
                            pool,
                            priceRangeLow: pool?.currentPrice ? roundToSigFigs(pool.currentPrice * 0.75) : null,
                            priceRangeHigh: pool?.currentPrice ? roundToSigFigs(pool.currentPrice * 1.25) : null,
                        }, ...prev.slice(1)];
                    }
                    return prev;
                });
            }
        }
        loadPools();
    }, []);

    // Restore saved state
    useEffect(() => {
        const saved = loadInputs('lp_calculator');
        if (saved?.scenarios?.length) {
            setScenarios(saved.scenarios);
        }
    }, []);

    // Persist on change
    useEffect(() => {
        saveInputs('lp_calculator', { scenarios });
    }, [scenarios]);

    // Calculate totals across all scenarios
    const totals = useMemo(() => calculateTotalResults(scenarios), [scenarios]);

    const updateScenario = (index, updates) => {
        setScenarios(prev => prev.map((s, i) => {
            if (i !== index) return s;

            const updated = { ...s, ...updates };

            // If pool changed, set default price ranges
            if (updates.pool && updates.pool !== s.pool) {
                const pool = updates.pool;
                if (pool?.currentPrice) {
                    updated.priceRangeLow = roundToSigFigs(pool.currentPrice * 0.75);
                    updated.priceRangeHigh = roundToSigFigs(pool.currentPrice * 1.25);
                }
            }

            return updated;
        }));
    };

    const addScenario = () => {
        if (scenarios.length < 3) {
            // Copy pool from first scenario if available
            const firstPool = scenarios[0]?.pool;
            const newScenario = {
                ...DEFAULT_SCENARIO,
                pool: firstPool,
                priceRangeLow: firstPool?.currentPrice ? roundToSigFigs(firstPool.currentPrice * 0.75) : null,
                priceRangeHigh: firstPool?.currentPrice ? roundToSigFigs(firstPool.currentPrice * 1.25) : null,
            };
            setScenarios([...scenarios, newScenario]);
        }
    };

    const removeScenario = (index) => {
        if (scenarios.length > 1) {
            setScenarios(scenarios.filter((_, i) => i !== index));
        }
    };

    const formatUsd = (val) => `$${val.toFixed(2)}`;

    return (
        <div>
            {/* Portfolio Summary - at top */}
            {totals.scenarioCount > 0 && (
                <div className="glass-card mb-lg">
                    <h4 className="mb-md">Summary</h4>
                    <div className="flex justify-around items-center" style={{ gap: 'var(--space-lg)' }}>
                        <div className="text-center">
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Total Deposit</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatUsd(totals.totalDeposit)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Projected SAIL</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totals.totalOsail.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Est. IL</div>
                            <div className="text-error" style={{ fontSize: '1.25rem', fontWeight: 600 }}>-{formatUsd(totals.totalIL)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Net Yield</div>
                            <div className={totals.totalNetYield >= 0 ? 'text-success' : 'text-error'} style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                {totals.totalNetYield >= 0 ? '' : '-'}{formatUsd(Math.abs(totals.totalNetYield))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-md">
                <h3>Scenarios</h3>
                {scenarios.length < 3 && (
                    <button className="btn btn-secondary" onClick={addScenario}>
                        + Add Scenario
                    </button>
                )}
            </div>

            <div className={`grid-${scenarios.length}`}>
                {scenarios.map((scenario, index) => (
                    <ScenarioPanel
                        key={index}
                        index={index}
                        scenario={scenario}
                        pools={pools}
                        poolsLoading={poolsLoading}
                        onChange={(updates) => updateScenario(index, updates)}
                        onRemove={scenarios.length > 1 ? () => removeScenario(index) : null}
                        isWinner={false} // TODO: Calculate winner
                    />
                ))}
            </div>
        </div>
    );
}

