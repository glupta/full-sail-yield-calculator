import { useMemo } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { estimateILFromVolatility, calculateILDollarValue } from '../lib/calculators/il-calculator';
import { projectEmissions, getEmissionValue } from '../lib/calculators/emission-projector';
import { STRATEGY_PRESETS } from '../lib/calculators/osail-strategy';

export default function ScenarioPanel({
    index,
    scenario,
    pool,
    onChange,
    onRemove,
    isWinner
}) {
    // Calculate yields based on scenario inputs and pool data
    const results = useMemo(() => {
        if (!pool) return null;

        const tvl = pool.dinamic_stats?.tvl || 0;
        const osail24h = pool.distributed_osail_24h || 0;
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
                </label>
                <div className="flex gap-sm">
                    <input
                        type="number"
                        step="0.01"
                        value={scenario.priceRangeLow}
                        onChange={(e) => onChange({ priceRangeLow: Number(e.target.value) })}
                        style={{ width: '50%' }}
                        placeholder="Low"
                    />
                    <input
                        type="number"
                        step="0.01"
                        value={scenario.priceRangeHigh}
                        onChange={(e) => onChange({ priceRangeHigh: Number(e.target.value) })}
                        style={{ width: '50%' }}
                        placeholder="High"
                    />
                </div>
            </div>

            {/* Timeline */}
            <div className="mb-md">
                <label className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                    Timeline
                </label>
                <div className="flex gap-sm">
                    {[30, 60, 90].map(days => (
                        <button
                            key={days}
                            className={`btn ${scenario.timeline === days ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => onChange({ timeline: days })}
                            style={{ flex: 1, padding: 'var(--space-xs) var(--space-sm)' }}
                        >
                            {days} Days
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
