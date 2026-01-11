import { useMemo, useState } from 'react';
import { X, CheckCircle, ChevronDown } from 'lucide-react';
import { calculateScenarioResults } from '../lib/scenario-calculator';
import { calculateRangeAPR, RANGE_PRESETS, STABLE_RANGE_PRESETS, isStablePool, getPriceRangeFromPercent } from '../lib/calculators/leverage-calculator';
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
    const [isSailExpanded, setIsSailExpanded] = useState(false);
    const [isExternalExpanded, setIsExternalExpanded] = useState(false);

    const pool = scenario.pool;

    const results = useMemo(() => {
        return calculateScenarioResults(scenario);
    }, [scenario]);

    const rangeAPR = useMemo(() => {
        if (!pool?.full_apr || !pool?.currentPrice) return null;
        const priceLow = scenario.priceRangeLow;
        const priceHigh = scenario.priceRangeHigh;
        if (!priceLow || !priceHigh) return null;
        return calculateRangeAPR(pool.full_apr, pool.currentPrice, priceLow, priceHigh);
    }, [pool?.full_apr, pool?.currentPrice, scenario.priceRangeLow, scenario.priceRangeHigh]);

    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatTVL = (tvl) => {
        if (!tvl) return '$0';
        if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
        if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
        return `$${tvl.toFixed(0)}`;
    };

    // Accordion header styles
    const accordionHeaderStyle = {
        padding: 'var(--space-xs) 0',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-out)',
        borderRadius: 'var(--radius-sm)',
        marginLeft: '-4px',
        marginRight: '-4px',
        paddingLeft: '4px',
        paddingRight: '4px'
    };

    return (
        <div
            className="glass-card animate-in"
            style={{
                position: 'relative',
                border: isWinner ? '2px solid var(--color-success)' : undefined
            }}
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-md">
                <h4 style={{ fontSize: '1.1rem' }}>Scenario {index + 1}</h4>
                <div className="flex gap-sm items-center">
                    {isWinner && <CheckCircle size={18} className="text-success" />}
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                padding: '6px',
                                transition: 'all var(--duration-fast) var(--ease-out)'
                            }}
                            aria-label="Remove scenario"
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                e.currentTarget.style.color = 'var(--color-error)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Pool Selection */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                    Pool
                </label>
                {poolsLoading ? (
                    <div className="skeleton" style={{ height: '48px' }}></div>
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
                    <div className="flex gap-md mt-sm text-muted" style={{ fontSize: '0.7rem' }}>
                        <span>TVL: {formatTVL(pool.dinamic_stats?.tvl)}</span>
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                    Timeline
                </label>
                <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
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
                            style={{
                                flex: '1 1 auto',
                                minWidth: '42px',
                                padding: '8px 10px',
                                fontSize: '0.75rem'
                            }}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Deposit Amount & Exit Price - Responsive stack on mobile */}
            <div className="flex gap-md mb-md mobile-stack">
                <div style={{ flex: 1 }}>
                    <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                        Deposit Amount
                    </label>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            fontWeight: 500
                        }}>$</span>
                        <input
                            type="number"
                            min="0"
                            value={scenario.depositAmount}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                    onChange({ depositAmount: 0 });
                                } else {
                                    const numVal = parseFloat(val);
                                    if (!isNaN(numVal) && numVal >= 0) {
                                        onChange({ depositAmount: numVal });
                                    }
                                }
                            }}
                            style={{ width: '100%', paddingLeft: '28px' }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                        Exit Price
                        <span className="text-muted" style={{ fontSize: '0.6rem', marginLeft: '4px', opacity: 0.7 }}>(IL calc)</span>
                    </label>
                    <input
                        type="number"
                        step="any"
                        value={scenario.exitPrice !== null && scenario.exitPrice !== undefined
                            ? scenario.exitPrice
                            : (pool?.currentPrice ? roundToSigFigs(pool.currentPrice) : '')}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === null) {
                                onChange({ exitPrice: null });
                            } else {
                                const numVal = parseFloat(val);
                                if (!isNaN(numVal)) {
                                    onChange({ exitPrice: numVal });
                                }
                            }
                        }}
                        style={{ width: '100%' }}
                        placeholder="Exit price"
                    />
                    {pool?.currentPrice && (
                        <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                            {(() => {
                                const exitPrice = scenario.exitPrice !== null && scenario.exitPrice !== undefined
                                    ? scenario.exitPrice
                                    : pool.currentPrice;
                                const change = ((exitPrice / pool.currentPrice) - 1) * 100;
                                if (!isFinite(change) || isNaN(change)) {
                                    return '0.0% price change';
                                }
                                return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% price change`;
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Price Range */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                    Price Range
                    {pool?.currentPrice && (
                        <span style={{ float: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>
                            Current: ${pool.currentPrice < 0.01
                                ? pool.currentPrice.toFixed(6)
                                : pool.currentPrice.toFixed(4)}
                        </span>
                    )}
                </label>

                {/* Range Preset Buttons */}
                {pool?.currentPrice && (() => {
                    const presets = isStablePool(pool) ? STABLE_RANGE_PRESETS : RANGE_PRESETS;
                    return (
                        <div className="flex gap-xs" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                            {presets.map(preset => (
                                <button
                                    key={preset.label}
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        const range = getPriceRangeFromPercent(
                                            pool.currentPrice,
                                            preset.lowerPct,
                                            preset.upperPct
                                        );
                                        onChange({
                                            priceRangeLow: roundToSigFigs(range.priceLow, 4),
                                            priceRangeHigh: roundToSigFigs(range.priceHigh, 4)
                                        });
                                    }}
                                    style={{
                                        flex: '1 1 auto',
                                        minWidth: '55px',
                                        padding: '6px 4px',
                                        fontSize: '0.6rem',
                                        lineHeight: 1.3
                                    }}
                                    title={preset.description}
                                >
                                    <div style={{ fontWeight: 600 }}>{preset.label}</div>
                                    <div style={{ opacity: 0.6, fontSize: '0.5rem' }}>{preset.sublabel}</div>
                                </button>
                            ))}
                        </div>
                    );
                })()}

                {/* Price Range Inputs - Stack on mobile */}
                <div className="flex gap-sm mobile-stack">
                    <div style={{ flex: 1 }}>
                        <input
                            type="number"
                            step="any"
                            value={scenario.priceRangeLow ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                    onChange({ priceRangeLow: null });
                                } else {
                                    const numVal = parseFloat(val);
                                    if (!isNaN(numVal)) {
                                        onChange({ priceRangeLow: numVal });
                                    }
                                }
                            }}
                            style={{ width: '100%' }}
                            placeholder="Low"
                        />
                        {pool?.currentPrice && scenario.priceRangeLow > 0 && (
                            <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                                {(() => {
                                    const change = ((scenario.priceRangeLow / pool.currentPrice) - 1) * 100;
                                    if (!isFinite(change) || isNaN(change)) return '0.0% from current';
                                    return `${change.toFixed(1)}% from current`;
                                })()}
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <input
                            type="number"
                            step="any"
                            value={scenario.priceRangeHigh ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                    onChange({ priceRangeHigh: null });
                                } else {
                                    const numVal = parseFloat(val);
                                    if (!isNaN(numVal)) {
                                        onChange({ priceRangeHigh: numVal });
                                    }
                                }
                            }}
                            style={{ width: '100%' }}
                            placeholder="High"
                        />
                        {pool?.currentPrice && scenario.priceRangeHigh > 0 && (
                            <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                                {(() => {
                                    const change = ((scenario.priceRangeHigh / pool.currentPrice) - 1) * 100;
                                    if (!isFinite(change) || isNaN(change)) return '+0.0% from current';
                                    return `+${change.toFixed(1)}% from current`;
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Claim Strategy */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}>
                    Claim Strategy
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={scenario.osailStrategy}
                    onChange={(e) => onChange({ osailStrategy: Number(e.target.value) })}
                />
                <div className="flex justify-between text-muted" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                    <span>Redeem ({100 - scenario.osailStrategy}%)</span>
                    <span>Lock ({scenario.osailStrategy}%)</span>
                </div>

                {/* Lock incentive display */}
                {results && (
                    <div
                        className="mt-sm"
                        style={{
                            padding: 'var(--space-xs) var(--space-sm)',
                            background: scenario.osailStrategy > 50
                                ? 'rgba(34, 197, 94, 0.08)'
                                : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 'var(--radius-md)',
                            border: scenario.osailStrategy > 50
                                ? '1px solid rgba(34, 197, 94, 0.2)'
                                : '1px solid var(--border-subtle)',
                            fontSize: '0.7rem',
                            textAlign: 'center',
                            transition: 'all var(--duration-normal) var(--ease-out)'
                        }}
                    >
                        {(() => {
                            const currentValue = results.osailValue;
                            const maxLockValue = results.projectedOsail * 0.5;
                            const potentialGain = maxLockValue - currentValue;

                            if (scenario.osailStrategy >= 100) {
                                return <span className="text-success">✓ Maximum SAIL earnings at 100% lock</span>;
                            } else if (potentialGain > 0) {
                                return (
                                    <span>
                                        Lock more to earn <span className="text-success" style={{ fontWeight: 600 }}>+${potentialGain.toFixed(0)}</span> more SAIL
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </div>
                )}
            </div>

            {/* Results */}
            {results && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-md)',
                    borderTop: '1px solid var(--border-subtle)'
                }}>
                    {/* Visual Metrics Row */}
                    <div
                        className="flex gap-sm mb-md"
                        style={{
                            justifyContent: 'space-around',
                            background: 'rgba(0, 160, 255, 0.03)',
                            padding: 'var(--space-sm)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(0, 160, 255, 0.08)'
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div className="text-muted" style={{ fontSize: '0.6rem', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Est. APR</div>
                            <div className="text-success" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                {rangeAPR ? `${rangeAPR.estimatedAPR.toFixed(0)}%` : `${pool?.full_apr?.toFixed(0) || 0}%`}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="text-muted" style={{ fontSize: '0.6rem', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Leverage</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {rangeAPR ? `${rangeAPR.leverage.toFixed(1)}x` : '1.0x'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="text-muted" style={{ fontSize: '0.6rem', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Net APR</div>
                            <div className={results.netYield >= 0 ? 'text-success' : 'text-error'} style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                {((results.netYield / scenario.depositAmount) * (365 / scenario.timeline) * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    <h4 className="mb-sm" style={{ fontSize: '0.9rem' }}>Yield Breakdown</h4>
                    <div style={{ fontSize: '0.85rem' }}>
                        {/* Column Headers */}
                        <div className="flex justify-between text-muted" style={{
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 'var(--space-xs)',
                            paddingBottom: 'var(--space-xs)',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <span></span>
                            <div className="flex" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>Amount</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>APR</span>
                            </div>
                        </div>

                        {/* SAIL Earned - Collapsible */}
                        <div
                            className="flex justify-between items-center"
                            style={accordionHeaderStyle}
                            onClick={() => setIsSailExpanded(!isSailExpanded)}
                        >
                            <span className="flex items-center gap-sm">
                                <span className="text-muted">SAIL Earned</span>
                                <ChevronDown
                                    size={14}
                                    className="text-muted"
                                    style={{
                                        transition: 'transform var(--duration-normal) var(--ease-out)',
                                        transform: isSailExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}
                                />
                            </span>
                            <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.osailValue)}</span>
                                <span style={{ width: '50px', textAlign: 'right' }}>{results.sailAPR?.toFixed(1) || '0.0'}%</span>
                            </div>
                        </div>

                        {/* SAIL Breakdown */}
                        <div
                            style={{
                                overflow: 'hidden',
                                maxHeight: isSailExpanded ? '100px' : '0',
                                opacity: isSailExpanded ? 1 : 0,
                                transition: 'max-height var(--duration-slow) var(--ease-out), opacity var(--duration-normal) var(--ease-out)',
                                marginLeft: 'var(--space-md)',
                                paddingLeft: 'var(--space-md)',
                                borderLeft: isSailExpanded ? '2px solid var(--border-subtle)' : 'none'
                            }}
                        >
                            <div className="flex justify-between text-muted" style={{ padding: '4px 0', fontSize: '0.7rem' }}>
                                <span>→ Redeemed (liquid)</span>
                                <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                    <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.redeemValue)}</span>
                                    <span style={{ width: '50px', textAlign: 'right' }}>{results.redeemAPR?.toFixed(1) || '0.0'}%</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-muted" style={{ padding: '4px 0', fontSize: '0.7rem' }}>
                                <span>→ Locked (veSAIL)</span>
                                <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                    <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.lockValue)}</span>
                                    <span style={{ width: '50px', textAlign: 'right' }}>{results.lockAPR?.toFixed(1) || '0.0'}%</span>
                                </div>
                            </div>
                        </div>

                        {/* External Rewards - Collapsible */}
                        {results.externalRewards && results.externalRewards.length > 0 && (
                            <>
                                <div
                                    className="flex justify-between items-center"
                                    style={accordionHeaderStyle}
                                    onClick={() => setIsExternalExpanded(!isExternalExpanded)}
                                >
                                    <span className="flex items-center gap-sm">
                                        <span className="text-muted">External Rewards</span>
                                        <ChevronDown
                                            size={14}
                                            className="text-muted"
                                            style={{
                                                transition: 'transform var(--duration-normal) var(--ease-out)',
                                                transform: isExternalExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                            }}
                                        />
                                    </span>
                                    <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                        <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.externalRewardsValue)}</span>
                                        <span style={{ width: '50px', textAlign: 'right' }}>{results.externalRewards.reduce((sum, r) => sum + r.apr, 0).toFixed(1)}%</span>
                                    </div>
                                </div>

                                {/* External Breakdown */}
                                <div
                                    style={{
                                        overflow: 'hidden',
                                        maxHeight: isExternalExpanded ? '200px' : '0',
                                        opacity: isExternalExpanded ? 1 : 0,
                                        transition: 'max-height var(--duration-slow) var(--ease-out), opacity var(--duration-normal) var(--ease-out)',
                                        marginLeft: 'var(--space-md)',
                                        paddingLeft: 'var(--space-md)',
                                        borderLeft: isExternalExpanded ? '2px solid var(--border-subtle)' : 'none'
                                    }}
                                >
                                    {results.externalRewards.map((reward, idx) => (
                                        <div key={idx} className="flex justify-between text-muted" style={{ padding: '4px 0', fontSize: '0.7rem' }}>
                                            <span>→ {reward.token}</span>
                                            <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(reward.projectedValue)}</span>
                                                <span style={{ width: '50px', textAlign: 'right' }}>{reward.apr.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* IL */}
                        <div className="flex justify-between" style={{ padding: 'var(--space-xs) 0' }}>
                            <span className="text-muted">Impermanent Loss</span>
                            <div className="flex text-error" style={{ gap: 'var(--space-md)' }}>
                                <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.ilDollar)}</span>
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
                                <span style={{ width: '50px', textAlign: 'right' }}>{((results.netYield / scenario.depositAmount) * (365 / scenario.timeline) * 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Final Return */}
                        <div
                            className="flex justify-between"
                            style={{
                                fontWeight: 700,
                                fontSize: '1.05rem',
                                marginTop: 'var(--space-sm)',
                                paddingTop: 'var(--space-sm)',
                                background: 'rgba(0, 160, 255, 0.05)',
                                marginLeft: '-12px',
                                marginRight: '-12px',
                                paddingLeft: '12px',
                                paddingRight: '12px',
                                paddingBottom: 'var(--space-sm)',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <span>Final Return</span>
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
