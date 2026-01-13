'use client';

/**
 * SailInvestorDashboard - SAIL Token Investor Metrics Dashboard
 * Clean, focused investor metrics with placeholder data styled distinctly
 */
import { useState, useEffect } from 'react';
import { loadInputs, saveInputs } from '@/lib/persistence';
import { fetchSailMetrics, SailInvestorMetrics } from '@/lib/api-client';
import {
    TrendingUp,
    Lock,
    DollarSign,
    Activity,
    Wallet,
    Calculator,
    RefreshCw,
    BarChart3,
    Zap,
    Info,
} from 'lucide-react';

// Placeholder styling
const PLACEHOLDER_COLOR = 'var(--color-warning)';
const PLACEHOLDER_OPACITY = 0.6;

// Format helpers
const formatUsd = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompact = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return formatUsd(val);
};
const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
const formatNumber = (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 0 });

// Tooltip component using existing CSS classes
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
    return (
        <span className="tooltip-wrapper">
            {children}
            <Info size={12} className="tooltip-icon" style={{ marginLeft: '4px' }} />
            <span className="tooltip-text">{text}</span>
        </span>
    );
}

// Loading Skeleton
function DashboardSkeleton() {
    return (
        <div className="animate-in">
            <div className="glass-card mb-lg" style={{ padding: 'var(--space-xl)' }}>
                <div className="skeleton skeleton-heading" style={{ width: '200px', marginBottom: 'var(--space-lg)' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-lg)' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '80px' }}></div>
                    ))}
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton skeleton-card" style={{ height: '180px' }}></div>
                ))}
            </div>
        </div>
    );
}

// Hero Metric Card with tooltip
function HeroMetric({
    label,
    value,
    sublabel,
    icon,
    highlight = false,
    isPlaceholder = false,
    tooltip,
}: {
    label: string;
    value: string;
    sublabel?: string;
    icon: React.ReactNode;
    highlight?: boolean;
    isPlaceholder?: boolean;
    tooltip?: string;
}) {
    return (
        <div style={{
            background: highlight
                ? 'linear-gradient(135deg, rgba(0, 160, 255, 0.1) 0%, rgba(10, 22, 40, 0.8) 100%)'
                : 'var(--surface-elevated)',
            border: highlight ? '1px solid rgba(0, 160, 255, 0.25)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            textAlign: 'center',
            opacity: isPlaceholder ? PLACEHOLDER_OPACITY : 1,
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-xs)',
                marginBottom: 'var(--space-sm)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
            }}>
                {icon}
                {tooltip ? <Tooltip text={tooltip}>{label}</Tooltip> : label}
                {isPlaceholder && <span style={{ color: PLACEHOLDER_COLOR, fontSize: '0.6rem' }}>TBD</span>}
            </div>
            <div style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                fontFamily: 'var(--font-mono)',
                color: isPlaceholder ? PLACEHOLDER_COLOR : (highlight ? 'var(--color-success)' : 'var(--text-primary)'),
            }}>
                {value}
            </div>
            {sublabel && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {sublabel}
                </div>
            )}
        </div>
    );
}

// Metric Row with tooltip
function MetricRow({ label, value, valueColor, isPlaceholder = false, tooltip }: {
    label: string;
    value: string | React.ReactNode;
    valueColor?: string;
    isPlaceholder?: boolean;
    tooltip?: string;
}) {
    return (
        <div className="flex justify-between" style={{
            padding: 'var(--space-xs) 0',
            opacity: isPlaceholder ? PLACEHOLDER_OPACITY : 1,
        }}>
            <span className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                {tooltip ? <Tooltip text={tooltip}>{label}</Tooltip> : label}
                {isPlaceholder && <span style={{ color: PLACEHOLDER_COLOR, marginLeft: '4px', fontSize: '0.65rem' }}>TBD</span>}
            </span>
            <span style={{
                fontWeight: 600,
                color: isPlaceholder ? PLACEHOLDER_COLOR : valueColor,
                fontFamily: 'var(--font-mono)'
            }}>
                {value}
            </span>
        </div>
    );
}

export default function SailInvestorDashboard() {
    const [metrics, setMetrics] = useState<SailInvestorMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [calcInputs, setCalcInputs] = useState({
        sailAmount: 10000,
        lockDuration: 4,
        timeline: 30,
    });

    useEffect(() => {
        const saved = loadInputs('token_buyer');
        if (saved) setCalcInputs(saved);
    }, []);

    useEffect(() => {
        saveInputs('token_buyer', calcInputs);
    }, [calcInputs]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSailMetrics();
            setMetrics(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateCalc = (key: string, value: number) => {
        setCalcInputs(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div role="tabpanel" id="panel-sail" aria-labelledby="tab-sail">
                <DashboardSkeleton />
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div role="tabpanel" id="panel-sail" aria-labelledby="tab-sail">
                <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                    <p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }}>
                        {error || 'Failed to load metrics'}
                    </p>
                    <button onClick={fetchData} className="btn btn-primary">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Calculator derived values
    const sailValue = calcInputs.sailAmount * metrics.sailPrice;
    const projectedRewards = sailValue * metrics.votingApr * calcInputs.timeline / 365;
    const dailyReward = sailValue * metrics.votingApr / 365;
    const timeToRecoup = dailyReward > 0 ? sailValue / dailyReward : Infinity;

    return (
        <div role="tabpanel" id="panel-sail" aria-labelledby="tab-sail" className="animate-in">
            {/* Hero Section */}
            <div className="glass-card mb-lg" style={{ padding: 'var(--space-xl)' }}>
                <div className="flex justify-between items-center mb-lg">
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>SAIL Metrics</h2>
                    <div className="flex items-center gap-sm">
                        <span style={{
                            fontSize: '0.65rem',
                            color: 'var(--color-success)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                background: 'var(--color-success)',
                                borderRadius: '50%',
                            }}></span>
                            LIVE
                        </span>
                        <button
                            onClick={fetchData}
                            className="btn btn-ghost"
                            style={{ padding: 'var(--space-xs)' }}
                            title="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--space-md)',
                }}>
                    <HeroMetric
                        label="SAIL Price"
                        value={`$${metrics.sailPrice.toFixed(4)}`}
                        icon={<DollarSign size={16} />}
                        tooltip="Current SAIL token price from SAIL/USDC pool"
                    />
                    <HeroMetric
                        label="Voting APR"
                        value={formatPercent(metrics.votingApr)}
                        sublabel="From fees"
                        icon={<TrendingUp size={16} />}
                        highlight={true}
                        tooltip="Annualized return from protocol fees distributed to veSAIL voters. Formula: (Weekly Fees ÷ Locked Value) × 52"
                    />
                    <HeroMetric
                        label="Locked"
                        value={formatCompact(metrics.lockedValueUsd)}
                        sublabel={`${formatNumber(metrics.totalLockedSail)} SAIL`}
                        icon={<Lock size={16} />}
                        tooltip="Total USD value of SAIL locked as veSAIL for voting"
                    />
                    <HeroMetric
                        label="Lock Rate"
                        value="—"
                        sublabel="Needs supply data"
                        icon={<Zap size={16} />}
                        isPlaceholder={true}
                        tooltip="Percentage of circulating SAIL locked as veSAIL. Requires circulating supply data."
                    />
                </div>
            </div>

            {/* Main Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-lg)',
            }}>
                {/* Protocol Performance */}
                <div className="glass-card">
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                        <Activity size={18} style={{ color: 'var(--color-primary)' }} />
                        Protocol
                    </h3>
                    <MetricRow
                        label="TVL"
                        value={formatCompact(metrics.totalTvl)}
                        tooltip="Total Value Locked across all Full Sail liquidity pools"
                    />
                    <MetricRow
                        label="24h Volume"
                        value={formatCompact(metrics.totalVolume24h)}
                        tooltip="Total trading volume across all pools in the last 24 hours"
                    />
                    <MetricRow
                        label="24h Fees"
                        value={formatCompact(metrics.totalFees24h)}
                        tooltip="Fees generated in the last 24 hours. 95% goes to veSAIL voters."
                    />
                    <MetricRow
                        label="Pools"
                        value={metrics.poolCount.toString()}
                        tooltip="Number of active gauge-enabled liquidity pools"
                    />
                    <MetricRow
                        label="Capital Efficiency"
                        value={metrics.capitalEfficiency.toFixed(2) + 'x'}
                        valueColor={metrics.capitalEfficiency > 0.5 ? 'var(--color-success)' : undefined}
                        tooltip="Volume/TVL ratio. Higher = liquidity is being used more efficiently."
                    />
                </div>

                {/* veSAIL Yield */}
                <div className="glass-card">
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                        <Wallet size={18} style={{ color: 'var(--color-primary)' }} />
                        veSAIL Yield
                    </h3>
                    <MetricRow
                        label="Weekly Fees"
                        value={formatUsd(metrics.lastWeekFeesUsd)}
                        valueColor="var(--color-success)"
                        tooltip="Total fees distributed to veSAIL voters last epoch (7 days)"
                    />
                    <MetricRow
                        label="Voting APR"
                        value={formatPercent(metrics.votingApr)}
                        valueColor="var(--color-success)"
                        tooltip="Annualized yield for veSAIL holders from trading fees"
                    />
                    <MetricRow
                        label="Locked SAIL"
                        value={formatNumber(metrics.totalLockedSail)}
                        tooltip="Total SAIL tokens locked as veSAIL"
                    />
                    <MetricRow
                        label="Locked Value"
                        value={formatCompact(metrics.lockedValueUsd)}
                        tooltip="USD value of all locked SAIL at current price"
                    />
                    <MetricRow
                        label="Fee/Emission"
                        value={metrics.feeEmissionRatio.toFixed(1) + 'x'}
                        valueColor={metrics.feeEmissionRatio >= 1 ? 'var(--color-success)' : 'var(--color-warning)'}
                        tooltip="Ratio of fees earned to emissions spent. >1 = sustainable, <1 = subsidizing growth"
                    />
                </div>

                {/* Tokenomics (with placeholders) */}
                <div className="glass-card">
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                        <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
                        Tokenomics
                    </h3>
                    <MetricRow
                        label="Daily oSAIL"
                        value={formatNumber(metrics.totalOsailEmissions24h)}
                        tooltip="oSAIL tokens distributed to LPs per day"
                    />
                    <MetricRow
                        label="Weekly Emissions"
                        value={formatCompact(metrics.weeklyEmissionsUsd)}
                        tooltip="Dollar value of weekly oSAIL emissions at current SAIL price"
                    />
                    <MetricRow
                        label="Circulating Supply"
                        value="—"
                        isPlaceholder={true}
                        tooltip="SAIL tokens currently in circulation. Requires external data."
                    />
                    <MetricRow
                        label="Total Supply"
                        value="—"
                        isPlaceholder={true}
                        tooltip="Maximum SAIL token supply. Requires external data."
                    />
                    <MetricRow
                        label="Market Cap"
                        value="—"
                        isPlaceholder={true}
                        tooltip="Price × Circulating Supply. Requires supply data."
                    />
                </div>

                {/* Yield Calculator */}
                <div className="glass-card" style={{
                    background: 'linear-gradient(135deg, rgba(0, 160, 255, 0.06) 0%, rgba(10, 22, 40, 0.95) 100%)',
                    border: '1px solid rgba(0, 160, 255, 0.15)',
                }}>
                    <h3 className="mb-md flex items-center gap-sm" style={{ fontSize: '1rem' }}>
                        <Calculator size={18} style={{ color: 'var(--color-primary)' }} />
                        Calculator
                    </h3>

                    <div className="mb-md">
                        <label className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                            SAIL Amount
                        </label>
                        <input
                            type="number"
                            value={calcInputs.sailAmount}
                            onChange={(e) => updateCalc('sailAmount', Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                        <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                            ≈ {formatUsd(sailValue)}
                        </div>
                    </div>

                    <div className="mb-md">
                        <label className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                            Lock
                        </label>
                        <div className="flex gap-sm">
                            {[1, 2, 4].map(years => (
                                <button
                                    key={years}
                                    className={`btn ${calcInputs.lockDuration === years ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => updateCalc('lockDuration', years)}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                >
                                    {years}Y
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-lg">
                        <label className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                            Period
                        </label>
                        <div className="flex gap-sm">
                            {[30, 90, 365].map(days => (
                                <button
                                    key={days}
                                    className={`btn ${calcInputs.timeline === days ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => updateCalc('timeline', days)}
                                    style={{ flex: 1, fontSize: '0.85rem' }}
                                >
                                    {days === 365 ? '1Y' : `${days}D`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                        <MetricRow
                            label={`Rewards (${calcInputs.timeline}d)`}
                            value={formatUsd(projectedRewards)}
                            valueColor="var(--color-success)"
                            tooltip="Projected voting rewards over your selected time period"
                        />
                        <MetricRow
                            label="Return"
                            value={sailValue > 0 ? formatPercent(projectedRewards / sailValue) : '0%'}
                            tooltip="Percentage return on your locked SAIL over the period"
                        />
                        <MetricRow
                            label="Recoup"
                            value={timeToRecoup === Infinity ? '∞' :
                                timeToRecoup < 365 ? `${Math.round(timeToRecoup)}d` :
                                    `${(timeToRecoup / 365).toFixed(1)}y`}
                            tooltip="Time until voting rewards equal your initial SAIL investment"
                        />
                    </div>
                </div>
            </div>

            {/* Legend for placeholder data */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-lg)',
                marginTop: 'var(--space-xl)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
            }}>
                <span>
                    <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        background: 'var(--color-success)',
                        borderRadius: '50%',
                        marginRight: '4px'
                    }}></span>
                    Live data
                </span>
                <span>
                    <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        background: PLACEHOLDER_COLOR,
                        borderRadius: '50%',
                        marginRight: '4px',
                        opacity: PLACEHOLDER_OPACITY,
                    }}></span>
                    Coming soon
                </span>
            </div>
        </div>
    );
}
