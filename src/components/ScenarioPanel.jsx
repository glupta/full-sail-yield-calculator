import { useMemo, useState, useEffect, useRef } from 'react';
import { X, CheckCircle, ChevronDown } from 'lucide-react';
import { calculateScenarioResults } from '../lib/scenario-calculator';
import { calculateRangeAPR, RANGE_PRESETS, STABLE_RANGE_PRESETS, isStablePool, getPriceRangeFromPercent, calculateLeverage } from '../lib/calculators/leverage-calculator';
import { roundToSigFigs } from '../lib/formatters';
import { calculateEstimatedAPRFromSDK, fetchSailPrice } from '../lib/sdk';
import PoolAnalyticsPanel from './PoolAnalyticsPanel';

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
    const [isIncentivesExpanded, setIsIncentivesExpanded] = useState(false);
    const [sdkAPR, setSdkAPR] = useState(null);
    const [sailPrice, setSailPrice] = useState(0.01);
    const [isCalculatingAPR, setIsCalculatingAPR] = useState(false);
    const sailPriceRef = useRef(0.01);

    const pool = scenario.pool;

    const results = useMemo(() => {
        // Determine effective APR: user override > SDK-calculated > null (fallback to emission calc)
        const effectiveAPR = scenario.aprOverride !== null ? scenario.aprOverride : sdkAPR;
        return calculateScenarioResults(scenario, effectiveAPR);
    }, [scenario, sdkAPR]);

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
            if (price > 0) {
                setSailPrice(price);
                sailPriceRef.current = price;
            }
        });
    }, []);

    // Calculate SDK-based APR when price range or pool changes
    // Use a poolKey to detect when pool's relevant properties change
    const poolKey = pool ? `${pool.id}-${pool.current_sqrt_price}-${pool.distributed_osail_24h}` : null;

    useEffect(() => {
        if (!pool?.id || !scenario.priceRangeLow || !scenario.priceRangeHigh || !scenario.depositAmount) {
            setSdkAPR(null);
            setIsCalculatingAPR(false);
            return;
        }

        let cancelled = false;

        // Debounce: wait 500ms after last change before calculating
        // This prevents excessive API calls while user is typing
        const debounceId = setTimeout(() => {
            if (cancelled) return;

            setIsCalculatingAPR(true);

            // Use the latest sail price (from ref to avoid stale closure)
            const currentSailPrice = sailPriceRef.current > 0.01 ? sailPriceRef.current : sailPrice;

            // Add timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                if (!cancelled) {
                    console.warn('SDK APR calculation timed out');
                    setSdkAPR(null);
                    setIsCalculatingAPR(false);
                }
            }, 10000); // 10 second timeout

            calculateEstimatedAPRFromSDK({
                pool,
                priceLow: scenario.priceRangeLow,
                priceHigh: scenario.priceRangeHigh,
                depositAmount: scenario.depositAmount,
                rewardChoice: scenario.osailStrategy >= 50 ? 'vesail' : 'liquid',
                sailPrice: currentSailPrice,
            }).then(apr => {
                clearTimeout(timeoutId);
                if (!cancelled) {
                    console.log('[APR Update]', apr, 'for pool:', pool.name);
                    setSdkAPR(apr);
                    setIsCalculatingAPR(false);
                }
            }).catch((err) => {
                clearTimeout(timeoutId);
                if (!cancelled) {
                    console.error('[APR Error]', err);
                    setSdkAPR(null);
                    setIsCalculatingAPR(false);
                }
            });
        }, 500); // 500ms debounce delay

        return () => {
            cancelled = true;
            clearTimeout(debounceId);
        };
    }, [poolKey, scenario.priceRangeLow, scenario.priceRangeHigh, scenario.depositAmount, scenario.osailStrategy, sailPrice]);


    const formatUsd = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                {/* Pool Analytics Panel */}
                {pool && (
                    <PoolAnalyticsPanel pool={pool} />
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
                                            priceRangeHigh: roundToSigFigs(range.priceHigh, 4),
                                            aprOverride: null
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
                                        onChange({ priceRangeLow: roundToSigFigs(scenario.priceRangeLow * 0.99, 4), aprOverride: null });
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
                                        onChange({ priceRangeLow: null, aprOverride: null });
                                    } else {
                                        const numVal = parseFloat(val);
                                        if (!isNaN(numVal)) {
                                            onChange({ priceRangeLow: numVal, aprOverride: null });
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
                                        onChange({ priceRangeLow: roundToSigFigs(scenario.priceRangeLow * 1.01, 4), aprOverride: null });
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
                                        onChange({ priceRangeHigh: roundToSigFigs(scenario.priceRangeHigh * 0.99, 4), aprOverride: null });
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
                                        onChange({ priceRangeHigh: null, aprOverride: null });
                                    } else {
                                        const numVal = parseFloat(val);
                                        if (!isNaN(numVal)) {
                                            onChange({ priceRangeHigh: numVal, aprOverride: null });
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
                                        onChange({ priceRangeHigh: roundToSigFigs(scenario.priceRangeHigh * 1.01, 4), aprOverride: null });
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

            {/* Estimated APR Input */}
            {pool && (
                <div className="mb-md">
                    <div className="price-range-inline" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="price-range-field">
                            <label className="price-range-field-label">
                                Estimated APR
                                {scenario.aprOverride === null && sdkAPR !== null && !isCalculatingAPR && (
                                    <span style={{
                                        marginLeft: '6px',
                                        fontSize: '0.65rem',
                                        color: 'var(--color-primary)',
                                        opacity: 0.8
                                    }}>(SDK)</span>
                                )}
                                {isCalculatingAPR && (
                                    <span style={{
                                        marginLeft: '6px',
                                        fontSize: '0.65rem',
                                        color: 'var(--text-muted)',
                                        opacity: 0.8
                                    }}>calculating...</span>
                                )}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={scenario.aprOverride !== null
                                        ? scenario.aprOverride
                                        : (sdkAPR !== null && sdkAPR > 0 ? sdkAPR.toFixed(1) : '')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || val === null) {
                                            onChange({ aprOverride: null });
                                        } else {
                                            const numVal = parseFloat(val);
                                            if (!isNaN(numVal) && numVal >= 0) {
                                                onChange({ aprOverride: numVal });
                                            }
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        paddingRight: '28px',
                                        opacity: isCalculatingAPR ? 0.6 : 1,
                                        transition: 'opacity 0.2s ease'
                                    }}
                                    placeholder={isCalculatingAPR ? 'Calculating...' : 'Loading...'}
                                />
                                <span style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500,
                                    pointerEvents: 'none'
                                }}>%</span>
                            </div>
                            {scenario.aprOverride !== null && sdkAPR !== null && (
                                <button
                                    onClick={() => onChange({ aprOverride: null })}
                                    style={{
                                        marginTop: '4px',
                                        fontSize: '0.7rem',
                                        color: 'var(--color-primary)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Reset to SDK ({sdkAPR.toFixed(1)}%)
                                </button>
                            )}
                        </div>
                        <div className="price-range-field">
                            <label className="price-range-field-label">Leverage</label>
                            <div style={{
                                padding: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-subtle)',
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: leverage > 2 ? 'var(--color-warning)' : 'var(--text-primary)'
                            }}>
                                {leverage.toFixed(2)}x
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto',
                            gap: 'var(--space-md)',
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: 'var(--space-xs)',
                            paddingBottom: 'var(--space-xs)',
                            borderBottom: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)'
                        }}>
                            <span></span>
                            <span style={{ textAlign: 'right', minWidth: '80px' }}>Amount</span>
                            <span style={{ textAlign: 'right', minWidth: '60px' }}>APR</span>
                        </div>

                        {/* Helper to calculate APR - annualize based on timeline */}
                        {(() => {
                            const timeline = scenario.timeline || 30; // Default to 30 days
                            const annualizeAPR = (timelineValue) => {
                                if (!scenario.depositAmount || scenario.depositAmount === 0) return 0;
                                const annualized = timelineValue * (365 / timeline);
                                return (annualized / scenario.depositAmount) * 100;
                            };
                            // Alias for use in breakdown sub-items
                            const calcAPR = annualizeAPR;

                            // Use sailAPR directly from results (already correctly calculated)
                            const sailAPR = results.sailAPR || 0;
                            const incentivesAPR = annualizeAPR(results.externalRewardsValue || 0);
                            const ilAPR = annualizeAPR(results.ilDollar);
                            const netAPR = annualizeAPR(results.netYield);

                            return (
                                <>
                                    {/* SAIL Earned - Collapsible */}
                                    <div
                                        style={{
                                            ...accordionHeaderStyle,
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto auto',
                                            gap: 'var(--space-md)',
                                            alignItems: 'center'
                                        }}
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
                                        <span className="text-success" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.osailValue)}</span>
                                        <span className="text-success" style={{ textAlign: 'right', minWidth: '60px' }}>{sailAPR.toFixed(1)}%</span>
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
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-md)', padding: '4px 0', fontSize: '0.7rem' }}>
                                            <span className="text-muted">Redeemed (liquid)</span>
                                            <span className="text-success" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.redeemValue)}</span>
                                            <span className="text-success" style={{ textAlign: 'right', minWidth: '60px' }}>{calcAPR(results.redeemValue).toFixed(1)}%</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-md)', padding: '4px 0', fontSize: '0.7rem' }}>
                                            <span className="text-muted">Locked (veSAIL)</span>
                                            <span className="text-success" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.lockValue)}</span>
                                            <span className="text-success" style={{ textAlign: 'right', minWidth: '60px' }}>{calcAPR(results.lockValue).toFixed(1)}%</span>
                                        </div>
                                    </div>

                                    {/* Incentives - Collapsible */}
                                    {results.externalRewards && results.externalRewards.length > 0 && (
                                        <>
                                            <div
                                                style={{
                                                    ...accordionHeaderStyle,
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto auto',
                                                    gap: 'var(--space-md)',
                                                    alignItems: 'center'
                                                }}
                                                onClick={() => setIsIncentivesExpanded(!isIncentivesExpanded)}
                                            >
                                                <span className="flex items-center gap-sm">
                                                    <span className="text-muted">Incentives</span>
                                                    <ChevronDown
                                                        size={14}
                                                        className="text-muted"
                                                        style={{
                                                            transition: 'transform var(--duration-normal) var(--ease-out)',
                                                            transform: isIncentivesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                                        }}
                                                    />
                                                </span>
                                                <span className="text-success" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.externalRewardsValue)}</span>
                                                <span className="text-success" style={{ textAlign: 'right', minWidth: '60px' }}>{incentivesAPR.toFixed(1)}%</span>
                                            </div>

                                            {/* Incentives Breakdown */}
                                            <div
                                                style={{
                                                    overflow: 'hidden',
                                                    maxHeight: isIncentivesExpanded ? '200px' : '0',
                                                    opacity: isIncentivesExpanded ? 1 : 0,
                                                    transition: 'max-height var(--duration-slow) var(--ease-out), opacity var(--duration-normal) var(--ease-out)',
                                                    marginLeft: 'var(--space-md)',
                                                    paddingLeft: 'var(--space-md)',
                                                    borderLeft: isIncentivesExpanded ? '2px solid var(--border-subtle)' : 'none'
                                                }}
                                            >
                                                {results.externalRewards.map((reward, idx) => (
                                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-md)', padding: '4px 0', fontSize: '0.7rem' }}>
                                                        <span className="text-muted">{reward.token}</span>
                                                        <span className="text-success" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(reward.projectedValue)}</span>
                                                        <span className="text-success" style={{ textAlign: 'right', minWidth: '60px' }}>{calcAPR(reward.projectedValue).toFixed(1)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* IL */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--space-md)', padding: 'var(--space-xs) 0' }}>
                                        <span className="text-muted">Impermanent Loss</span>
                                        <span className="text-error" style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.ilDollar)}</span>
                                        <span className="text-error" style={{ textAlign: 'right', minWidth: '60px' }}>{ilAPR > 0 ? `-${ilAPR.toFixed(1)}%` : '0.0%'}</span>
                                    </div>



                                    {/* Net Yield */}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto auto',
                                            gap: 'var(--space-md)',
                                            fontWeight: 600,
                                            marginTop: 'var(--space-sm)',
                                            paddingTop: 'var(--space-sm)',
                                            borderTop: '1px solid var(--border-subtle)'
                                        }}
                                    >
                                        <span>Net Yield {isWinner && '✓'}</span>
                                        <span className={results.netYield >= 0 ? 'text-success' : 'text-error'} style={{ textAlign: 'right', minWidth: '80px' }}>{formatUsd(results.netYield)}</span>
                                        <span className={results.netYield >= 0 ? 'text-success' : 'text-error'} style={{ textAlign: 'right', minWidth: '60px' }}>{netAPR >= 0 ? '' : '-'}{Math.abs(netAPR).toFixed(1)}%</span>
                                    </div>
                                </>
                            );
                        })()}

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
