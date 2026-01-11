import { useMemo, useState } from 'react';
import { X, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateScenarioResults } from '../lib/scenario-calculator';
import { STRATEGY_PRESETS } from '../lib/calculators/osail-strategy';
import { roundToSigFigs } from '../lib/formatters';

export default function ScenarioPanel({
    index,
    scenario,
    pools,
    poolsLoading,
    onChange,
    onRemove,
    isWinner
}) {
    // Collapse state for results sections
    const [isSailExpanded, setIsSailExpanded] = useState(false);
    const [isExternalExpanded, setIsExternalExpanded] = useState(false);

    // Use pool from scenario
    const pool = scenario.pool;

    // Calculate yields using centralized calculator (includes external rewards)
    const results = useMemo(() => {
        return calculateScenarioResults(scenario);
    }, [scenario]);

    const formatUsd = (val) => `$${val.toFixed(2)}`;
    const formatOsail = (val) => `${val.toFixed(2)} SAIL`;

    const formatTVL = (tvl) => {
        if (!tvl) return '$0';
        if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
        if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
        return `$${tvl.toFixed(0)}`;
    };

    return (
        <div
            className="glass-card"
            style={{
                position: 'relative',
                border: isWinner ? '2px solid var(--color-success)' : undefined
            }}
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-md">
                <h4>Scenario {index + 1}</h4>
                <div className="flex gap-sm items-center">
                    {isWinner && <CheckCircle size={18} className="text-success" />}
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-muted)'
                            }}
                            aria-label="Remove scenario"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Pool Selection */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Pool
                </label>
                {poolsLoading ? (
                    <div className="text-muted">Loading pools...</div>
                ) : (
                    <select
                        value={pool?.id || ''}
                        onChange={(e) => {
                            const selected = pools.find(p => p.id === e.target.value);
                            onChange({ pool: selected });
                        }}
                        style={{ width: '100%' }}
                    >
                        <option value="">Select a pool...</option>
                        {pools.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.token0_symbol}/{p.token1_symbol} ({formatTVL(p.dinamic_stats?.tvl)})
                            </option>
                        ))}
                    </select>
                )}
                {pool && (
                    <div className="flex gap-md mt-sm text-muted" style={{ fontSize: '0.75rem' }}>
                        <span>APR: <span className="text-success">{pool.full_apr?.toFixed(1) || 0}%</span></span>
                        <span>TVL: {formatTVL(pool.dinamic_stats?.tvl)}</span>
                    </div>
                )}
            </div>

            {/* Deposit Amount */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Deposit Amount
                </label>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                    <input
                        type="number"
                        value={scenario.depositAmount}
                        onChange={(e) => onChange({ depositAmount: Number(e.target.value) })}
                        style={{ width: '100%', paddingLeft: '24px' }}
                    />
                </div>
            </div>

            {/* Price Range */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Price Range
                    {pool?.currentPrice && (
                        <span style={{ float: 'right', color: 'var(--color-primary)' }}>
                            Current: ${pool.currentPrice < 0.01
                                ? pool.currentPrice.toFixed(6)
                                : pool.currentPrice.toFixed(4)}
                        </span>
                    )}
                </label>
                <div className="flex gap-sm">
                    <div style={{ width: '50%' }}>
                        <input
                            type="number"
                            step="0.01"
                            value={scenario.priceRangeLow ?? ''}
                            onChange={(e) => onChange({ priceRangeLow: e.target.value === '' ? null : Number(e.target.value) })}
                            style={{ width: '100%' }}
                            placeholder="Low"
                        />
                        {pool?.currentPrice && scenario.priceRangeLow > 0 && (
                            <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                {((scenario.priceRangeLow / pool.currentPrice - 1) * 100).toFixed(1)}% from current
                            </div>
                        )}
                    </div>
                    <div style={{ width: '50%' }}>
                        <input
                            type="number"
                            step="0.01"
                            value={scenario.priceRangeHigh ?? ''}
                            onChange={(e) => onChange({ priceRangeHigh: e.target.value === '' ? null : Number(e.target.value) })}
                            style={{ width: '100%' }}
                            placeholder="High"
                        />
                        {pool?.currentPrice && scenario.priceRangeHigh > 0 && (
                            <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                +{((scenario.priceRangeHigh / pool.currentPrice - 1) * 100).toFixed(1)}% from current
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Exit Price - for IL calculation */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Target Exit Price
                    <span className="text-muted" style={{ float: 'right', fontSize: '0.7rem' }}>
                        (for IL calc)
                    </span>
                </label>
                <input
                    type="number"
                    step="0.01"
                    value={scenario.exitPrice ?? (pool?.currentPrice ? roundToSigFigs(pool.currentPrice) : '')}
                    onChange={(e) => onChange({ exitPrice: e.target.value === '' ? null : Number(e.target.value) })}
                    style={{ width: '100%' }}
                    placeholder="Exit price"
                />
                {pool?.currentPrice && (
                    <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                        {(() => {
                            const exitPrice = scenario.exitPrice ?? pool.currentPrice;
                            const change = ((exitPrice / pool.currentPrice - 1) * 100);
                            return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% price change`;
                        })()}
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Timeline
                    <span style={{ float: 'right', color: 'var(--text-primary)' }}>
                        {scenario.timeline >= 365
                            ? `${(scenario.timeline / 365).toFixed(1)}y`
                            : `${scenario.timeline}d`}
                    </span>
                </label>
                <input
                    type="range"
                    min="30"
                    max="1460"
                    step="1"
                    value={scenario.timeline}
                    onChange={(e) => onChange({ timeline: Number(e.target.value) })}
                />
                <div className="flex gap-sm mt-sm">
                    {[
                        { label: '1m', days: 30 },
                        { label: '3m', days: 90 },
                        { label: '6m', days: 180 },
                        { label: '1y', days: 365 },
                        { label: '2y', days: 730 },
                        { label: '4y', days: 1460 },
                    ].map(preset => (
                        <button
                            key={preset.label}
                            className={`btn ${scenario.timeline === preset.days ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onChange({ timeline: preset.days })}
                            style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* oSAIL Strategy */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    SAIL Strategy
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={scenario.osailStrategy}
                    onChange={(e) => onChange({ osailStrategy: Number(e.target.value) })}
                />
                <div className="flex justify-between text-muted" style={{ fontSize: '0.75rem' }}>
                    <span>Redeem ({100 - scenario.osailStrategy}%)</span>
                    <span>Lock ({scenario.osailStrategy}%)</span>
                </div>
                <div className="flex gap-sm mt-sm">
                    {Object.values(STRATEGY_PRESETS).map(preset => (
                        <button
                            key={preset.name}
                            className="btn btn-secondary"
                            onClick={() => onChange({ osailStrategy: preset.lockPct * 100 })}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                            {preset.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            {results && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-md)',
                    borderTop: '1px solid var(--border-subtle)'
                }}>
                    <h4 className="mb-md">Results</h4>
                    <div style={{ fontSize: '0.9rem' }}>
                        {/* Column Headers */}
                        <div className="flex justify-between text-muted" style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 'var(--space-xs)',
                            paddingBottom: 'var(--space-xs)',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <span></span>
                            <div className="flex" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>Amount</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>Return</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>APR</span>
                            </div>
                        </div>

                        {/* SAIL Earned - Collapsible */}
                        <div
                            className="flex justify-between items-center"
                            style={{ padding: 'var(--space-xs) 0', cursor: 'pointer' }}
                            onClick={() => setIsSailExpanded(!isSailExpanded)}
                        >
                            <span className="flex items-center gap-sm">
                                <span className="text-muted">SAIL Earned</span>
                                {isSailExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                            </span>
                            <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.osailValue)}</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{((results.osailValue / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{results.sailAPR?.toFixed(1) || '0.0'}%</span>
                            </div>
                        </div>

                        {/* SAIL Breakdown - Collapsible */}
                        {isSailExpanded && (
                            <div style={{
                                marginLeft: 'var(--space-md)',
                                paddingLeft: 'var(--space-md)',
                                borderLeft: '2px solid var(--border-subtle)',
                                marginBottom: 'var(--space-xs)'
                            }}>
                                <div className="flex justify-between text-muted" style={{ padding: '2px 0', fontSize: '0.75rem' }}>
                                    <span>→ Redeemed (liquid)</span>
                                    <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                        <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.redeemValue)}</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{((results.redeemValue / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{results.redeemAPR?.toFixed(1) || '0.0'}%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-muted" style={{ padding: '2px 0', fontSize: '0.75rem' }}>
                                    <span>→ Locked (veSAIL)</span>
                                    <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                        <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.lockValue)}</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{((results.lockValue / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{results.lockAPR?.toFixed(1) || '0.0'}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* External Rewards - Collapsible */}
                        {results.externalRewards && results.externalRewards.length > 0 && (
                            <>
                                <div
                                    className="flex justify-between items-center"
                                    style={{ padding: 'var(--space-xs) 0', cursor: 'pointer' }}
                                    onClick={() => setIsExternalExpanded(!isExternalExpanded)}
                                >
                                    <span className="flex items-center gap-sm">
                                        <span className="text-muted">External Rewards</span>
                                        {isExternalExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                                    </span>
                                    <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                        <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.externalRewardsValue)}</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{((results.externalRewardsValue / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{results.externalRewards.reduce((sum, r) => sum + r.apr, 0).toFixed(1)}%</span>
                                    </div>
                                </div>

                                {/* External Breakdown */}
                                {isExternalExpanded && (
                                    <div style={{
                                        marginLeft: 'var(--space-md)',
                                        paddingLeft: 'var(--space-md)',
                                        borderLeft: '2px solid var(--border-subtle)',
                                        marginBottom: 'var(--space-xs)'
                                    }}>
                                        {results.externalRewards.map((reward, idx) => (
                                            <div key={idx} className="flex justify-between text-muted" style={{ padding: '2px 0', fontSize: '0.75rem' }}>
                                                <span>→ {reward.token}</span>
                                                <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                                    <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(reward.projectedValue)}</span>
                                                    <span style={{ width: '50px', textAlign: 'right' }}>{((reward.projectedValue / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                                    <span style={{ width: '50px', textAlign: 'right' }}>{reward.apr.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* IL */}
                        <div className="flex justify-between" style={{ padding: 'var(--space-xs) 0' }}>
                            <span className="text-muted">Impermanent Loss</span>
                            <div className="flex text-error" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.ilDollar)}</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{((results.ilDollar / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{(Math.abs(results.ilPercent) * 100 * (365 / scenario.timeline)).toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Net Yield */}
                        <div
                            className="flex justify-between"
                            style={{
                                fontWeight: 600,
                                marginTop: 'var(--space-sm)',
                                paddingTop: 'var(--space-sm)',
                                borderTop: '1px solid var(--border-subtle)'
                            }}
                        >
                            <span>Net Yield {isWinner && '✓'}</span>
                            <div className={`flex ${results.netYield >= 0 ? 'text-success' : 'text-error'}`} style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.netYield)}</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{((results.netYield / scenario.depositAmount) * 100).toFixed(1)}%</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{((results.netYield / scenario.depositAmount) * (365 / scenario.timeline) * 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Portfolio Value */}
                        <div
                            className="flex justify-between"
                            style={{
                                fontWeight: 600,
                                fontSize: '1.1rem',
                                marginTop: 'var(--space-xs)',
                                paddingTop: 'var(--space-xs)'
                            }}
                        >
                            <span>Final Value</span>
                            <span style={{ color: 'var(--color-primary)' }}>
                                {formatUsd(scenario.depositAmount + results.netYield)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
