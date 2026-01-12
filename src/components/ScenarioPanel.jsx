import { useMemo, useState, useEffect } from 'react';
import { X, CheckCircle, ChevronDown } from 'lucide-react';
import { calculateScenarioResults } from '../lib/scenario-calculator';
import { calculateRangeAPR, RANGE_PRESETS, STABLE_RANGE_PRESETS, isStablePool, getPriceRangeFromPercent, calculateLeverage } from '../lib/calculators/leverage-calculator';
import { roundToSigFigs } from '../lib/formatters';
import { calculateEstimatedAPRFromSDK, fetchSailPrice } from '../lib/sdk';

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
    const [sdkAPR, setSdkAPR] = useState(null);
    const [sailPrice, setSailPrice] = useState(0.01);

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

    // Calculate leverage for display
    const leverage = useMemo(() => {
        if (!pool?.currentPrice || !scenario.priceRangeLow || !scenario.priceRangeHigh) return 1;
        return calculateLeverage(pool.currentPrice, scenario.priceRangeLow, scenario.priceRangeHigh);
    }, [pool?.currentPrice, scenario.priceRangeLow, scenario.priceRangeHigh]);

    // Fetch SAIL price on mount
    useEffect(() => {
        fetchSailPrice().then(price => {
            if (price > 0) setSailPrice(price);
        });
    }, []);

    // Calculate SDK-based APR when price range changes
    useEffect(() => {
        if (!pool || !scenario.priceRangeLow || !scenario.priceRangeHigh || !scenario.depositAmount) {
            setSdkAPR(null);
            return;
        }

        calculateEstimatedAPRFromSDK({
            pool,
            priceLow: scenario.priceRangeLow,
            priceHigh: scenario.priceRangeHigh,
            depositAmount: scenario.depositAmount,
            rewardChoice: scenario.osailStrategy >= 50 ? 'vesail' : 'liquid',
            sailPrice,
        }).then(apr => {
            setSdkAPR(apr);
        });
    }, [pool, scenario.priceRangeLow, scenario.priceRangeHigh, scenario.depositAmount, scenario.osailStrategy, sailPrice]);


    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatTVL = (tvl) => {
        if (!tvl) return '$0';
        if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
        if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
        return `$${tvl.toFixed(0)}`;
    };

    // Format pool pair with preferred ordering: USDC last, then SUI, then stSUI
    const formatPairLabel = (token0, token1) => {
        const quoteTokens = ['USDC', 'USDT', 'DAI', 'SUI', 'STSUI', 'AFSUI', 'HASUI', 'VSUI'];
        const token0Upper = (token0 || '').toUpperCase();
        const token1Upper = (token1 || '').toUpperCase();

        // Find priority (lower = should be last)
        const getPriority = (t) => {
            if (t.includes('USDC') || t.includes('USDT') || t.includes('DAI')) return 0;
            if (t === 'SUI') return 1;
            if (t.includes('SUI')) return 2; // stSUI, afSUI, etc
            return 10;
        };

        const p0 = getPriority(token0Upper);
        const p1 = getPriority(token1Upper);

        // Lower priority token goes last (quote currency)
        if (p0 < p1) return `${token1}/${token0}`;
        return `${token0}/${token1}`;
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
                <span className="price-range-field-label" style={{ marginBottom: 0, fontSize: '1rem' }}>Scenario {index + 1}</span>
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
                <label className="price-range-field-label">Pool</label>
                {poolsLoading ? (
                    <div className="skeleton" style={{ height: '48px' }}></div>
                ) : (
                    <select
                        value={pool?.id || ''}
                        onChange={(e) => {
                            const selected = pools.find(p => p.id === e.target.value);
                            onChange({ pool: selected, exitPrice: null, priceRangeLow: null, priceRangeHigh: null });
                        }}
                        style={{ width: '100%' }}
                    >
                        <option value="">Select a pool...</option>
                        {[...pools].sort((a, b) => (b.dinamic_stats?.tvl || 0) - (a.dinamic_stats?.tvl || 0)).map(p => (
                            <option key={p.id} value={p.id}>
                                {formatPairLabel(p.token0_symbol, p.token1_symbol)}
                            </option>
                        ))}
                    </select>
                )}
                {pool && (
                    <div className="pool-metrics-grid mt-md">
                        <div className="pool-metric-item">
                            <div className="pool-metric-label">TVL</div>
                            <div className="pool-metric-value">{formatTVL(pool.dinamic_stats?.tvl)}</div>
                        </div>
                        <div className="pool-metric-item">
                            <div className="pool-metric-label">24h Volume</div>
                            <div className="pool-metric-value">{formatTVL(pool.dinamic_stats?.volume_24h)}</div>
                        </div>
                        <div className="pool-metric-item">
                            <div className="pool-metric-label">Current Price</div>
                            <div className="pool-metric-value">
                                ${pool.currentPrice < 0.01
                                    ? pool.currentPrice?.toFixed(6)
                                    : pool.currentPrice?.toFixed(4)}
                            </div>
                        </div>
                        <div className="pool-metric-item">
                            <div className="pool-metric-label">Base APR</div>
                            <div className="pool-metric-value text-success">{pool.full_apr?.toFixed(0) || 0}%</div>
                        </div>
                    </div>
                )}
            </div>


            {/* Deposit Amount & Exit Price - Responsive stack on mobile */}
            <div className="price-range-inline mb-md" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="price-range-field">
                    <label className="price-range-field-label">Deposit Amount</label>
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

                <div className="price-range-field">
                    <label className="price-range-field-label">
                        Exit Price <span style={{ opacity: 0.6 }}>(IL)</span>
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
                        <div className="price-range-change" style={{ textAlign: 'left' }}>
                            {(() => {
                                const exitPrice = scenario.exitPrice !== null && scenario.exitPrice !== undefined
                                    ? scenario.exitPrice
                                    : pool.currentPrice;
                                const change = ((exitPrice / pool.currentPrice) - 1) * 100;
                                if (!isFinite(change) || isNaN(change)) {
                                    return '0.0% change';
                                }
                                const colorClass = change >= 0 ? 'text-success' : 'text-error';
                                return <span className={colorClass}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>;
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Price Range */}
            <div className="input-group mb-md">
                <div className="input-group-label">
                    <span>Price Range</span>
                    {pool?.currentPrice && (
                        <span className="current-price-inline">
                            Current: ${pool.currentPrice < 0.01
                                ? pool.currentPrice.toFixed(6)
                                : pool.currentPrice.toFixed(4)}
                        </span>
                    )}
                </div>

                {/* Inline Layout: Preset Dropdown | Low | High */}
                <div className="price-range-inline">
                    {/* Preset Dropdown */}
                    {pool?.currentPrice && (
                        <div className="price-range-preset">
                            <label className="price-range-field-label">Preset</label>
                            <select
                                onChange={(e) => {
                                    const presets = isStablePool(pool) ? STABLE_RANGE_PRESETS : RANGE_PRESETS;
                                    const preset = presets.find(p => p.label === e.target.value);
                                    if (preset) {
                                        const range = getPriceRangeFromPercent(
                                            pool.currentPrice,
                                            preset.lowerPct,
                                            preset.upperPct
                                        );
                                        onChange({
                                            priceRangeLow: roundToSigFigs(range.priceLow, 4),
                                            priceRangeHigh: roundToSigFigs(range.priceHigh, 4)
                                        });
                                    }
                                }}
                                defaultValue="Balanced"
                            >
                                {(isStablePool(pool) ? STABLE_RANGE_PRESETS : RANGE_PRESETS).map(preset => (
                                    <option key={preset.label} value={preset.label}>
                                        {preset.label} ({preset.lowerPct}%, {preset.upperPct > 1000 ? '∞' : `+${preset.upperPct}%`})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Low Price */}
                    <div className="price-range-field">
                        <label className="price-range-field-label">Low</label>
                        <div className="price-range-input-row">
                            <button
                                className="price-stepper-mini"
                                onClick={() => {
                                    if (scenario.priceRangeLow) {
                                        onChange({ priceRangeLow: roundToSigFigs(scenario.priceRangeLow * 0.99, 4) });
                                    }
                                }}
                                disabled={!scenario.priceRangeLow}
                            >−</button>
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
                                className="price-range-input"
                                placeholder="$0.00"
                            />
                            <button
                                className="price-stepper-mini"
                                onClick={() => {
                                    if (scenario.priceRangeLow) {
                                        onChange({ priceRangeLow: roundToSigFigs(scenario.priceRangeLow * 1.01, 4) });
                                    }
                                }}
                                disabled={!scenario.priceRangeLow}
                            >+</button>
                        </div>
                        {pool?.currentPrice && scenario.priceRangeLow > 0 && (
                            <div className="price-range-change text-error">
                                {(() => {
                                    const change = ((scenario.priceRangeLow / pool.currentPrice) - 1) * 100;
                                    return `${change.toFixed(1)}%`;
                                })()}
                            </div>
                        )}
                    </div>

                    {/* High Price */}
                    <div className="price-range-field">
                        <label className="price-range-field-label">High</label>
                        <div className="price-range-input-row">
                            <button
                                className="price-stepper-mini"
                                onClick={() => {
                                    if (scenario.priceRangeHigh) {
                                        onChange({ priceRangeHigh: roundToSigFigs(scenario.priceRangeHigh * 0.99, 4) });
                                    }
                                }}
                                disabled={!scenario.priceRangeHigh}
                            >−</button>
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
                                className="price-range-input"
                                placeholder="$0.00"
                            />
                            <button
                                className="price-stepper-mini"
                                onClick={() => {
                                    if (scenario.priceRangeHigh) {
                                        onChange({ priceRangeHigh: roundToSigFigs(scenario.priceRangeHigh * 1.01, 4) });
                                    }
                                }}
                                disabled={!scenario.priceRangeHigh}
                            >+</button>
                        </div>
                        {pool?.currentPrice && scenario.priceRangeHigh > 0 && (
                            <div className="price-range-change text-success">
                                {(() => {
                                    const change = ((scenario.priceRangeHigh / pool.currentPrice) - 1) * 100;
                                    return `+${change.toFixed(1)}%`;
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Claim Strategy - Dedicated Section */}
            <div className="claim-strategy-section mb-md">
                <div className="claim-strategy-header">
                    <span className="claim-strategy-label">Claim Strategy</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={scenario.osailStrategy}
                    onChange={(e) => onChange({ osailStrategy: Number(e.target.value) })}
                    style={{ margin: 0 }}
                />
                <div className="claim-strategy-values-bottom">
                    <span className={scenario.osailStrategy < 50 ? 'active' : ''}>Redeem {100 - scenario.osailStrategy}%</span>
                    <span className={scenario.osailStrategy >= 50 ? 'active' : ''}>Lock {scenario.osailStrategy}%</span>
                </div>
            </div>

            {/* Results */}
            {results && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    paddingTop: 'var(--space-md)',
                    borderTop: '1px solid var(--border-subtle)'
                }}>
                    <span className="price-range-field-label" style={{ fontSize: '0.9rem' }}>Yield Breakdown</span>
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
                                <span>Redeemed (liquid)</span>
                                <div className="flex text-success" style={{ gap: 'var(--space-md)' }}>
                                    <span style={{ width: '70px', textAlign: 'right' }}>{formatUsd(results.redeemValue)}</span>
                                    <span style={{ width: '50px', textAlign: 'right' }}>{results.redeemAPR?.toFixed(1) || '0.0'}%</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-muted" style={{ padding: '4px 0', fontSize: '0.7rem' }}>
                                <span>Locked (veSAIL)</span>
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
                                            <span>{reward.token}</span>
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
