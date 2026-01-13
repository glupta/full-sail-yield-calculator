'use client';

import { useState, useEffect } from 'react';
import { getPoolAnalytics } from '@/lib/pool-analytics';
import { TrendingUp, DollarSign, Activity, Coins, Percent, HelpCircle } from 'lucide-react';

/**
 * Pool Analytics Panel
 * Displays REAL metrics from SDK data only - no estimates
 */
export default function PoolAnalyticsPanel({ pool }) {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!pool) {
            setLoading(false);
            setAnalytics(null);
            return;
        }

        setLoading(true);
        // getPoolAnalytics is now synchronous
        const data = getPoolAnalytics(pool);
        setAnalytics(data);
        setLoading(false);
    }, [pool?.id]);

    if (!pool) return null;

    if (loading) {
        return (
            <div className="analytics-panel glass-card animate-in mt-md">
                <div className="analytics-header">
                    <Activity size={16} />
                    <h4>Pool Metrics</h4>
                </div>
                <div className="analytics-loading">
                    <div className="skeleton" style={{ height: '120px' }}></div>
                </div>
            </div>
        );
    }

    if (!analytics) return null;

    return (
        <div className="analytics-panel glass-card animate-in mt-md">
            {/* Header */}
            <div className="analytics-header">
                <Activity size={16} />
                <h4>Pool Metrics</h4>
            </div>

            {/* Top Row: TVL, Volume, Fees, Fee Tier */}
            <div className="analytics-metrics-grid" style={{ marginBottom: 'var(--space-sm)' }}>
                <MetricCard
                    icon={<DollarSign size={14} />}
                    label="TVL"
                    value={analytics.tvlFormatted}
                    accent="primary"
                    tooltip="Total Value Locked - the total USD value of assets deposited in this pool"
                />
                <MetricCard
                    icon={<TrendingUp size={14} />}
                    label="24h Volume"
                    value={analytics.volume24hFormatted}
                    tooltip="Trading volume over the last 24 hours"
                />
                <MetricCard
                    icon={<Coins size={14} />}
                    label="24h Fees"
                    value={analytics.fees24hFormatted}
                    tooltip="Total fees collected by LPs in the last 24 hours"
                />
                <MetricCard
                    icon={<Percent size={14} />}
                    label="Fee Tier"
                    value={analytics.feeTierFormatted}
                    tooltip="The fee charged on each swap (e.g., 0.18% = 18 basis points)"
                />
            </div>

            {/* Bottom Row: Active Liq%, Current Price, Fee APR, Yield APR */}
            <div className="analytics-metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <MetricCard
                    icon={<Percent size={14} />}
                    label="Active Liq."
                    value={analytics.activeLiquidityPercentFormatted}
                    tooltip="Percentage of pool liquidity currently in the active price range and earning fees"
                />
                <MetricCard
                    icon={<DollarSign size={14} />}
                    label="Current Price"
                    value={analytics.currentPriceFormatted}
                    tooltip="Current spot price of the base token in terms of the quote token"
                />
                <MetricCard
                    icon={<TrendingUp size={14} />}
                    label="Fee APR"
                    value={analytics.feeAprFormatted}
                    tooltip="Annualized return from trading fees: (24h Fees ÷ TVL) × 365"
                />
                <MetricCard
                    icon={<TrendingUp size={14} />}
                    label="Yield APR"
                    value={analytics.fullAprFormatted}
                    accent="success"
                    tooltip="Total APR including trading fees, oSAIL emissions, and external incentives (like SUI rewards)"
                />
            </div>
        </div>
    );
}

/**
 * Metric Card Component with optional tooltip
 */
function MetricCard({ icon, label, value, accent, tooltip }) {
    const accentClass = accent ? `metric-${accent}` : '';
    return (
        <div className={`metric-card ${accentClass}`}>
            <div className="metric-icon">{icon}</div>
            <div className="metric-content">
                <span className="metric-label">
                    {label}
                    {tooltip && (
                        <span className="tooltip-wrapper" style={{ marginLeft: '4px' }}>
                            <HelpCircle size={10} className="tooltip-icon" />
                            <span className="tooltip-text">{tooltip}</span>
                        </span>
                    )}
                </span>
                <span className="metric-value">{value}</span>
            </div>
        </div>
    );
}
