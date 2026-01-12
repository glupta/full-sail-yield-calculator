import { useState, useEffect } from 'react';
import { getPoolAnalytics } from '../lib/pool-analytics';
import { TrendingUp, DollarSign, Activity, Coins } from 'lucide-react';

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

            {/* Core Metrics Grid */}
            <div className="analytics-metrics-grid">
                <MetricCard
                    icon={<DollarSign size={14} />}
                    label="TVL"
                    value={analytics.tvlFormatted}
                    accent="primary"
                />
                <MetricCard
                    icon={<TrendingUp size={14} />}
                    label="24h Volume"
                    value={analytics.volume24hFormatted}
                />
                <MetricCard
                    icon={<Coins size={14} />}
                    label="24h Fees"
                    value={analytics.fees24hFormatted}
                />
            </div>
        </div>
    );
}

/**
 * Metric Card Component
 */
function MetricCard({ icon, label, value, accent }) {
    const accentClass = accent ? `metric-${accent}` : '';
    return (
        <div className={`metric-card ${accentClass}`}>
            <div className="metric-icon">{icon}</div>
            <div className="metric-content">
                <span className="metric-label">{label}</span>
                <span className="metric-value">{value}</span>
            </div>
        </div>
    );
}
