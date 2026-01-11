import { useState, useEffect, useMemo, useRef } from 'react';
import ScenarioPanel from './ScenarioPanel';
import { loadInputs, saveInputs } from '../lib/persistence';
import { fetchGaugePools } from '../lib/sdk';
import { calculateTotalResults } from '../lib/scenario-calculator';
import { roundToSigFigs } from '../lib/formatters';

// Generate unique IDs for scenarios
let scenarioIdCounter = 0;
const generateScenarioId = () => `scenario_${++scenarioIdCounter}_${Date.now()}`;

const createDefaultScenario = () => ({
    id: generateScenarioId(),
    pool: null,           // Each scenario has its own pool
    depositAmount: 5000,
    priceRangeLow: null,  // Will be set based on pool's current price
    priceRangeHigh: null, // Will be set based on pool's current price
    exitPrice: null,      // Target exit price for IL calculation
    timeline: 30,
    osailStrategy: 70,
});

export default function LPCalculator() {
    const [pools, setPools] = useState([]);
    const [poolsLoading, setPoolsLoading] = useState(true);
    const [scenarios, setScenarios] = useState([createDefaultScenario()]);
    const isInitialized = useRef(false);
    const poolsRef = useRef([]);

    // Load pools and restore state on mount (in correct order)
    useEffect(() => {
        async function initializeCalculator() {
            setPoolsLoading(true);

            // 1. First fetch pools
            const fetchedPools = await fetchGaugePools();
            setPools(fetchedPools);
            poolsRef.current = fetchedPools;

            // 2. Then restore saved state (with pool data re-hydrated)
            const saved = loadInputs('lp_calculator');
            if (saved?.scenarios?.length) {
                // Re-hydrate pool objects from fetched pools (localStorage only stores IDs)
                const restoredScenarios = saved.scenarios.map(scenario => {
                    // Ensure each scenario has a unique ID
                    const id = scenario.id || generateScenarioId();

                    // Re-link pool object from fetched pools
                    let pool = null;
                    if (scenario.pool?.id) {
                        pool = fetchedPools.find(p => p.id === scenario.pool.id) || scenario.pool;
                    }

                    return { ...scenario, id, pool };
                });
                setScenarios(restoredScenarios);
            } else if (fetchedPools.length > 0) {
                // No saved state, auto-select first pool
                const pool = fetchedPools[0];
                setScenarios([{
                    ...createDefaultScenario(),
                    pool,
                    priceRangeLow: pool?.currentPrice ? roundToSigFigs(pool.currentPrice * 0.75) : null,
                    priceRangeHigh: pool?.currentPrice ? roundToSigFigs(pool.currentPrice * 1.25) : null,
                }]);
            }

            setPoolsLoading(false);
            isInitialized.current = true;
        }

        initializeCalculator();
    }, []);

    // Persist on change (only after initialization)
    useEffect(() => {
        if (isInitialized.current) {
            saveInputs('lp_calculator', { scenarios });
        }
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
                ...createDefaultScenario(),
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
                <div className="summary-card mb-lg">
                    <h4 className="mb-md" style={{ color: 'var(--color-primary)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Summary</h4>
                    <div className="flex justify-around items-center" style={{ gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                        <div className="stat-item text-center">
                            <div className="stat-label">Total Deposit</div>
                            <div className="stat-value">{formatUsd(totals.totalDeposit)}</div>
                        </div>
                        <div className="stat-item text-center">
                            <div className="stat-label">SAIL Earned</div>
                            <div className="stat-value text-success">+{formatUsd(totals.totalOsailValue)}</div>
                            <div className="stat-apr text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {totals.avgSailAPR?.toFixed(1) || '0.0'}% APR
                            </div>
                        </div>
                        <div className="stat-item text-center">
                            <div className="stat-label">External Rewards</div>
                            <div className="stat-value text-success">+{formatUsd(totals.totalExternalRewards)}</div>
                            <div className="stat-apr text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {totals.avgExternalAPR?.toFixed(1) || '0.0'}% APR
                            </div>
                        </div>
                        <div className="stat-item text-center">
                            <div className="stat-label">Impermanent Loss</div>
                            <div className="stat-value text-error">-{formatUsd(totals.totalIL)}</div>
                            <div className="stat-apr text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {totals.avgILAPR?.toFixed(1) || '0.0'}% APR
                            </div>
                        </div>
                        <div className="stat-item text-center">
                            <div className="stat-label">Net Yield</div>
                            <div className={`stat-value ${totals.totalNetYield >= 0 ? 'text-success' : 'text-error'}`}>
                                {totals.totalNetYield >= 0 ? '+' : '-'}{formatUsd(Math.abs(totals.totalNetYield))}
                            </div>
                            <div className="stat-apr text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {totals.avgNetAPR?.toFixed(1) || '0.0'}% APR
                            </div>
                        </div>
                        <div className="stat-item text-center">
                            <div className="stat-label">Final Return</div>
                            <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
                                {formatUsd(totals.totalDeposit + totals.totalNetYield)}
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
                        key={scenario.id || index}
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

