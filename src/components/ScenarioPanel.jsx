import { useMemo } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { estimateILFromVolatility, calculateILDollarValue } from '../lib/calculators/il-calculator';
import { projectEmissions, getEmissionValue } from '../lib/calculators/emission-projector';
import { STRATEGY_PRESETS } from '../lib/calculators/osail-strategy';

export default function ScenarioPanel({
    index,
    scenario,
    pools,
    poolsLoading,
    onChange,
    onRemove,
    isWinner
}) {
    // Use pool from scenario
    const pool = scenario.pool;

    // Calculate yields based on scenario inputs and pool data
    const results = useMemo(() => {
        if (!pool) return null;

        const tvl = pool.dinamic_stats?.tvl || 0;
        // SDK returns distributed_osail_24h in raw units (9 decimals for SUI tokens)
        const osail24hRaw = pool.distributed_osail_24h || 0;
        const osail24h = osail24hRaw / 1e9; // Convert to human-readable
        const sailPrice = 0.5; // TODO: Fetch from SDK
        const volatility = 0.8; // Default 80% annualized

        // Project oSAIL emissions
        const projectedOsail = projectEmissions(
            scenario.depositAmount,
            tvl,
            osail24h,
            scenario.timeline
        );

        // Calculate strategy value
        const lockPct = scenario.osailStrategy / 100;
        const strategyValue = getEmissionValue(projectedOsail, sailPrice, lockPct);

        // Estimate IL
        const ilEstimate = estimateILFromVolatility(volatility, scenario.timeline);
        const ilDollar = calculateILDollarValue(scenario.depositAmount, ilEstimate.expected);

        // Net yield
        const netYield = strategyValue.totalValue - ilDollar;

        return {
            projectedOsail,
            osailValue: strategyValue.totalValue,
            lockValue: strategyValue.lockValue,
            redeemValue: strategyValue.redeemValue,
            ilPercent: ilEstimate.expected,
            ilDollar,
            netYield,
        };
    }, [pool, scenario]);

    const formatUsd = (val) => `$${val.toFixed(2)}`;
    const formatOsail = (val) => `${val.toFixed(2)} oSAIL`;

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
                    oSAIL Strategy
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={scenario.osailStrategy}
                    onChange={(e) => onChange({ osailStrategy: Number(e.target.value) })}
                />
                <div className="flex justify-between text-muted" style={{ fontSize: '0.75rem' }}>
                    <span>Lock ({scenario.osailStrategy}%)</span>
                    <span>Redeem ({100 - scenario.osailStrategy}%)</span>
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
                    <div className="flex flex-col gap-sm">
                        <div className="flex justify-between">
                            <span className="text-muted">oSAIL Emissions</span>
                            <span>{formatOsail(results.projectedOsail)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">oSAIL Value</span>
                            <span className="text-success">{formatUsd(results.osailValue)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">IL Estimate</span>
                            <span className="text-error">-{formatUsd(results.ilDollar)}</span>
                        </div>
                        <div
                            className="flex justify-between"
                            style={{
                                fontWeight: 600,
                                fontSize: '1.1rem',
                                paddingTop: 'var(--space-sm)',
                                borderTop: '1px solid var(--border-subtle)'
                            }}
                        >
                            <span>Net Yield</span>
                            <span className={results.netYield >= 0 ? 'text-success' : 'text-error'}>
                                {results.netYield >= 0 ? '' : '-'}{formatUsd(Math.abs(results.netYield))}
                                {isWinner && ' ✓'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
