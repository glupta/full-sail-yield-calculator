'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import ScenarioPanel from './ScenarioPanel';
import { fetchPools } from '@/lib/api-client';
import { calculateTotalResults } from '@/lib/scenario-calculator';
import { roundToSigFigs } from '@/lib/formatters';
import { getDefaultPreset, getPriceRangeFromPercent } from '@/lib/calculators/leverage-calculator';
import { Plus } from 'lucide-react';

// Generate unique IDs for scenarios
let scenarioIdCounter = 0;
const generateScenarioId = () => `scenario_${++scenarioIdCounter}_${Date.now()}`;

const createDefaultScenario = () => ({
    id: generateScenarioId(),
    pool: null,
    depositAmount: 10000,
    priceRangeLow: null,
    priceRangeHigh: null,
    exitPrice: null,
    timeline: 30,
    osailStrategy: 50,
    aprOverride: null, // null = use SDK-calculated APR, number = user override
});

// Loading Skeleton Component
function SummarySkeleton() {
    return (
        <div className="summary-card mb-lg animate-in">
            <div className="skeleton skeleton-heading" style={{ width: '120px', marginBottom: 'var(--space-md)' }}></div>
            <div className="flex justify-around items-center" style={{ gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="stat-item text-center" style={{ minWidth: '100px' }}>
                        <div className="skeleton skeleton-text" style={{ width: '60px', margin: '0 auto' }}></div>
                        <div className="skeleton skeleton-text" style={{ width: '80px', height: '1.5em', margin: '4px auto 0' }}></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ScenarioSkeleton() {
    return (
        <div className="glass-card animate-in">
            <div className="skeleton skeleton-heading" style={{ width: '100px' }}></div>
            <div className="skeleton skeleton-text" style={{ marginTop: 'var(--space-md)' }}></div>
            <div className="skeleton" style={{ height: '48px', marginTop: 'var(--space-md)' }}></div>
            <div className="skeleton skeleton-text" style={{ marginTop: 'var(--space-lg)', width: '80px' }}></div>
            <div className="flex gap-sm" style={{ marginTop: 'var(--space-xs)' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="skeleton" style={{ flex: 1, height: '36px' }}></div>
                ))}
            </div>
            <div className="skeleton" style={{ height: '100px', marginTop: 'var(--space-lg)' }}></div>
        </div>
    );
}

export default function LPCalculator() {
    const [pools, setPools] = useState([]);
    const [poolsLoading, setPoolsLoading] = useState(true);
    const [scenarios, setScenarios] = useState([createDefaultScenario()]);
    const isInitialized = useRef(false);
    const poolsRef = useRef([]);

    // Load pools and restore state on mount
    useEffect(() => {
        async function initializeCalculator() {
            setPoolsLoading(true);

            const fetchedPools = await fetchPools();
            setPools(fetchedPools);
            poolsRef.current = fetchedPools;

            // Default to SAIL/USDC pool, fallback to first pool
            if (fetchedPools.length > 0) {
                const sailPool = fetchedPools.find(p =>
                    (p.token0_symbol?.toUpperCase() === 'SAIL' || p.token1_symbol?.toUpperCase() === 'SAIL') &&
                    (p.token0_symbol?.toUpperCase() === 'USDC' || p.token1_symbol?.toUpperCase() === 'USDC')
                );
                const pool = sailPool || fetchedPools[0];
                const defaultPreset = getDefaultPreset();
                const range = pool?.currentPrice
                    ? getPriceRangeFromPercent(pool.currentPrice, defaultPreset.lowerPct, defaultPreset.upperPct)
                    : { priceLow: null, priceHigh: null };
                setScenarios([{
                    ...createDefaultScenario(),
                    pool,
                    priceRangeLow: range.priceLow ? roundToSigFigs(range.priceLow, 4) : null,
                    priceRangeHigh: range.priceHigh ? roundToSigFigs(range.priceHigh, 4) : null,
                }]);
            }

            setPoolsLoading(false);
            isInitialized.current = true;
        }

        initializeCalculator();
    }, []);



    // Calculate totals
    const totals = useMemo(() => calculateTotalResults(scenarios), [scenarios]);

    const updateScenario = (index, updates) => {
        setScenarios(prev => prev.map((s, i) => {
            if (i !== index) return s;
            const updated = { ...s, ...updates };
            if (updates.pool && updates.pool !== s.pool) {
                const pool = updates.pool;
                if (pool?.currentPrice) {
                    const defaultPreset = getDefaultPreset();
                    const range = getPriceRangeFromPercent(pool.currentPrice, defaultPreset.lowerPct, defaultPreset.upperPct);
                    updated.priceRangeLow = roundToSigFigs(range.priceLow, 4);
                    updated.priceRangeHigh = roundToSigFigs(range.priceHigh, 4);
                    updated.aprOverride = null; // Reset APR override when pool changes
                }
            }
            return updated;
        }));
    };

    const addScenario = () => {
        if (scenarios.length < 3) {
            const firstPool = scenarios[0]?.pool;
            const defaultPreset = getDefaultPreset();
            const range = firstPool?.currentPrice
                ? getPriceRangeFromPercent(firstPool.currentPrice, defaultPreset.lowerPct, defaultPreset.upperPct)
                : { priceLow: null, priceHigh: null };
            const newScenario = {
                ...createDefaultScenario(),
                pool: firstPool,
                priceRangeLow: range.priceLow ? roundToSigFigs(range.priceLow, 4) : null,
                priceRangeHigh: range.priceHigh ? roundToSigFigs(range.priceHigh, 4) : null,
            };
            setScenarios([...scenarios, newScenario]);
        }
    };

    const removeScenario = (index) => {
        if (scenarios.length > 1) {
            setScenarios(scenarios.filter((_, i) => i !== index));
        }
    };

    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Show loading skeleton
    if (poolsLoading) {
        return (
            <div role="tabpanel" id="panel-lp" aria-labelledby="tab-lp">
                <SummarySkeleton />
                <div className="flex justify-between items-center mb-md">
                    <h3>Scenarios</h3>
                </div>
                <div className="grid-1">
                    <ScenarioSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div role="tabpanel" id="panel-lp" aria-labelledby="tab-lp">
            {/* Portfolio Summary */}
            {totals.scenarioCount > 0 && (
                <div className="summary-card mb-lg animate-in">
                    <h4
                        className="mb-md"
                        style={{
                            color: 'var(--color-primary)',
                            fontSize: '0.8rem',
                            letterSpacing: '1.5px',
                            textTransform: 'uppercase',
                            fontWeight: 600
                        }}
                    >
                        Summary
                    </h4>

                    {/* Stats Row - Crisp Grid Layout */}
                    <div className="summary-stats-grid">
                        <div className="stat-item text-center">
                            <div className="stat-label">Total Deposit</div>
                            <div className="stat-value">{formatUsd(totals.totalDeposit)}</div>
                        </div>

                        <div className="stat-item text-center">
                            <div className="stat-label">SAIL Earned</div>
                            <div className="stat-value text-success">+{formatUsd(totals.totalOsailValue)}</div>
                            <div className="stat-apr">{totals.avgSailAPR?.toFixed(1) || '0.0'}% APR</div>
                        </div>

                        <div className="stat-item text-center">
                            <div className="stat-label">External Rewards</div>
                            <div className="stat-value text-success">+{formatUsd(totals.totalExternalRewards)}</div>
                            <div className="stat-apr">{totals.avgExternalAPR?.toFixed(1) || '0.0'}% APR</div>
                        </div>

                        <div className="stat-item text-center">
                            <div className="stat-label">Impermanent Loss</div>
                            <div className="stat-value text-error">-{formatUsd(totals.totalIL)}</div>
                            <div className="stat-apr">{totals.avgILAPR?.toFixed(1) || '0.0'}% APR</div>
                        </div>

                        <div className="stat-item text-center">
                            <div className="stat-label">Net Yield</div>
                            <div className={`stat-value ${totals.totalNetYield >= 0 ? 'text-success' : 'text-error'}`}>
                                {totals.totalNetYield >= 0 ? '+' : '-'}{formatUsd(Math.abs(totals.totalNetYield))}
                            </div>
                            <div className="stat-apr">{totals.avgNetAPR?.toFixed(1) || '0.0'}% APR</div>
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

            {/* Scenarios Header */}
            <div className="flex justify-between items-center mb-md">
                <h3>Scenarios</h3>
                {scenarios.length < 3 && (
                    <button className="btn btn-secondary" onClick={addScenario}>
                        <Plus size={16} />
                        <span className="mobile-hidden">Add Scenario</span>
                    </button>
                )}
            </div>

            {/* Scenarios Grid - Responsive */}
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
                        isWinner={false}
                    />
                ))}
            </div>
        </div>
    );
}
